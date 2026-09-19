---
trigger: always_on
---

Write production-quality framework code.

Before considering a change complete, check for:

- dead code
- unused imports
- duplicated logic
- hardcoded absolute paths
- hardcoded user-specific paths
- fake/demo data
- unnecessary controllers
- unnecessary models
- unnecessary dependencies
- incorrect relative imports
- inconsistent aliases
- unsafe type assertions
- swallowed errors
- invalid HTTP status values
- environment configuration inconsistencies
- development-only hacks leaking into production
- incorrect runtime/build assumptions

Do not optimize for minimum lines of code.

Optimize for:

    correctness
    maintainability
    clear architecture
    predictable runtime behavior

Do not make unrelated cleanup changes unless required for the task.

If an existing implementation is architecturally wrong and the requested feature
depends on it, fix the underlying abstraction rather than adding another workaround.