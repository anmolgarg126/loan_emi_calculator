# Cleanup Script Design

**Date:** 2026-07-12
**Status:** Approved for implementation

## Objective

Provide one safe, documented command that removes generated project artifacts without deleting dependencies, source files, environment files, or browser data.

## Command

Add `npm run clean` to `package.json`. The command will use Node's built-in filesystem API so it works consistently on supported development platforms without a shell-specific command or new dependency.

## Cleanup scope

The command will remove only these repository-local generated paths:

- `dist/`, `out/`, and `build/`;
- `coverage/` and `.nyc_output/`;
- `playwright-report/` and `test-results/`;
- `.vite/`, `.cache/`, `.turbo/`, and `.eslintcache`;
- root TypeScript build-info files matching `*.tsbuildinfo`.

Missing paths are ignored, making repeated runs safe. The command must not remove `node_modules/`, `.env` files, source files, `.git/`, worktrees, or any browser storage.

## Git ignore and documentation

Keep the existing `.gitignore` rules and add missing entries for `.vite/` and `.nyc_output/`. Update `README.md` with the cleanup command, its intended use, and an explicit note that dependencies and environment files are preserved.

## Verification

- Create representative generated files/directories, run `npm run clean`, and verify only the listed targets disappear.
- Verify `node_modules/` and a temporary `.env.local` marker remain.
- Run `npm run verify` after cleanup to confirm the clean command does not damage the project.
- Run `git diff --check` and confirm the working tree contains only intended tracked changes.

## Alternatives rejected

- Shell `rm -rf`: shorter, but platform-specific and easier to extend unsafely.
- Dedicated `scripts/clean.mjs`: clear, but unnecessary for a fixed one-expression cleanup list.
