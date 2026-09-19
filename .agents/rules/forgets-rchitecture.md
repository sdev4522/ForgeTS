---
trigger: always_on
---

You are working inside the ForgeTS framework repository.

Before making architectural changes:

1. Read PROJECT.md.
2. Read RULES.md.
3. Read relevant README.md documentation.
4. Inspect the existing architecture using codegraph when available.
5. Understand the existing implementation before creating new abstractions.

ARCHITECTURE PRINCIPLES

- ForgeTS is a framework, not an application.
- Keep framework core generic.
- Do not add application-specific demo/domain logic to framework internals.
- Do not create duplicate implementations when an existing abstraction already
  handles the requirement.
- Prefer extending existing abstractions over introducing parallel systems.
- Keep database-specific behavior inside database adapters/drivers.
- Keep HTTP behavior inside the HTTP layer.
- Keep CLI behavior inside the CLI layer.
- Keep frontend behavior separate from backend framework internals.
- Do not introduce hardcoded machine-specific paths.
- Do not introduce fake/demo routes, controllers, models, or data merely to
  demonstrate a feature.
- Do not create files or directories unless they have a real architectural role.

Before creating a new abstraction, search the repository for an existing one.

When uncertain about architecture, inspect first instead of guessing.