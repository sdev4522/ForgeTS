---
trigger: always_on
---

ForgeTS uses parallel agent development.

MANDATORY:

- Never work directly on main for a task.
- Every task must use a dedicated branch.
- Branch names must describe the task.

Examples:

    agent/database-error
    agent/cli-alias-api
    agent/dev-reload

When multiple agents work simultaneously, use separate worktrees when available.

Before editing:

    git status
    git branch --show-current

Before completing:

    git diff
    git status
    run relevant tests
    run build/typecheck when applicable

The agent is responsible for making its branch integration-ready.

Before handoff:

1. synchronize with the target branch,
2. resolve conflicts,
3. verify the resolved code,
4. run tests,
5. commit the result.

Never blindly resolve conflicts with:

    git checkout --ours .
    git checkout --theirs .

Never delete another agent's work.

Never force-push.

Never claim a task is complete while the branch contains unresolved merge
conflicts or unverified changes.

Final report must include:

    branch
    commit
    changed files
    tests
    build
    conflicts resolved
    git status