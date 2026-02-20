import * as fs from 'fs';
import * as path from 'path';
import { cwdFile, log } from './utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HookTrigger =
  | 'pre-commit'
  | 'pre-push'
  | 'commit-msg'
  | 'post-merge'
  | 'post-checkout';

export interface HookEntry {
  trigger: HookTrigger;
  label: string;
  command: string;
  isCustom?: boolean;
}

export interface HooksConfig {
  hooks: HookEntry[];
}

// ─── Presets ──────────────────────────────────────────────────────────────────

interface PresetHook extends HookEntry {
  requiresScript?: string; // only show if this npm script exists
}

export const PRESET_HOOKS: PresetHook[] = [
  {
    trigger: 'pre-push',
    label: 'Build before push',
    command: 'npm run build',
    requiresScript: 'build',
  },
  {
    trigger: 'pre-commit',
    label: 'Lint before commit',
    command: 'npm run lint',
    requiresScript: 'lint',
  },
  {
    trigger: 'pre-push',
    label: 'Run tests before push',
    command: 'npm run test',
    requiresScript: 'test',
  },
  {
    trigger: 'pre-commit',
    label: 'Type-check before commit',
    command: 'npx tsc --noEmit',
    requiresScript: undefined,
  },
  {
    trigger: 'pre-commit',
    label: 'Format files before commit',
    command: 'npm run format',
    requiresScript: 'format',
  },
  {
    trigger: 'pre-push',
    label: 'Security audit before push',
    command: 'npm audit --audit-level=high',
    requiresScript: undefined,
  },
  {
    trigger: 'pre-commit',
    label: 'Run database migrations before commit',
    command: 'npm run db:migrate',
    requiresScript: 'db:migrate',
  },
];

// ─── Ask Hook Questions ───────────────────────────────────────────────────────

export async function askHookQuestions(
  availableScripts: string[],
  flags: { silent: boolean }
): Promise<HooksConfig> {
  if (flags.silent) return { hooks: [] };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prompt } = require('enquirer') as {
    prompt: <T>(opts: Record<string, unknown>) => Promise<T>;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const chalk = require('chalk');

  // Filter presets to those whose required script exists (or has no requirement)
  const relevantPresets = PRESET_HOOKS.filter(
    (p) => !p.requiresScript || availableScripts.includes(p.requiresScript)
  );

  console.log('');
  log.section('Git Hook Automations');
  console.log(
    chalk.dim(
      '  Automations that run automatically on git events (space to toggle).\n'
    )
  );

  // Build choice labels
  const presetChoiceLabels = relevantPresets.map(
    (p) => `${p.label}  ${chalk.dim(`(${p.trigger}: ${p.command})`)}`
  );
  const customChoiceLabel = '+ Add custom hook...';
  const allChoiceLabels = [...presetChoiceLabels, customChoiceLabel];

  const { selected } = await prompt<{ selected: string[] }>({
    type: 'multiselect',
    name: 'selected',
    message: 'Select automations to enable:',
    choices: allChoiceLabels,
    hint: '(space to select, enter to confirm)',
    result(names: string[]) {
      return names;
    },
  });

  const hooks: HookEntry[] = [];

  // Map selected labels back to preset entries
  for (let i = 0; i < relevantPresets.length; i++) {
    if (selected.includes(presetChoiceLabels[i])) {
      const p = relevantPresets[i];
      hooks.push({ trigger: p.trigger, label: p.label, command: p.command });
    }
  }

  // Custom hooks
  if (selected.includes(customChoiceLabel)) {
    console.log(
      chalk.cyan('\n  Custom hooks') +
        chalk.dim(' — add your own automations:\n')
    );

    let addingMore = true;
    while (addingMore) {
      const { trigger } = await prompt<{ trigger: HookTrigger }>({
        type: 'select',
        name: 'trigger',
        message: 'When should this run?',
        choices: [
          { name: 'pre-commit', message: 'pre-commit  (before every git commit)' },
          { name: 'pre-push', message: 'pre-push    (before every git push)' },
          { name: 'commit-msg', message: 'commit-msg  (validate commit message)' },
          { name: 'post-merge', message: 'post-merge  (after git merge/pull)' },
          { name: 'post-checkout', message: 'post-checkout (after branch switch)' },
        ],
      });

      const { label } = await prompt<{ label: string }>({
        type: 'input',
        name: 'label',
        message: 'Description (e.g. "Run security scan"):',
        validate: (v: string) => (v.trim().length > 0 ? true : 'Required'),
      });

      const { command } = await prompt<{ command: string }>({
        type: 'input',
        name: 'command',
        message: 'Command to run (e.g. "npm run security:scan"):',
        validate: (v: string) => (v.trim().length > 0 ? true : 'Required'),
      });

      hooks.push({
        trigger,
        label: label.trim(),
        command: command.trim(),
        isCustom: true,
      });

      const { another } = await prompt<{ another: boolean }>({
        type: 'confirm',
        name: 'another',
        message: 'Add another custom hook?',
        initial: false,
      });

      addingMore = another;
    }
  }

  return { hooks };
}

// ─── Write Hook Files ─────────────────────────────────────────────────────────

export function writeHooks(config: HooksConfig): void {
  if (config.hooks.length === 0) return;

  const hooksDir = cwdFile('.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    log.warn('.git/hooks/ not found — skipping hook generation (is this a git repo?)');
    return;
  }

  // Group hooks by trigger
  const byTrigger = new Map<HookTrigger, HookEntry[]>();
  for (const hook of config.hooks) {
    if (!byTrigger.has(hook.trigger)) byTrigger.set(hook.trigger, []);
    byTrigger.get(hook.trigger)!.push(hook);
  }

  for (const [trigger, entries] of byTrigger) {
    const hookPath = path.join(hooksDir, trigger);
    const script = generateHookScript(trigger, entries);
    fs.writeFileSync(hookPath, script, { encoding: 'utf-8', mode: 0o755 });
    log.success(`Git hook written: .git/hooks/${trigger}`);
  }
}

// ─── Generate Shell Script ────────────────────────────────────────────────────

function generateHookScript(trigger: string, entries: HookEntry[]): string {
  const blockWord = trigger === 'pre-push' ? 'Push' : trigger === 'pre-commit' ? 'Commit' : 'Operation';

  const lines: string[] = [
    '#!/bin/sh',
    `# Generated by flight-dispatcher — ${trigger}`,
    '# Re-run `npx flight-dispatcher --update` to regenerate',
    '',
  ];

  for (const entry of entries) {
    lines.push(`# ── ${entry.label} ──`);
    lines.push(`echo "Running: ${entry.label}..."`);
    lines.push(entry.command);
    lines.push('if [ $? -ne 0 ]; then');
    lines.push(`  echo ""`);
    lines.push(`  echo "✖  ${entry.label} failed. ${blockWord} aborted."`);
    lines.push('  exit 1');
    lines.push('fi');
    lines.push('');
  }

  lines.push('exit 0');
  return lines.join('\n') + '\n';
}

// ─── Summarize for Instructions File ─────────────────────────────────────────

export function summarizeHooks(config: HooksConfig): string[] {
  if (config.hooks.length === 0) return [];
  return config.hooks.map(
    (h) => `\`${h.trigger}\`: ${h.label} (\`${h.command}\`)`
  );
}
