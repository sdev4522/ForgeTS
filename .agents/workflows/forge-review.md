---
description: Review the current ForgeTS changes as a framework maintainer.
---

Review the current ForgeTS changes as a framework maintainer.

Do not modify code unless explicitly requested.

Use codegraph to understand affected architecture.

Check specifically for:

- hardcoded absolute paths
- machine-specific paths
- dummy/demo application code
- unnecessary controllers/models
- duplicate abstractions
- duplicated routing systems
- incorrect import aliases
- broken Bun/Vite/SSR resolution
- invalid HTTP behavior
- swallowed exceptions
- database-specific logic in generic layers
- environment inconsistencies
- unnecessary dependencies
- dead code
- unused imports
- missing regression tests
- production/dev behavior differences
- security-sensitive mistakes

For every finding provide:

    severity
    file
    location
    problem
    why it matters
    concrete fix

Do not give generic praise.

Do not report stylistic preferences as architectural defects.

Do not modify the repository.