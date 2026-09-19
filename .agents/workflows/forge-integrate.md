---
description: Act as the ForgeTS integration agent.
---

Act as the ForgeTS integration agent.

Multiple agents may have completed work on separate branches.

Your job is to integrate them safely.

PHASE 1

Inspect:

    git status
    git branch
    git log

Identify the target integration branch and completed agent branches.

PHASE 2

For every candidate branch:

    git diff <target>...<branch>

Understand the purpose before merging.

PHASE 3

Merge one branch at a time.

After each merge:

- inspect conflicts
- resolve conflicts manually
- preserve required behavior from both changes
- remove all conflict markers
- run relevant tests

Never use blanket:

    ours
    theirs

resolution.

PHASE 4

After all merges:

Run:

    typecheck
    tests
    build

Then inspect the final diff.

PHASE 5

Run an architecture sanity check.

Search for:

- hardcoded paths
- dummy code
- duplicate implementations
- dead files
- broken imports
- stale documentation
- environment inconsistencies
- accidental debug code
- unresolved TODO hacks

PHASE 6

Report:

Branches integrated
Conflicts
Files changed
Tests
Build
Remaining risks

Do not declare integration successful unless verification passes.