# Cleanup Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and run a safe cross-platform cleanup command for generated repository artifacts.

**Architecture:** Keep the cleanup list in the `package.json` command and use only Node's built-in filesystem API. Verify the real command by copying it into a temporary fixture, so the test can prove removal and preservation behavior without deleting the active test runner's files.

**Tech Stack:** Node 24 standard library, npm scripts, Vitest.

---

### Task 1: Define and verify the cleanup boundary

**Files:**

- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `tests/clean-command.test.ts`

- [x] **Step 1: Write a failing integration test**

Read the root `package.json`, require a `clean` script, copy that exact script into a temporary package, create every supported generated target plus preserved `node_modules/keep.txt` and `.env.local`, execute `npm run clean`, and assert only generated targets disappear.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- --run tests/clean-command.test.ts`

Expected: FAIL because `scripts.clean` is missing.

- [x] **Step 3: Add the portable command**

Add `npm run clean` using `node -e`, `fs.rmSync(..., { recursive: true, force: true })`, and a root `*.tsbuildinfo` filter. Remove `dist`, `out`, `build`, `coverage`, `.nyc_output`, `playwright-report`, `test-results`, `.vite`, `.cache`, `.turbo`, and `.eslintcache`.

- [x] **Step 4: Run the focused test and expect PASS**

Run: `npm test -- --run tests/clean-command.test.ts`

### Task 2: Ignore and document all cleanup targets

**Files:**

- Modify: `.gitignore`
- Modify: `README.md`

- [x] **Step 1: Add `.vite/` and `.nyc_output/` to `.gitignore`**

Keep existing dependency, environment, output, and cache rules intact.

- [x] **Step 2: Document `npm run clean`**

Explain what the command removes and explicitly state that it preserves `node_modules`, `.env` files, source, Git data, and browser storage.

### Task 3: Verify and clean the working repository

**Files:**

- Modify: `docs/superpowers/plans/2026-07-12-cleanup-command.md`

- [x] **Step 1: Run `npm run verify` and `npm audit --omit=dev`**

Expected: lint, type-check, all unit tests, production build, and audit pass.

- [x] **Step 2: Run `npm run clean`**

Verify generated targets are absent and `node_modules` remains usable.

- [x] **Step 3: Run `npm test -- --run tests/clean-command.test.ts` after cleanup**

Expected: PASS without reinstalling dependencies.

- [x] **Step 4: Mark the plan complete and run `git diff --check`**

Expected: no whitespace errors and only intended tracked changes.
