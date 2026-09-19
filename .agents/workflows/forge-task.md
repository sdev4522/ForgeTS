---
description: Execute a ForgeTS development task.
---

Execute a ForgeTS development task.

PHASE 1 — UNDERSTAND

1. Read PROJECT.md.
2. Read RULES.md.
3. Inspect the relevant subsystem.
4. Use codegraph before architectural edits.
5. Identify the smallest correct implementation.

Do not start editing immediately.

PHASE 2 — PLAN

Determine:

- affected files
- existing abstractions to reuse
- possible side effects
- tests required
- whether another subsystem is involved

Do not create unnecessary files.

PHASE 3 — IMPLEMENT

Implement only the requested scope.

Do not add demo features, fake routes, dummy controllers, or unrelated cleanup.

PHASE 4 — VERIFY

Run:

- relevant tests
- typecheck
- build when relevant

Then inspect:

    git diff
    git status

Search for obvious regressions.

PHASE 5 — GIT

Work on the task's dedicated branch.

Synchronize with the target branch before handoff.

Resolve conflicts yourself.

Commit with a meaningful conventional commit message.

PHASE 6 — REPORT

Return:

## Result

## Root Cause

## Implementation

## Files Changed

## Tests

## Build

## Git Branch

## Commit

## Conflicts

## Remaining Issues

Do not claim success without verification.