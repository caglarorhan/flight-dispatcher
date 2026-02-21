# flight-dispatcher ✈

**Zero-install CLI that auto-generates `.github/copilot-instructions.md` for any project.**

[![npm version](https://img.shields.io/npm/v/flight-dispatcher?color=cb3837&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/flight-dispatcher)
[![npm downloads](https://img.shields.io/npm/dw/flight-dispatcher?color=cb3837&logo=npm&logoColor=white&label=downloads%2Fweek)](https://www.npmjs.com/package/flight-dispatcher)
[![npm total downloads](https://img.shields.io/npm/dt/flight-dispatcher?label=total%20downloads&color=cb3837)](https://www.npmjs.com/package/flight-dispatcher)
[![GitHub release](https://img.shields.io/github/v/release/caglarorhan/flight-dispatcher?logo=github&label=latest%20release)](https://github.com/caglarorhan/flight-dispatcher/releases/latest)
[![GitHub stars](https://img.shields.io/github/stars/caglarorhan/flight-dispatcher?style=flat&logo=github&label=stars)](https://github.com/caglarorhan/flight-dispatcher/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/caglarorhan/flight-dispatcher?style=flat&logo=github&label=forks)](https://github.com/caglarorhan/flight-dispatcher/forks)
[![Release workflow](https://img.shields.io/github/actions/workflow/status/caglarorhan/flight-dispatcher/release.yml?label=release%20build&logo=github-actions&logoColor=white)](https://github.com/caglarorhan/flight-dispatcher/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)

[![macOS](https://img.shields.io/badge/macOS-arm64%20%7C%20x64-black?logo=apple&logoColor=white)](https://github.com/caglarorhan/flight-dispatcher/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-arm64%20%7C%20x64-yellow?logo=linux&logoColor=black)](https://github.com/caglarorhan/flight-dispatcher/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-x64-blue?logo=windows&logoColor=white)](https://github.com/caglarorhan/flight-dispatcher/releases/latest)
[![Homebrew](https://img.shields.io/badge/Homebrew-tap-orange?logo=homebrew&logoColor=white)](https://github.com/caglarorhan/homebrew-flight-dispatcher)
[![Scoop](https://img.shields.io/badge/Scoop-bucket-dodgerblue?logo=scoop&logoColor=white)](https://github.com/caglarorhan/scoop-flight-dispatcher)

```bash
npx flight-dispatcher
```

GitHub Copilot has no memory between sessions. `flight-dispatcher` solves this by generating a persistent context file that VS Code automatically injects into every Copilot Chat session — your stack, conventions, architecture rules, and todos, always there.

---

## How It Works

Three layers, one command:

1. **Global Profile** — Set once, reused across every project. Your code style, language preference, commit conventions, and custom rules.
2. **Auto-Detection** — Scans your project silently. Reads `package.json`, `tsconfig.json`, `prisma/schema.prisma`, `docker-compose.yml`, `.env.example`, git history, and more.
3. **Interactive Questions** — Only asks what it can't detect. Project description, deployment target, architecture rules, pending todos.

Result: a structured `.github/copilot-instructions.md` that makes Copilot immediately useful without repeating yourself.

---

## Usage

```bash
npx flight-dispatcher              # Standard run
npx flight-dispatcher --update     # Re-detect + merge, preserve manual edits
npx flight-dispatcher --reset-profile  # Redo your global developer profile
npx flight-dispatcher --dry-run    # Preview output without writing
npx flight-dispatcher --silent     # No questions, auto-detect only
npx flight-dispatcher --help       # Show help
```

---

## What Gets Generated

The output file includes these sections:

| Section | Source |
|---------|--------|
| **About This Project** | Your 1–2 sentence description |
| **Developer Preferences** | Global profile (language, style, commit format) |
| **Tech Stack** | Auto-detected from deps, configs, and files |
| **Project Structure** | Auto-detected directories |
| **Architecture Rules** | Your project-specific rules |
| **Copilot Behavior** | Standing orders — things you always tell Copilot, defined once |
| **Deployment** | Your target + detected CI/CD |
| **Git Hooks** | Summary of configured git automations |
| **Pending TODOs** | Your checklist |
| **Known Conventions** | Auto-detected conventions (Prettier config, commit style, etc.) |

---

## Standing Orders — Say It Once, Active Forever

Stop repeating yourself in every prompt. Define standing orders once and Copilot follows them automatically in this project:

```markdown
## Copilot Behavior

- When I say "remember this", update .github/copilot-instructions.md with the new information
- When I mention a TODO or say "add to todo list", append it to ## Pending TODOs in this file
- When we discuss an architectural decision, add it to ## Architecture Rules in this file
- Always suggest running the build command before git push
- When introducing new features, remind me to update the README
- Never suggest installing a new dependency without checking if a similar library is already in use
```

---

## Git Hook Automations

Select from preset automations or add your own. Writes real executable scripts to `.git/hooks/` — pushes and commits are **blocked** if the automation fails:

```
  ❯ ◉  Build before push       (pre-push: npm run build)
    ◯  Lint before commit       (pre-commit: npm run lint)
    ◯  Tests before push        (pre-push: npm run test)
    ◯  Type-check before commit (pre-commit: npx tsc --noEmit)
    ◯  Format files before commit (pre-commit: npm run format)
    ◯  Security audit before push (pre-push: npm audit --audit-level=high)
    ◯  + Add custom hook...
```

Custom hooks ask: **when** (pre-commit, pre-push, post-merge...), **description**, and **command to run**. Anything executable works.

---

| Source | What it detects |
|--------|----------------|
| `package.json` | Next.js, React, Vue, Svelte, Express, Fastify, NestJS, Prisma, Drizzle, tRPC, Zod, TailwindCSS, auth providers, test runners, build tools... |
| `tsconfig.json` | TypeScript strictness, path aliases |
| `prisma/schema.prisma` | DB provider, model names |
| `.eslintrc*` / `prettier.config.*` | Code style rules |
| `tailwind.config.*` | CSS approach |
| `docker-compose.yml` | Services (Redis, PostgreSQL, etc.) |
| `.env.example` | Available environment variables |
| `requirements.txt` / `pyproject.toml` | Python stack (Django, FastAPI, Flask...) |
| `composer.json` | PHP stack (Laravel, Symfony...) |
| `go.mod` | Go modules |
| `Cargo.toml` | Rust crates |
| `Gemfile` | Ruby/Rails |
| `pom.xml` / `build.gradle` | Java/Kotlin (Spring...) |
| `.github/workflows/` | CI/CD platforms |
| `messages/*.json` | i18n locales |
| Git history | Commit style (conventional or freeform) |
| Directory structure | App Router vs Pages Router, API structure, etc. |

---

## Output Example

```markdown
# Copilot Instructions — my-project

> Auto-generated by flight-dispatcher on 2026-02-20. Re-run `npx flight-dispatcher` to update.

## About This Project
A SaaS platform for managing team workflows with real-time collaboration.

## Developer Preferences
- **Language:** TypeScript (strict mode)
- **Formatting:** single quotes, no semicolons, 2-space indent
- **Commits:** Conventional commits (feat:, fix:, chore:...)
- Never use `any` in TypeScript

## Tech Stack
- **Language:** TypeScript (strict mode), Node >=18
- **Frontend:** Next.js 15 (App Router), React 19
- **Styling:** TailwindCSS, Radix UI
- **Database:** PostgreSQL via Prisma ORM
  - Models: `User`, `Team`, `Project`, `Task`, `Comment`
- **Auth:** NextAuth.js
- **Tests:** Vitest

## Project Structure
- `src/app/` — Next.js App Router pages and layouts
- `src/components/` — Shared React components
- `src/lib/` — Utility functions and helpers
- `prisma/` — Prisma schema and migrations

## Architecture Rules
- DB schema changes: `npx prisma db push --accept-data-loss`
- Client components require `'use client'` directive
- i18n: add translation keys to ALL 4 locale files when introducing new UI text

## Deployment
- **Target:** Vercel
- **CI/CD:** GitHub Actions, Vercel

## Pending TODOs
- [ ] Implement email notifications
- [ ] Add export to CSV feature

## Known Conventions
- **Git commits:** Conventional format (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
- **Code quality:** ESLint + Prettier
```

---

## Global Profile

Your developer preferences are stored at `~/.flight-dispatcher/profile.json` and automatically applied to every project:

- Preferred language (TypeScript, Python, Go, etc.)
- Code style (indentation, quotes, semicolons)
- Commit convention (conventional commits vs freeform)
- Test framework preference
- Copilot verbosity (concise vs detailed)
- Custom global rules (e.g. "Never use `any`")
- Comment style preference

Set once, never re-enter per project.

---

## Merge Behavior

When you re-run `npx flight-dispatcher` or use `--update`:

| Section | Behavior |
|---------|----------|
| Auto-detected sections (Tech Stack, Project Structure, etc.) | Refreshed automatically |
| **About This Project** | Preserved — you wrote it |
| **Architecture Rules** | Preserved — you defined them |
| **Pending TODOs** | Preserved — you manage them manually |
| **Developer Preferences** | Re-loaded from global profile |

---

## Requirements

- Node.js ≥ 18
- Works on macOS, Linux, and Windows

---

## Installation

### npx — zero install (recommended)
```bash
npx flight-dispatcher
```

### Homebrew (macOS / Linux)
```bash
brew tap caglarorhan/flight-dispatcher
brew install flight-dispatcher
```

### Scoop (Windows)
```powershell
scoop bucket add flight-dispatcher https://github.com/caglarorhan/scoop-flight-dispatcher
scoop install flight-dispatcher
```

### Standalone binary — no Node.js required
Download the binary for your platform from [GitHub Releases](https://github.com/caglarorhan/flight-dispatcher/releases/latest):

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `flight-dispatcher-vX.X.X-macos-arm64` |
| macOS (Intel) | `flight-dispatcher-vX.X.X-macos-x64` |
| Linux x64 | `flight-dispatcher-vX.X.X-linux-x64` |
| Linux ARM64 | `flight-dispatcher-vX.X.X-linux-arm64` |
| Windows x64 | `flight-dispatcher-vX.X.X-win-x64.exe` |

**macOS / Linux:**
```bash
# Example for macOS Apple Silicon
curl -fsSL https://github.com/caglarorhan/flight-dispatcher/releases/latest/download/flight-dispatcher-macos-arm64 -o flight-dispatcher
chmod +x flight-dispatcher && sudo mv flight-dispatcher /usr/local/bin/
```

**Windows:** Download the `.exe`, place it somewhere on your `PATH`, and run `flight-dispatcher` from any terminal.

### npm global install
```bash
npm install -g flight-dispatcher
flight-dispatcher
```

---

## Links

- **npm:** https://www.npmjs.com/package/flight-dispatcher
- **GitHub:** https://github.com/caglarorhan/flight-dispatcher
- **Releases:** https://github.com/caglarorhan/flight-dispatcher/releases
- **Homebrew tap:** https://github.com/caglarorhan/homebrew-flight-dispatcher
- **Scoop bucket:** https://github.com/caglarorhan/scoop-flight-dispatcher

---

## License

MIT
