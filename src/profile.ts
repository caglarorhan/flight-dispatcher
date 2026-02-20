import chalk from 'chalk';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prompt } = require('enquirer') as { prompt: <T>(opts: Record<string, unknown>) => Promise<T> };
import {
  PROFILE_PATH,
  GLOBAL_DIR,
  readJsonSafe,
  writeFile,
  ensureDir,
  log,
} from './utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeStyle {
  indentation: 'tabs' | '2spaces' | '4spaces';
  quotes: 'single' | 'double';
  semicolons: boolean;
}

export interface Profile {
  name?: string;
  pronouns?: string;
  languagePreference: string;
  codeStyle: CodeStyle;
  testFramework?: string;
  verbosity: 'concise' | 'detailed';
  customRules: string[];
  commentStyle?: string;
  commitStyle: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

export function loadProfile(): Profile | null {
  return readJsonSafe<Profile>(PROFILE_PATH);
}

export function saveProfile(profile: Profile): void {
  ensureDir(GLOBAL_DIR);
  profile.updatedAt = new Date().toISOString();
  writeFile(PROFILE_PATH, JSON.stringify(profile, null, 2));
}

// ─── Display ──────────────────────────────────────────────────────────────────

export function showProfileSummary(profile: Profile): void {
  log.section('Developer Profile (loaded from ~/.flight-dispatcher/profile.json)');
  if (profile.name) log.dim(`Name:        ${profile.name}`);
  log.dim(`Language:    ${profile.languagePreference}`);
  log.dim(
    `Code style:  ${profile.codeStyle.indentation}, ${profile.codeStyle.quotes} quotes, ${
      profile.codeStyle.semicolons ? 'semicolons' : 'no semicolons'
    }`
  );
  log.dim(`Commits:     ${profile.commitStyle}`);
  log.dim(`Verbosity:   ${profile.verbosity}`);
  if (profile.testFramework) log.dim(`Tests:       ${profile.testFramework}`);
  if (profile.customRules.length > 0) {
    log.dim(`Custom rules: ${profile.customRules.length} rule(s)`);
  }
  log.blank();
}

// ─── Interactive Setup ────────────────────────────────────────────────────────

export async function promptForProfile(existing?: Profile): Promise<Profile> {
  log.section('Developer Profile Setup');
  console.log(
    chalk.dim('  This is saved globally and reused across all projects.\n')
  );

  const now = new Date().toISOString();

  // Name
  const { name } = await prompt<{ name: string }>({
    type: 'input',
    name: 'name',
    message: 'Your name (optional, used for instructions tone):',
    initial: existing?.name ?? '',
  });

  // Language
  const { languagePreference } = await prompt<{ languagePreference: string }>({
    type: 'select',
    name: 'languagePreference',
    message: 'Preferred primary language:',
    choices: [
      'TypeScript',
      'JavaScript',
      'Python',
      'Go',
      'Rust',
      'PHP',
      'Ruby',
      'Java',
      'Kotlin',
      'Other',
    ],
    initial: existing?.languagePreference ?? 'TypeScript',
  });

  // Indentation
  const { indentation } = await prompt<{ indentation: CodeStyle['indentation'] }>({
    type: 'select',
    name: 'indentation',
    message: 'Indentation style:',
    choices: [
      { name: '2spaces', message: '2 spaces' },
      { name: '4spaces', message: '4 spaces' },
      { name: 'tabs', message: 'Tabs' },
    ],
    initial: existing?.codeStyle?.indentation ?? '2spaces',
  });

  // Quotes
  const { quotes } = await prompt<{ quotes: CodeStyle['quotes'] }>({
    type: 'select',
    name: 'quotes',
    message: 'Quote style:',
    choices: [
      { name: 'single', message: "Single quotes (')" },
      { name: 'double', message: 'Double quotes (")' },
    ],
    initial: existing?.codeStyle?.quotes ?? 'single',
  });

  // Semicolons
  const { semicolons } = await prompt<{ semicolons: boolean }>({
    type: 'confirm',
    name: 'semicolons',
    message: 'Use semicolons?',
    initial: existing?.codeStyle?.semicolons ?? false,
  });

  // Test framework
  const { testFramework } = await prompt<{ testFramework: string }>({
    type: 'select',
    name: 'testFramework',
    message: 'Preferred test framework:',
    choices: [
      'Jest',
      'Vitest',
      'Mocha',
      'pytest',
      'Go test',
      'RSpec',
      'PHPUnit',
      'None / Not sure',
    ],
    initial: existing?.testFramework ?? 'Vitest',
  });

  // Commit style
  const { commitStyle } = await prompt<{ commitStyle: string }>({
    type: 'select',
    name: 'commitStyle',
    message: 'Git commit style:',
    choices: [
      {
        name: 'conventional',
        message: 'Conventional commits (feat:, fix:, chore:...)',
      },
      { name: 'freeform', message: 'Freeform / descriptive' },
    ],
    initial: existing?.commitStyle ?? 'conventional',
  });

  // Verbosity
  const { verbosity } = await prompt<{ verbosity: Profile['verbosity'] }>({
    type: 'select',
    name: 'verbosity',
    message: 'Copilot explanation verbosity:',
    choices: [
      {
        name: 'concise',
        message: 'Concise — minimal explanation, focus on code',
      },
      {
        name: 'detailed',
        message: 'Detailed — explain reasoning and patterns',
      },
    ],
    initial: existing?.verbosity ?? 'concise',
  });

  // Comment style
  const { commentStyle } = await prompt<{ commentStyle: string }>({
    type: 'select',
    name: 'commentStyle',
    message: 'Comment style preference:',
    choices: [
      'Inline comments for complex logic only',
      'JSDoc/docstrings on all public functions',
      'Minimal — self-documenting code preferred',
      'Verbose — comment everything',
    ],
    initial: existing?.commentStyle ?? 'Inline comments for complex logic only',
  });

  // Custom rules
  console.log(
    chalk.cyan('\n  Custom global rules') +
      chalk.dim(' (e.g. "Never use `any` in TypeScript"). One per line, blank to finish:')
  );
  const customRules: string[] = existing?.customRules ? [...existing.customRules] : [];
  let collectingRules = true;
  while (collectingRules) {
    const { rule } = await prompt<{ rule: string }>({
      type: 'input',
      name: 'rule',
      message: `  Rule ${customRules.length + 1} (blank to finish):`,
    });
    if (rule.trim() === '') {
      collectingRules = false;
    } else {
      customRules.push(rule.trim());
    }
  }

  const profile: Profile = {
    name: name.trim() || undefined,
    languagePreference,
    codeStyle: { indentation, quotes, semicolons },
    testFramework: testFramework === 'None / Not sure' ? undefined : testFramework,
    commitStyle,
    verbosity,
    commentStyle,
    customRules,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  return profile;
}

// ─── Edit Existing ────────────────────────────────────────────────────────────

export async function offerProfileEdit(profile: Profile): Promise<Profile> {
  const { shouldEdit } = await prompt<{ shouldEdit: boolean }>({
    type: 'confirm',
    name: 'shouldEdit',
    message: 'Edit developer profile?',
    initial: false,
  });

  if (shouldEdit) {
    return promptForProfile(profile);
  }
  return profile;
}
