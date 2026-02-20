import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import ora, { Ora } from 'ora';

// ─── Paths ───────────────────────────────────────────────────────────────────

export const GLOBAL_DIR = path.join(os.homedir(), '.flight-dispatcher');
export const PROFILE_PATH = path.join(GLOBAL_DIR, 'profile.json');
export const OUTPUT_FILE = path.join(process.cwd(), '.github', 'copilot-instructions.md');

// ─── File Helpers ─────────────────────────────────────────────────────────────

export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function readJsonSafe<T>(filePath: string): T | null {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function listDir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

export function cwdFile(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}

export function cwdFileExists(...segments: string[]): boolean {
  return fileExists(cwdFile(...segments));
}

export function cwdReadJson<T>(...segments: string[]): T | null {
  return readJsonSafe<T>(cwdFile(...segments));
}

// ─── Glob-like helpers ────────────────────────────────────────────────────────

/** Find the first matching file from a list of candidates in CWD */
export function findFirst(...candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (cwdFileExists(candidate)) return candidate;
  }
  return null;
}

/** Check if a directory exists in CWD */
export function cwdDirExists(...segments: string[]): boolean {
  const full = cwdFile(...segments);
  try {
    return fs.statSync(full).isDirectory();
  } catch {
    return false;
  }
}

// ─── Terminal Output ──────────────────────────────────────────────────────────

export const log = {
  info: (msg: string) => console.log(chalk.cyan('  ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('  ✔'), msg),
  warn: (msg: string) => console.log(chalk.yellow('  ⚠'), msg),
  error: (msg: string) => console.log(chalk.red('  ✖'), msg),
  section: (title: string) => {
    console.log('');
    console.log(chalk.bold.white(`  ${title}`));
    console.log(chalk.gray('  ' + '─'.repeat(title.length)));
  },
  dim: (msg: string) => console.log(chalk.dim('  ' + msg)),
  blank: () => console.log(''),
};

export function banner(): void {
  console.log('');
  console.log(chalk.bold.blue('  ✈  flight-dispatcher'));
  console.log(chalk.dim('  Auto-generate .github/copilot-instructions.md'));
  console.log('');
}

export function startSpinner(text: string): Ora {
  return ora({ text, color: 'cyan' }).start();
}

export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ─── String Helpers ───────────────────────────────────────────────────────────

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}
