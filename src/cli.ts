#!/usr/bin/env node

import chalk from 'chalk';
import {
  banner,
  log,
  OUTPUT_FILE,
  fileExists,
  readFileSafe,
  writeFile,
  formatDate,
} from './utils';
import {
  loadProfile,
  saveProfile,
  promptForProfile,
  showProfileSummary,
  offerProfileEdit,
  type Profile,
} from './profile';
import { detect } from './detector';
import { askProjectQuestions } from './prompts';
import { generate } from './generator';
import { merge, extractPreservedData, updateTimestamp } from './merger';
import { askHookQuestions, writeHooks } from './hooks';
import type { Flags } from './prompts';

// ─── Default Profile ─────────────────────────────────────────────────────────

function createDefaultProfile(): Profile {
  const now = new Date().toISOString();
  return {
    languagePreference: 'TypeScript',
    codeStyle: { indentation: '2spaces', quotes: 'single', semicolons: false },
    commitStyle: 'conventional',
    verbosity: 'concise',
    customRules: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Parse CLI Flags ──────────────────────────────────────────────────────────

function parseFlags(argv: string[]): Flags {
  return {
    update: argv.includes('--update'),
    dryRun: argv.includes('--dry-run'),
    silent: argv.includes('--silent'),
    resetProfile: argv.includes('--reset-profile'),
  };
}

function printHelp(): void {
  console.log(`
${chalk.bold.blue('flight-dispatcher')} — Generate .github/copilot-instructions.md

${chalk.bold('Usage:')}
  npx flight-dispatcher              Standard run (profile + detect + questions)
  npx flight-dispatcher --update     Re-detect + merge, preserve manual edits
  npx flight-dispatcher --reset-profile  Redo global developer profile
  npx flight-dispatcher --dry-run    Preview output without writing anything
  npx flight-dispatcher --silent     No questions, auto-detect only
  npx flight-dispatcher --help       Show this help

${chalk.bold('Output:')}
  .github/copilot-instructions.md

${chalk.bold('Global profile:')}
  ~/.flight-dispatcher/profile.json
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const flags = parseFlags(argv);

  banner();

  // ── Step 1: Load / Create Profile ─────────────────────────────────────────
  let profile = loadProfile();

  if (flags.resetProfile && !flags.silent) {
    log.info('Resetting developer profile...');
    log.blank();
    profile = await promptForProfile(profile ?? undefined);
    saveProfile(profile);
    log.success('Profile saved to ~/.flight-dispatcher/profile.json');
    log.blank();
  } else if (!profile) {
    if (flags.silent) {
      // Create a sensible default profile without prompting
      profile = createDefaultProfile();
      saveProfile(profile);
      log.info('No profile found — using defaults (run without --silent to configure).');
      log.blank();
    } else {
      log.info('No developer profile found. Let\'s set one up (one-time only).');
      log.blank();
      profile = await promptForProfile(undefined);
      saveProfile(profile);
      log.success('Profile saved to ~/.flight-dispatcher/profile.json');
      log.blank();
    }
  } else {
    showProfileSummary(profile);
    if (!flags.update && !flags.silent) {
      profile = await offerProfileEdit(profile);
      if (profile) saveProfile(profile);
    }
  }

  // ── Step 2: Detect Project ─────────────────────────────────────────────────
  log.section('Detecting Project');
  const spinner = (await import('ora')).default('Scanning project...').start();

  const detected = detect();
  spinner.stop();

  // Show detection summary
  log.success(`Project: ${chalk.bold(detected.projectName)}`);
  log.success(`Language: ${detected.primaryLanguage}`);
  if (detected.frameworks.length > 0) {
    log.success(`Frameworks: ${detected.frameworks.join(', ')}`);
  }
  if (detected.backendFrameworks.length > 0) {
    log.success(`Backend: ${detected.backendFrameworks.join(', ')}`);
  }
  if (detected.hasPrisma) {
    log.success(
      `Prisma: ${detected.prismaDbProvider ?? 'detected'}${
        detected.prismaModels.length > 0
          ? ` (${detected.prismaModels.length} models)`
          : ''
      }`
    );
  }
  if (detected.hasI18n) {
    log.success(
      `i18n: ${detected.i18nLocales.length > 0 ? detected.i18nLocales.join(', ') : 'detected'}`
    );
  }
  if (detected.testRunner) log.success(`Tests: ${detected.testRunner}`);
  if (detected.hasDockerCompose) log.success('Docker Compose: detected');
  log.blank();

  // ── Step 3: Extract existing data if updating ──────────────────────────────
  let existingContent: string | null = null;
  let preserved = {
    description: '',
    architectureRules: [] as string[],
    standingOrders: [] as string[],
    todos: [] as string[],
  };

  if (flags.update && fileExists(OUTPUT_FILE)) {
    existingContent = readFileSafe(OUTPUT_FILE);
    if (existingContent) {
      preserved = extractPreservedData(existingContent);
      log.info('Found existing copilot-instructions.md — preserved sections will be kept.');
      log.blank();
    }
  }

  // ── Step 4: Ask Questions ──────────────────────────────────────────────────
  const answers = await askProjectQuestions(detected, flags, preserved);
  log.blank();
  // ── Step 4.5: Git Hook Automations ────────────────────────────────────────────
  const hooksConfig = await askHookQuestions(detected.availableScripts, flags);
  log.blank();
  // ── Step 5: Generate ───────────────────────────────────────────────────────
  log.section('Generating Instructions');
  const generated = generate(profile, detected, answers, hooksConfig);

  // ── Step 6: Merge (if existing file) ─────────────────────────────────────
  let finalContent: string;
  if (existingContent && flags.update) {
    finalContent = merge(existingContent, generated);
    finalContent = updateTimestamp(finalContent, formatDate());
    log.success('Merged with existing file (preserved: About, Architecture Rules, Copilot Behavior, TODOs)');
  } else {
    finalContent = generated;
  }

  // ── Step 7: Output ─────────────────────────────────────────────────────────
  if (flags.dryRun) {
    log.section('Preview (--dry-run, nothing written)');
    console.log('');
    console.log(chalk.dim('─'.repeat(60)));
    console.log(finalContent);
    console.log(chalk.dim('─'.repeat(60)));
    console.log('');
    log.info('Use without --dry-run to write the file.');
  } else {
    writeFile(OUTPUT_FILE, finalContent);
    log.success(`Written to ${chalk.bold('.github/copilot-instructions.md')}`);
    if (hooksConfig.hooks.length > 0) {
      writeHooks(hooksConfig);
    }
    log.blank();
    log.dim('Open VS Code → Copilot Chat → your project context is now active.');
    log.dim('Re-run `npx flight-dispatcher --update` as your project evolves.');
  }

  log.blank();
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err: Error) => {
  if (err.message?.includes('canceled') || err.message?.includes('cancelled')) {
    // User pressed Ctrl+C
    console.log('\n');
    log.warn('Aborted by user.');
    process.exit(0);
  }
  console.error(chalk.red('\nError:'), err.message ?? err);
  process.exit(1);
});
