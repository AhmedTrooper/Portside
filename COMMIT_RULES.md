# Commit Rules

Applies to every commit in this repo, whoever makes it (human or agent).

## Commit message

- The headline is a single line. Extra info goes in the body, never in the headline.
- Write it like a human: say what changed and why. No AI-ness — no emoji spam, no marketing words, no "various improvements", no summary-of-nothing.
- Never append `Co-authored-by: ...` or any "generated with ..." trailer.
- Body is optional. If used, one blank line after the headline.

Good:

```
move tauri app into apps/desktop for a monorepo layout

also switched installs to bun and added a root Makefile
```

Bad:

```
feat(core): ✨ enhance repo structure using best practices 🚀 (AI-assisted)

Co-authored-by: SomeAgent <noreply@agents.example>
```

## Pre-commit rule

Before anything else, inspect the real changes — `git status` alone is not enough:

```sh
git status
git diff            # unstaged content
git diff --staged   # what will actually be committed
```

Read the diff content, not just the file names. The commit message, what gets staged, and whether it should be split into several commits are decided from what the diff actually does.

Then run:

```sh
make precommit
```

All five checks must pass:

1. `make build` — `bun run build` (tsc + vite build, frontend)
2. `make lint` — `bun run lint` (tsc --noEmit, frontend)
3. `make fmt-check` — `cargo fmt --check` (src-tauri). Run `make fmt` to fix formatting if this fails.
4. `make clippy` — `cargo clippy` (src-tauri)
5. `make check` — `cargo check` (src-tauri)

If any of them fails: fix the problem, re-run all five, then commit. Never knowingly commit failing checks. `--no-verify` is for emergencies only, and the fix must follow immediately.

The checked-in `.githooks/pre-commit` hook calls `make precommit` automatically. Enable it once per clone with `make hooks`, which sets `core.hooksPath` to `.githooks`.

## When to commit

Commit immediately after a feature or fix is complete and the pre-commit rule passes. Do not leave finished work uncommitted. Keep each commit focused on one feature or fix; split unrelated changes into separate commits.
