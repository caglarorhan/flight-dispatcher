import chalk from 'chalk';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prompt } = require('enquirer') as { prompt: <T>(opts: Record<string, unknown>) => Promise<T> };
import type { DetectionResult } from './detector';
import { log } from './utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectAnswers {
  description: string;
  deploymentTarget: string;
  architectureRules: string[];
  prismaSchemaCommand?: string;
  i18nDefaultLocale?: string;
  monorepoFocus?: string;
  wantTests?: boolean;
  todos: string[];
}

export interface Flags {
  update: boolean;
  dryRun: boolean;
  silent: boolean;
  resetProfile: boolean;
}

// ─── Ask Project Questions ────────────────────────────────────────────────────

export async function askProjectQuestions(
  detected: DetectionResult,
  flags: Flags,
  existingAnswers?: Partial<ProjectAnswers>
): Promise<ProjectAnswers> {
  if (flags.silent) {
    return {
      description: existingAnswers?.description ?? '',
      deploymentTarget: existingAnswers?.deploymentTarget ?? 'Unknown',
      architectureRules: existingAnswers?.architectureRules ?? [],
      todos: existingAnswers?.todos ?? [],
    };
  }

  log.section('Project Questions');
  console.log(chalk.dim('  Answer a few questions to improve the generated instructions.\n'));

  // ── 1. What does this project do? ──────────────────────────────────────────
  const { description } = await prompt<{ description: string }>({
    type: 'input',
    name: 'description',
    message: 'What does this project do? (1–2 sentences):',
    initial: existingAnswers?.description ?? '',
    validate: (v: string) =>
      v.trim().length > 0 ? true : 'Please provide a brief description.',
  });

  // ── 2. Deployment target ───────────────────────────────────────────────────
  const deployChoices = [
    'Vercel',
    'VPS / Linux server',
    'Docker / Docker Compose',
    'Railway',
    'Fly.io',
    'Netlify',
    'Cloudflare Pages / Workers',
    'AWS',
    'GCP',
    'Azure',
    'Not sure yet',
  ];

  // Pre-select based on detected CI platforms
  let deployInitial = existingAnswers?.deploymentTarget ?? 'Not sure yet';
  if (detected.ciPlatforms.includes('Vercel')) deployInitial = 'Vercel';
  else if (detected.ciPlatforms.includes('Railway')) deployInitial = 'Railway';
  else if (detected.ciPlatforms.includes('Fly.io')) deployInitial = 'Fly.io';
  else if (detected.ciPlatforms.includes('Netlify')) deployInitial = 'Netlify';
  else if (detected.hasDockerCompose) deployInitial = 'Docker / Docker Compose';

  const { deploymentTarget } = await prompt<{ deploymentTarget: string }>({
    type: 'select',
    name: 'deploymentTarget',
    message: 'What is the deployment target?',
    choices: deployChoices,
    initial: deployInitial,
  });

  // ── 3. Architecture rules ──────────────────────────────────────────────────
  console.log(
    chalk.cyan('\n  Architecture rules') +
      chalk.dim(' Copilot must always follow. One per line, blank to finish:')
  );

  const architectureRules: string[] = existingAnswers?.architectureRules
    ? [...existingAnswers.architectureRules]
    : [];

  let collectingRules = true;
  while (collectingRules) {
    const { rule } = await prompt<{ rule: string }>({
      type: 'input',
      name: 'rule',
      message: `  Rule ${architectureRules.length + 1} (blank to skip):`,
    });
    if (rule.trim() === '') {
      collectingRules = false;
    } else {
      architectureRules.push(rule.trim());
    }
  }

  // ── Conditional: Prisma ────────────────────────────────────────────────────
  let prismaSchemaCommand: string | undefined;
  if (detected.hasPrisma) {
    const { prismaCmd } = await prompt<{ prismaCmd: string }>({
      type: 'input',
      name: 'prismaCmd',
      message: 'How do you apply Prisma schema changes?',
      initial:
        existingAnswers?.prismaSchemaCommand ??
        'npx prisma db push --accept-data-loss',
    });
    prismaSchemaCommand = prismaCmd.trim();
  }

  // ── Conditional: i18n default locale ──────────────────────────────────────
  let i18nDefaultLocale: string | undefined;
  if (detected.hasI18n && detected.i18nLocales.length > 0 && !detected.i18nDefaultLocale) {
    const { defaultLocale } = await prompt<{ defaultLocale: string }>({
      type: 'select',
      name: 'defaultLocale',
      message: 'What is the default locale?',
      choices: detected.i18nLocales,
      initial: existingAnswers?.i18nDefaultLocale ?? detected.i18nLocales[0],
    });
    i18nDefaultLocale = defaultLocale;
  } else {
    i18nDefaultLocale = detected.i18nDefaultLocale ?? existingAnswers?.i18nDefaultLocale;
  }

  // ── Conditional: Monorepo focus ───────────────────────────────────────────
  let monorepoFocus: string | undefined;
  if (detected.isMonorepo && detected.workspaces.length > 0) {
    const { focus } = await prompt<{ focus: string }>({
      type: 'select',
      name: 'focus',
      message: 'Which workspace is the main focus?',
      choices: [...detected.workspaces, 'All workspaces equally'],
      initial: existingAnswers?.monorepoFocus ?? detected.workspaces[0],
    });
    monorepoFocus = focus === 'All workspaces equally' ? undefined : focus;
  }

  // ── Conditional: No test framework ─────────────────────────────────────────
  let wantTests: boolean | undefined;
  if (!detected.testRunner) {
    const { confirmTests } = await prompt<{ confirmTests: boolean }>({
      type: 'confirm',
      name: 'confirmTests',
      message: 'No test framework detected. Should Copilot suggest tests?',
      initial: existingAnswers?.wantTests ?? true,
    });
    wantTests = confirmTests;
  }

  // ── 4. Pending TODOs ───────────────────────────────────────────────────────
  console.log(
    chalk.cyan('\n  Pending TODOs') +
      chalk.dim(' to add to the instructions. One per line, blank to finish:')
  );

  const todos: string[] = [];
  // Preserve existing todos when updating
  if (flags.update && existingAnswers?.todos && existingAnswers.todos.length > 0) {
    log.dim('(Existing TODOs preserved — add new ones below)');
  }

  let collectingTodos = true;
  while (collectingTodos) {
    const { todo } = await prompt<{ todo: string }>({
      type: 'input',
      name: 'todo',
      message: `  TODO ${todos.length + 1} (blank to finish):`,
    });
    if (todo.trim() === '') {
      collectingTodos = false;
    } else {
      todos.push(todo.trim());
    }
  }

  return {
    description: description.trim(),
    deploymentTarget,
    architectureRules,
    prismaSchemaCommand,
    i18nDefaultLocale,
    monorepoFocus,
    wantTests,
    todos,
  };
}
