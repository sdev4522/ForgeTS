---
name: typescript
description: >-
  Use this skill when developing, refactoring, or architecting TypeScript code in ForgeTS.
  Covers the entire TypeScript documentation taxonomy: core types, type manipulation,
  advanced references (decorators, declaration merging), modern module resolution,
  tsconfig options, .d.ts authoring, and framework-grade patterns (type-safe routing,
  typed DI containers, ORM inference, SSR hydration typing).
---

# TypeScript Documentation & Framework Development Skill

This skill provides an indexed, comprehensive guide to TypeScript based on the official [TypeScript Documentation](https://www.typescriptlang.org/docs/) and compiler architecture, specialized for building and maintaining the **ForgeTS** web framework.

---

## Quick Navigation Index

Refer to the focused reference guides in the `references/` directory based on your current task:

| Topic Area | Description | Reference Guide |
| :--- | :--- | :--- |
| **Everyday Types & Basics** | Primitives, object types, unions, intersections, narrowing, functions, classes, error diagnostics | [01-handbook-and-types.md](./references/01-handbook-and-types.md) |
| **Type Manipulation & Generics** | Generics, `keyof`, `typeof`, indexed access, conditional types, `infer`, mapped types, template literals | [02-type-manipulation.md](./references/02-type-manipulation.md) |
| **Language Reference** | Decorators (Stage 3 & legacy metadata), declaration merging, utility types, JSX/TSX typing, mixins, enums | [03-advanced-reference.md](./references/03-advanced-reference.md) |
| **Modules & Interop** | Module resolution (`bundler`, `node16`, `nodenext`), ESM/CJS interop, `package.json` exports, `import type` | [04-modules-and-interop.md](./references/04-modules-and-interop.md) |
| **TSConfig & Compiler Options** | Complete options reference: strict flags, targets (ES2022/ESNext), paths, project references | [05-tsconfig-and-compiler.md](./references/05-tsconfig-and-compiler.md) |
| **Declaration Files (`.d.ts`)** | Authoring framework typings, ambient types, global augmentation, module augmentation for user apps | [06-declaration-files.md](./references/06-declaration-files.md) |
| **Framework Patterns** | ForgeTS architecture: type-safe routing, typed IoC container, ORM/query builder inference, SSR typing | [07-framework-patterns.md](./references/07-framework-patterns.md) |

---

## Interactive Documentation Lookup

You can query the indexed documentation and compiler options from the command line:

```bash
# Search for a topic, type operator, or keyword:
bun run .agents/skills/typescript/scripts/query-tsdocs.ts "conditional types"

# Look up a tsconfig compiler option:
bun run .agents/skills/typescript/scripts/query-tsdocs.ts "moduleResolution"

# List all available documentation sections:
bun run .agents/skills/typescript/scripts/query-tsdocs.ts --list
```

---

## Quick Decision Cheatsheet for Framework Development

### 1. Designing Public Framework APIs
* **Prefer Interfaces for Extensibility**: Use `interface` for contracts that users or plugins should augment via declaration merging (e.g., `HttpContext`, `SessionData`, `ContainerBindings`).
* **Use Type Aliases for Unions & Transforms**: Use `type` for unions, intersections, conditional transformations, and utility computations (e.g., `RouteHandler<TParams, TQuery>`).
* **Preserve Literal Types**: Use `as const` or `const` type parameters (`<const T extends string>`) when capturing route templates or configuration objects.

### 2. Module Resolution & Imports
* ForgeTS targets Bun and Vite with `"moduleResolution": "bundler"` and `"target": "ES2022"`.
* Always use `import type { ... }` when importing types from files that might not be included in the bundle or to prevent circular runtime dependency cycles.
* Ensure `"isolatedModules": true` compliance (each file must be transpilable independently without full type graph resolution).

### 3. Decorators & Metadata Reflection
* ForgeTS uses `reflect-metadata` for controller routing (`@Get`, `@Post`), dependency injection (`@Inject`), and ORM models (`@Column`).
* Ensure `emitDecoratorMetadata` and `experimentalDecorators` remain enabled when using TypeScript legacy parameter reflection, or migrate to Stage 3 decorator metadata (`Symbol.metadata`) when standardizing.

### 4. Working with Framework Database Models & ORMs
* Never rely on `any` for model attributes. Use model proxies with generic attribute maps:
  `class Model<TAttributes extends Record<string, any>>`.
* Separate database schema representations (raw row types from Kysely) from high-level Domain Model representations.

---

## Reference Examples

Concrete, production-ready TypeScript patterns implemented in ForgeTS style:
* [type-safe-router.ts](./examples/type-safe-router.ts): Route template parameter extraction using recursive template literal types.
* [typed-container.ts](./examples/typed-container.ts): Strongly typed Dependency Injection / Service Container with token resolution.
* [model-orm-typing.ts](./examples/model-orm-typing.ts): Type-safe Active Record / Query Builder model proxy with column inference.
* [framework-augmentation.d.ts](./examples/framework-augmentation.d.ts): Example of module and interface declaration merging for consumer applications.
