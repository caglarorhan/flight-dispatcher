import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import {
  cwdFileExists,
  cwdReadJson,
  cwdDirExists,
  cwdFile,
  findFirst,
  listDir,
  readFileSafe,
} from './utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectionResult {
  // Identity
  projectName: string;
  primaryLanguage: string;

  // JavaScript / TypeScript
  hasPackageJson: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
  nodeVersion?: string;
  hasTypeScript: boolean;
  tsStrictMode: boolean;
  tsPathAliases: string[];

  // Frameworks & Libraries
  frameworks: string[];
  libraries: string[];
  uiLibraries: string[];
  stateManagement: string[];

  // Next.js specifics
  hasNextJs: boolean;
  nextVersion?: string;
  nextRouter?: 'app' | 'pages' | 'both';
  nextFeatures: string[];

  // Backend
  backendFrameworks: string[];

  // Database & ORM
  hasPrisma: boolean;
  prismaDbProvider?: string;
  prismaModels: string[];
  hasDrizzle: boolean;
  databaseType?: string;

  // Testing
  testRunner?: string;
  testConfig?: string;

  // Tooling
  hasEslint: boolean;
  hasPrettier: boolean;
  prettierRules: Record<string, unknown>;
  hasTailwind: boolean;
  hasBiome: boolean;

  // Build
  buildTool?: string;
  hasVite: boolean;
  hasDockerCompose: boolean;
  dockerServices: string[];

  // Auth & Storage
  authType?: string;

  // i18n
  hasI18n: boolean;
  i18nLocales: string[];
  i18nDefaultLocale?: string;

  // Project structure
  projectStructure: Array<{ path: string; description: string }>;
  isMonorepo: boolean;
  workspaces: string[];

  // CI/CD
  hasCI: boolean;
  ciPlatforms: string[];

  // Git
  gitRemote?: string;
  gitRepoName?: string;
  commitStyleDetected?: string;

  // npm scripts
  availableScripts: string[];

  // Environment
  envVars: string[];

  // Other languages
  pythonStack: string[];
  phpStack: string[];
  goModules: string[];
  rustCrates: string[];
  rubyStack: string[];
  javaStack: string[];
}

// ─── Main Detect ─────────────────────────────────────────────────────────────

export function detect(): DetectionResult {
  const result: DetectionResult = {
    projectName: path.basename(process.cwd()),
    primaryLanguage: 'Unknown',
    hasPackageJson: false,
    packageManager: null,
    hasTypeScript: false,
    tsStrictMode: false,
    tsPathAliases: [],
    frameworks: [],
    libraries: [],
    uiLibraries: [],
    stateManagement: [],
    hasNextJs: false,
    nextFeatures: [],
    backendFrameworks: [],
    hasPrisma: false,
    prismaModels: [],
    hasDrizzle: false,
    hasEslint: false,
    hasPrettier: false,
    prettierRules: {},
    hasTailwind: false,
    hasBiome: false,
    hasVite: false,
    hasDockerCompose: false,
    dockerServices: [],
    hasI18n: false,
    i18nLocales: [],
    projectStructure: [],
    isMonorepo: false,
    workspaces: [],
    hasCI: false,
    ciPlatforms: [],
    envVars: [],
    pythonStack: [],
    phpStack: [],
    goModules: [],
    rustCrates: [],
    rubyStack: [],
    javaStack: [],
    availableScripts: [],
  };

  detectLanguages(result);
  detectPackageJson(result);
  detectTypeScript(result);
  detectNextJs(result);
  detectPrisma(result);
  detectDrizzle(result);
  detectTooling(result);
  detectDocker(result);
  detectI18n(result);
  detectProjectStructure(result);
  detectCI(result);
  detectGit(result);
  detectEnvVars(result);
  determinePrimaryLanguage(result);

  return result;
}

// ─── Language Detection ───────────────────────────────────────────────────────

function detectLanguages(result: DetectionResult): void {
  // Python
  if (
    cwdFileExists('requirements.txt') ||
    cwdFileExists('pyproject.toml') ||
    cwdFileExists('setup.py') ||
    cwdFileExists('Pipfile')
  ) {
    const pyDeps = collectPythonDeps();
    result.pythonStack = pyDeps;
    if (result.primaryLanguage === 'Unknown') result.primaryLanguage = 'Python';
  }

  // PHP
  if (cwdFileExists('composer.json')) {
    const composer = cwdReadJson<{ require?: Record<string, string> }>('composer.json');
    if (composer?.require) {
      if ('laravel/framework' in composer.require) result.phpStack.push('Laravel');
      if ('symfony/symfony' in composer.require) result.phpStack.push('Symfony');
      if ('slim/slim' in composer.require) result.phpStack.push('Slim');
    }
    if (result.primaryLanguage === 'Unknown') result.primaryLanguage = 'PHP';
  }

  // Go
  if (cwdFileExists('go.mod')) {
    const goMod = readFileSafe(cwdFile('go.mod'));
    if (goMod) {
      const matches = goMod.match(/^require\s*\(([^)]+)\)/ms);
      if (matches) {
        const lines = matches[1].split('\n').map((l) => l.trim()).filter(Boolean);
        result.goModules = lines.slice(0, 10);
      }
    }
    if (result.primaryLanguage === 'Unknown') result.primaryLanguage = 'Go';
  }

  // Rust
  if (cwdFileExists('Cargo.toml')) {
    const cargo = readFileSafe(cwdFile('Cargo.toml'));
    if (cargo) {
      const depMatch = cargo.match(/\[dependencies\]([\s\S]*?)(\[|\z)/);
      if (depMatch) {
        const crates = depMatch[1]
          .split('\n')
          .map((l) => l.split('=')[0].trim())
          .filter(Boolean)
          .slice(0, 8);
        result.rustCrates = crates;
      }
    }
    if (result.primaryLanguage === 'Unknown') result.primaryLanguage = 'Rust';
  }

  // Ruby
  if (cwdFileExists('Gemfile')) {
    const gemfile = readFileSafe(cwdFile('Gemfile')) ?? '';
    if (gemfile.includes("gem 'rails'") || gemfile.includes('gem "rails"'))
      result.rubyStack.push('Rails');
    if (gemfile.includes("gem 'sinatra'") || gemfile.includes('gem "sinatra"'))
      result.rubyStack.push('Sinatra');
    if (result.primaryLanguage === 'Unknown') result.primaryLanguage = 'Ruby';
  }

  // Java / Kotlin
  if (cwdFileExists('pom.xml') || cwdFileExists('build.gradle') || cwdFileExists('build.gradle.kts')) {
    const pomContent = readFileSafe(cwdFile('pom.xml')) ?? '';
    const gradleContent =
      readFileSafe(cwdFile('build.gradle')) ??
      readFileSafe(cwdFile('build.gradle.kts')) ??
      '';
    const combined = pomContent + gradleContent;
    if (combined.includes('spring-boot') || combined.includes('spring-framework'))
      result.javaStack.push('Spring Boot');
    if (combined.includes('quarkus')) result.javaStack.push('Quarkus');
    if (combined.includes('micronaut')) result.javaStack.push('Micronaut');
    if (cwdFileExists('build.gradle.kts') || combined.includes('kotlin'))
      result.primaryLanguage = 'Kotlin';
    else if (result.primaryLanguage === 'Unknown') result.primaryLanguage = 'Java';
  }
}

function collectPythonDeps(): string[] {
  const stacks: string[] = [];
  const reqFile = readFileSafe(cwdFile('requirements.txt'));
  const pyproject = readFileSafe(cwdFile('pyproject.toml'));
  const combined = (reqFile ?? '') + (pyproject ?? '');

  const checks: [string | RegExp, string][] = [
    ['django', 'Django'],
    ['fastapi', 'FastAPI'],
    ['flask', 'Flask'],
    ['sqlalchemy', 'SQLAlchemy'],
    ['alembic', 'Alembic'],
    ['pydantic', 'Pydantic'],
    ['celery', 'Celery'],
    ['pytest', 'pytest'],
    ['uvicorn', 'Uvicorn'],
    ['gunicorn', 'Gunicorn'],
    ['asyncpg', 'asyncpg (PostgreSQL)'],
    ['psycopg', 'psycopg (PostgreSQL)'],
    ['redis', 'Redis'],
    ['httpx', 'HTTPX'],
    ['requests', 'Requests'],
  ];

  for (const [pattern, label] of checks) {
    const lower = combined.toLowerCase();
    if (
      typeof pattern === 'string'
        ? lower.includes(pattern)
        : pattern.test(lower)
    ) {
      stacks.push(label);
    }
  }
  return stacks;
}

// ─── Package.json Detection ────────────────────────────────────────────────────

interface PackageJson {
  name?: string;
  version?: string;
  engines?: { node?: string };
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function detectPackageJson(result: DetectionResult): void {
  if (!cwdFileExists('package.json')) return;
  result.hasPackageJson = true;

  const pkg = cwdReadJson<PackageJson>('package.json');
  if (!pkg) return;

  if (pkg.name) result.projectName = pkg.name;
  if (pkg.engines?.node) result.nodeVersion = pkg.engines.node;

  // Available npm scripts
  if (pkg.scripts) {
    result.availableScripts = Object.keys(pkg.scripts);
  }

  // Package manager
  if (cwdFileExists('pnpm-lock.yaml')) result.packageManager = 'pnpm';
  else if (cwdFileExists('yarn.lock')) result.packageManager = 'yarn';
  else if (cwdFileExists('bun.lockb')) result.packageManager = 'bun';
  else if (cwdFileExists('package-lock.json')) result.packageManager = 'npm';

  // Monorepo
  if (pkg.workspaces) {
    result.isMonorepo = true;
    if (Array.isArray(pkg.workspaces)) {
      result.workspaces = pkg.workspaces;
    } else if (pkg.workspaces.packages) {
      result.workspaces = pkg.workspaces.packages;
    }
  }
  if (cwdFileExists('turbo.json') || cwdFileExists('nx.json') || cwdFileExists('lerna.json')) {
    result.isMonorepo = true;
  }

  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  classifyDependencies(allDeps, result);
}

function classifyDependencies(
  deps: Record<string, string>,
  result: DetectionResult
): void {
  const has = (name: string) => name in deps;

  // TypeScript
  if (has('typescript') || has('@types/node')) {
    result.hasTypeScript = true;
    result.primaryLanguage = 'TypeScript';
  } else if (result.primaryLanguage === 'Unknown' && result.hasPackageJson) {
    result.primaryLanguage = 'JavaScript';
  }

  // Next.js
  if (has('next')) {
    result.hasNextJs = true;
    result.nextVersion = deps['next'];
    result.frameworks.push(`Next.js ${deps['next'] ?? ''}`);
  }

  // React
  if (has('react')) {
    const ver = deps['react'];
    result.uiLibraries.push(`React ${ver ?? ''}`);
  }

  // Vue
  if (has('vue')) result.uiLibraries.push(`Vue ${deps['vue'] ?? ''}`);

  // Svelte
  if (has('svelte') || has('@sveltejs/kit')) {
    result.frameworks.push('SvelteKit');
    result.primaryLanguage = result.hasTypeScript ? 'TypeScript' : 'JavaScript';
  }

  // Remix
  if (has('@remix-run/node') || has('@remix-run/react')) {
    result.frameworks.push('Remix');
  }

  // Astro
  if (has('astro')) result.frameworks.push('Astro');

  // Backend
  if (has('express')) result.backendFrameworks.push('Express');
  if (has('fastify')) result.backendFrameworks.push('Fastify');
  if (has('@nestjs/core')) result.backendFrameworks.push('NestJS');
  if (has('hono')) result.backendFrameworks.push('Hono');
  if (has('koa')) result.backendFrameworks.push('Koa');
  if (has('elysia')) result.backendFrameworks.push('Elysia (Bun)');

  // ORM / DB
  if (has('@prisma/client') || has('prisma')) result.hasPrisma = true;
  if (has('drizzle-orm')) result.hasDrizzle = true;
  if (has('mongoose')) result.libraries.push('Mongoose (MongoDB)');
  if (has('sequelize')) result.libraries.push('Sequelize');
  if (has('typeorm')) result.libraries.push('TypeORM');
  if (has('kysely')) result.libraries.push('Kysely');

  // Auth
  if (has('next-auth') || has('@auth/core')) result.authType = 'NextAuth.js';
  else if (has('lucia')) result.authType = 'Lucia';
  else if (has('@clerk/nextjs') || has('@clerk/clerk-sdk-node')) result.authType = 'Clerk';
  else if (has('better-auth')) result.authType = 'Better Auth';

  // Validation
  if (has('zod')) result.libraries.push('Zod');
  if (has('yup')) result.libraries.push('Yup');
  if (has('valibot')) result.libraries.push('Valibot');

  // API
  if (has('@trpc/server') || has('@trpc/client')) result.libraries.push('tRPC');
  if (has('@tanstack/react-query') || has('react-query'))
    result.libraries.push('TanStack Query');

  // Styling
  if (has('tailwindcss')) result.hasTailwind = true;
  if (has('@mui/material') || has('@material-ui/core'))
    result.uiLibraries.push('Material UI');
  if (has('@chakra-ui/react')) result.uiLibraries.push('Chakra UI');
  if (has('@radix-ui/react-dialog') || has('@radix-ui/themes'))
    result.uiLibraries.push('Radix UI');
  if (has('shadcn-ui') || has('@shadcn/ui')) result.uiLibraries.push('shadcn/ui');

  // State
  if (has('zustand')) result.stateManagement.push('Zustand');
  if (has('jotai')) result.stateManagement.push('Jotai');
  if (has('@reduxjs/toolkit') || has('redux')) result.stateManagement.push('Redux Toolkit');
  if (has('mobx')) result.stateManagement.push('MobX');

  // Testing
  if (has('vitest')) result.testRunner = 'Vitest';
  else if (has('jest')) result.testRunner = 'Jest';
  else if (has('mocha')) result.testRunner = 'Mocha';
  else if (has('@playwright/test')) result.testRunner = 'Playwright';
  else if (has('cypress')) result.testRunner = 'Cypress';

  // Build tools
  if (has('vite') || has('@vitejs/plugin-react')) {
    result.hasVite = true;
    result.buildTool = 'Vite';
  }
  if (has('esbuild') && !result.buildTool) result.buildTool = 'esbuild';
  if (has('@swc/core') || has('@swc/cli')) {
    result.libraries.push('SWC');
  }
  if (has('turbopack')) result.buildTool = 'Turbopack';

  // i18n
  if (has('next-intl')) {
    result.hasI18n = true;
    result.libraries.push('next-intl');
  }
  if (has('i18next') || has('react-i18next')) {
    result.hasI18n = true;
    result.libraries.push('i18next');
  }
  if (has('@formatjs/intl')) {
    result.hasI18n = true;
  }

  // Other notable libs
  if (has('stripe')) result.libraries.push('Stripe');
  if (has('resend')) result.libraries.push('Resend (email)');
  if (has('nodemailer')) result.libraries.push('Nodemailer');
  if (has('ioredis') || has('redis')) result.libraries.push('Redis client');
  if (has('axios')) result.libraries.push('Axios');
  if (has('sharp')) result.libraries.push('Sharp (image processing)');
  if (has('uploadthing')) result.libraries.push('UploadThing');
  if (has('@aws-sdk/client-s3') || has('aws-sdk')) result.libraries.push('AWS SDK');
  if (has('openai')) result.libraries.push('OpenAI SDK');
  if (has('@anthropic-ai/sdk')) result.libraries.push('Anthropic SDK');

  // Linting / formatting
  if (has('eslint') || has('@eslint/js')) result.hasEslint = true;
  if (has('prettier')) result.hasPrettier = true;
  if (has('@biomejs/biome')) result.hasBiome = true;
}

// ─── TypeScript Config ────────────────────────────────────────────────────────

interface TsConfig {
  compilerOptions?: {
    strict?: boolean;
    paths?: Record<string, string[]>;
    baseUrl?: string;
    noImplicitAny?: boolean;
    strictNullChecks?: boolean;
  };
}

function detectTypeScript(result: DetectionResult): void {
  const tsConfig = cwdReadJson<TsConfig>('tsconfig.json');
  if (!tsConfig) return;

  result.hasTypeScript = true;
  if (result.primaryLanguage === 'Unknown' || result.primaryLanguage === 'JavaScript') {
    result.primaryLanguage = 'TypeScript';
  }

  const opts = tsConfig.compilerOptions ?? {};
  result.tsStrictMode = opts.strict === true || (opts.noImplicitAny === true && opts.strictNullChecks === true);

  if (opts.paths) {
    result.tsPathAliases = Object.keys(opts.paths).slice(0, 8);
  }
}

// ─── Next.js Detection ────────────────────────────────────────────────────────

function detectNextJs(result: DetectionResult): void {
  if (!result.hasNextJs) return;

  // Router detection
  const hasApp = cwdDirExists('src', 'app') || cwdDirExists('app');
  const hasPages = cwdDirExists('src', 'pages') || cwdDirExists('pages');

  if (hasApp && hasPages) result.nextRouter = 'both';
  else if (hasApp) result.nextRouter = 'app';
  else if (hasPages) result.nextRouter = 'pages';

  // Next config features
  const nextCfgFile = findFirst('next.config.ts', 'next.config.mjs', 'next.config.js');
  if (nextCfgFile) {
    const content = readFileSafe(cwdFile(nextCfgFile)) ?? '';
    if (content.includes('i18n')) result.nextFeatures.push('i18n config');
    if (content.includes('experimental')) result.nextFeatures.push('experimental features');
    if (content.includes('images')) result.nextFeatures.push('image optimization');
    if (content.includes('rewrites') || content.includes('redirects'))
      result.nextFeatures.push('custom routes');
  }
}

// ─── Prisma Detection ─────────────────────────────────────────────────────────

function detectPrisma(result: DetectionResult): void {
  if (!result.hasPrisma && !cwdFileExists('prisma', 'schema.prisma')) return;
  result.hasPrisma = true;

  const schemaPath = cwdFile('prisma', 'schema.prisma');
  const schema = readFileSafe(schemaPath);
  if (!schema) return;

  // DB provider
  const providerMatch = schema.match(/provider\s*=\s*["']([^"']+)["']/);
  if (providerMatch) result.prismaDbProvider = providerMatch[1];

  // Model names
  const modelMatches = schema.matchAll(/^model\s+(\w+)\s*\{/gm);
  result.prismaModels = Array.from(modelMatches, (m) => m[1]).slice(0, 15);
}

// ─── Drizzle Detection ────────────────────────────────────────────────────────

function detectDrizzle(result: DetectionResult): void {
  if (!result.hasDrizzle) return;
  const config = findFirst('drizzle.config.ts', 'drizzle.config.js');
  if (config) {
    const content = readFileSafe(cwdFile(config)) ?? '';
    if (content.includes('postgres') || content.includes('pg')) result.databaseType = 'PostgreSQL';
    else if (content.includes('mysql')) result.databaseType = 'MySQL';
    else if (content.includes('sqlite')) result.databaseType = 'SQLite';
  }
}

// ─── Tooling Detection ────────────────────────────────────────────────────────

function detectTooling(result: DetectionResult): void {
  // Prettier
  if (!result.hasPrettier) {
    const prettierFile = findFirst(
      '.prettierrc',
      '.prettierrc.json',
      '.prettierrc.js',
      '.prettierrc.cjs',
      '.prettierrc.yaml',
      '.prettierrc.yml',
      'prettier.config.js',
      'prettier.config.cjs',
      'prettier.config.ts'
    );
    if (prettierFile) result.hasPrettier = true;
  }

  // Read prettier rules
  const prettierFile = findFirst('.prettierrc', '.prettierrc.json');
  if (prettierFile) {
    const rules = cwdReadJson<Record<string, unknown>>(prettierFile);
    if (rules) result.prettierRules = rules;
  }

  // ESLint
  if (!result.hasEslint) {
    const eslintFile = findFirst(
      '.eslintrc',
      '.eslintrc.json',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.yaml',
      '.eslintrc.yml',
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      'eslint.config.ts'
    );
    if (eslintFile) result.hasEslint = true;
  }

  // Tailwind
  if (!result.hasTailwind) {
    const tailwindFile = findFirst(
      'tailwind.config.js',
      'tailwind.config.ts',
      'tailwind.config.cjs',
      'tailwind.config.mjs'
    );
    if (tailwindFile) result.hasTailwind = true;
  }

  // Vite
  if (!result.hasVite) {
    const viteFile = findFirst(
      'vite.config.ts',
      'vite.config.js',
      'vite.config.mts'
    );
    if (viteFile) {
      result.hasVite = true;
      if (!result.buildTool) result.buildTool = 'Vite';
    }
  }

  // Test config
  const testConfigFile = findFirst(
    'jest.config.ts',
    'jest.config.js',
    'jest.config.cjs',
    'vitest.config.ts',
    'vitest.config.js'
  );
  if (testConfigFile) result.testConfig = testConfigFile;
}

// ─── Docker Detection ─────────────────────────────────────────────────────────

function detectDocker(result: DetectionResult): void {
  const composeFile = findFirst(
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml'
  );
  if (!composeFile) return;

  result.hasDockerCompose = true;
  const content = readFileSafe(cwdFile(composeFile)) ?? '';

  // Detect services
  const serviceMatches = content.matchAll(/^\s{2}(\w[\w-]+):\s*$/gm);
  const services = Array.from(serviceMatches, (m) => m[1]).filter(
    (s) => !['services', 'volumes', 'networks'].includes(s)
  );
  result.dockerServices = services;

  // Infer DB type
  if (content.includes('postgres')) result.databaseType = result.databaseType ?? 'PostgreSQL';
  if (content.includes('mysql') || content.includes('mariadb'))
    result.databaseType = result.databaseType ?? 'MySQL';
  if (content.includes('redis')) result.libraries.push('Redis');
  if (content.includes('mongodb')) result.databaseType = result.databaseType ?? 'MongoDB';
}

// ─── i18n Detection ───────────────────────────────────────────────────────────

function detectI18n(result: DetectionResult): void {
  // next-intl message files pattern: messages/*.json
  const messagesDir = cwdFile('messages');
  if (fs.existsSync(messagesDir) && fs.statSync(messagesDir).isDirectory()) {
    const files = listDir(messagesDir).filter((f) => f.endsWith('.json'));
    if (files.length > 0) {
      result.hasI18n = true;
      result.i18nLocales = files.map((f) => f.replace('.json', ''));
    }
  }

  // locales dir pattern
  const localesDir = cwdFile('locales');
  if (!result.hasI18n && fs.existsSync(localesDir) && fs.statSync(localesDir).isDirectory()) {
    const files = listDir(localesDir);
    if (files.length > 0) {
      result.hasI18n = true;
      result.i18nLocales = files
        .filter((f) => f.endsWith('.json') || fs.statSync(path.join(localesDir, f)).isDirectory())
        .map((f) => f.replace('.json', ''));
    }
  }

  // Detect default locale from Next.js config or next-intl config
  const nextIntlConfigFile = findFirst('i18n.ts', 'i18n.js', 'i18n/request.ts');
  if (nextIntlConfigFile) {
    const content = readFileSafe(cwdFile(nextIntlConfigFile)) ?? '';
    const defaultMatch = content.match(/defaultLocale['":\s]+['"]([a-z]{2}(-[A-Z]{2})?)['"]/);
    if (defaultMatch) result.i18nDefaultLocale = defaultMatch[1];
  }
}

// ─── Project Structure ────────────────────────────────────────────────────────

function detectProjectStructure(result: DetectionResult): void {
  const structureMap: Array<{ path: string; description: string }> = [];

  const interesting: Array<[string, string]> = [
    ['src/app', 'Next.js App Router pages and layouts'],
    ['app', 'Next.js App Router pages and layouts'],
    ['src/pages', 'Next.js Pages Router'],
    ['pages', 'Next.js Pages Router'],
    ['src/components', 'Shared React components'],
    ['components', 'Shared React components'],
    ['src/lib', 'Utility functions and helpers'],
    ['lib', 'Utility functions and helpers'],
    ['src/hooks', 'Custom React hooks'],
    ['src/api', 'API routes / server handlers'],
    ['src/server', 'Server-side code'],
    ['src/utils', 'Utility functions'],
    ['src/types', 'TypeScript type definitions'],
    ['src/styles', 'Global styles'],
    ['src/context', 'React contexts / providers'],
    ['src/store', 'State management'],
    ['src/config', 'Configuration files'],
    ['src/services', 'Service layer / external API clients'],
    ['src/middleware', 'Middleware functions'],
    ['prisma', 'Prisma schema and migrations'],
    ['public', 'Static assets'],
    ['messages', 'i18n translation files'],
    ['locales', 'i18n translation files'],
    ['scripts', 'Build and utility scripts'],
    ['docs', 'Documentation'],
    ['tests', 'Test files'],
    ['__tests__', 'Test files'],
    ['e2e', 'End-to-end tests'],
  ];

  for (const [dirPath, description] of interesting) {
    if (cwdDirExists(...dirPath.split('/'))) {
      structureMap.push({ path: dirPath, description });
    }
  }

  result.projectStructure = structureMap;
}

// ─── CI/CD Detection ─────────────────────────────────────────────────────────

function detectCI(result: DetectionResult): void {
  if (cwdDirExists('.github', 'workflows')) {
    result.hasCI = true;
    result.ciPlatforms.push('GitHub Actions');
  }
  if (cwdFileExists('.gitlab-ci.yml')) {
    result.hasCI = true;
    result.ciPlatforms.push('GitLab CI');
  }
  if (cwdFileExists('Jenkinsfile')) {
    result.hasCI = true;
    result.ciPlatforms.push('Jenkins');
  }
  if (cwdFileExists('.circleci', 'config.yml')) {
    result.hasCI = true;
    result.ciPlatforms.push('CircleCI');
  }
  if (cwdFileExists('vercel.json') || cwdFileExists('.vercel')) {
    result.ciPlatforms.push('Vercel');
  }
  if (cwdFileExists('railway.json') || cwdFileExists('railway.toml')) {
    result.ciPlatforms.push('Railway');
  }
  if (cwdFileExists('fly.toml')) {
    result.ciPlatforms.push('Fly.io');
  }
  if (cwdFileExists('netlify.toml')) {
    result.ciPlatforms.push('Netlify');
  }
}

// ─── Git Detection ────────────────────────────────────────────────────────────

function detectGit(result: DetectionResult): void {
  try {
    const remote = execSync('git remote get-url origin 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    result.gitRemote = remote;

    // Extract repo name from remote URL
    const repoMatch = remote.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (repoMatch) result.gitRepoName = repoMatch[1];
  } catch {
    // Not a git repo or no remote
  }

  try {
    const commits = execSync('git log --oneline -10 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (commits) {
      const lines = commits.split('\n');
      const conventionalPattern = /^[0-9a-f]+ (feat|fix|chore|docs|style|refactor|test|build|ci|perf)(\(.+\))?!?:/;
      const conventionalCount = lines.filter((l) => conventionalPattern.test(l)).length;
      if (conventionalCount >= lines.length * 0.5) {
        result.commitStyleDetected = 'conventional';
      } else {
        result.commitStyleDetected = 'freeform';
      }
    }
  } catch {
    // No git history
  }
}

// ─── Env Vars ─────────────────────────────────────────────────────────────────

function detectEnvVars(result: DetectionResult): void {
  const envExampleFile = findFirst('.env.example', '.env.sample', '.env.template');
  if (!envExampleFile) return;

  const content = readFileSafe(cwdFile(envExampleFile)) ?? '';
  const vars = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => l.split('=')[0].trim())
    .slice(0, 20);

  result.envVars = vars;
}

// ─── Primary Language ─────────────────────────────────────────────────────────

function determinePrimaryLanguage(result: DetectionResult): void {
  if (result.primaryLanguage !== 'Unknown') return;

  // Fallback: check for common file extensions
  const cwdFiles = listDir(process.cwd());
  if (cwdFiles.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'))) {
    result.primaryLanguage = 'TypeScript';
  } else if (cwdFiles.some((f) => f.endsWith('.js') || f.endsWith('.jsx'))) {
    result.primaryLanguage = 'JavaScript';
  } else if (cwdFiles.some((f) => f.endsWith('.py'))) {
    result.primaryLanguage = 'Python';
  } else if (cwdFiles.some((f) => f.endsWith('.go'))) {
    result.primaryLanguage = 'Go';
  } else if (cwdFiles.some((f) => f.endsWith('.rs'))) {
    result.primaryLanguage = 'Rust';
  }
}
