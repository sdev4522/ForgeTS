# TypeScript Reference: TSConfig & Compiler Options

This reference provides a complete categorized guide to `tsconfig.json` compiler options based on the official [TSConfig Reference](https://www.typescriptlang.org/tsconfig).

---

## 1. Top-Level Configuration Anatomy

```json
{
  "compilerOptions": {
    /* Language & Environment */
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    
    /* Strict Type-Checking */
    "strict": true,
    
    /* Module Resolution & Emit */
    "baseUrl": ".",
    "paths": { "@forge/*": ["packages/forge/src/*"] },
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    
    /* Interop & Constraints */
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["app/**/*", "packages/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 2. Strictness Flags Reference

Enabling `"strict": true` activates a suite of strict type checking behaviors simultaneously.

| Flag | Description | Framework Recommendation |
| :--- | :--- | :--- |
| **`strict`** | Master toggle for all strict flags below. | **Always true** |
| `noImplicitAny` | Errors when an expression or parameter defaults to `any` without an explicit type annotation. | Mandatory. Enforces typed method parameters and returns. |
| `strictNullChecks` | Distinguishes `null` and `undefined` from concrete types. | Mandatory. Prevents runtime `TypeError: Cannot read property of undefined`. |
| `strictFunctionTypes` | Enables contravariant checking of function parameter types. | Mandatory. Ensures handler callbacks match expected signatures. |
| `strictBindCallApply` | Checks that `.bind`, `.call`, and `.apply` methods are called with arguments matching the underlying function. | Enabled by `strict`. |
| `strictPropertyInitialization` | Errors when a declared class property is not initialized in the constructor. | Set to false or use `!` when using dependency injection or ORM model decorators. |
| `noImplicitThis` | Errors when `this` has type `any`. | Mandatory. Enforces typed `this` in custom middleware and query builders. |
| `useUnknownInCatchVariables` | Makes error parameter in `catch (e)` default to `unknown` rather than `any`. | Recommended. Forces defensive error handling (`if (e instanceof Error)`). |

---

## 3. Module & Target Configuration

### `target`
Specifies ECMAScript target version for emitted JavaScript.
* `ES2022`: Supports top-level `await`, class fields, private methods, `Object.hasOwn`, `RegExp` match indices. (Default in ForgeTS).
* `ESNext`: Latest ECMAScript draft features.

### `module`
Specifies module code generation.
* `ESNext`: Modern ESM output (`import`/`export`).
* `NodeNext`: Emits Node.js compliant ESM with specifier rules.

### `moduleResolution`
* `bundler`: Best for Vite, Bun, and esbuild. Supports package `exports` without requiring `.js` extensions.

---

## 4. Emit & Output Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `declaration` | `boolean` | Generates `.d.ts` files for all TypeScript files in project. |
| `declarationMap` | `boolean` | Generates source maps for `.d.ts` files, enabling IDE "Go to Source" to jump directly to original `.ts` source files. |
| `sourceMap` | `boolean` | Generates `.js.map` files for debugging in browsers and node debuggers. |
| `outDir` | `string` | Output directory for compiled `.js` and `.d.ts` files. |
| `rootDir` | `string` | Root directory of input files; used to control output directory structure. |
| `noEmit` | `boolean` | Do not emit outputs (used for pure type-checking commands like `tsc --noEmit`). |
| `removeComments` | `boolean` | Strips comments from emitted code. Keep `false` if JSDoc comments should be preserved. |

---

## 5. Completeness & Type Checking Speed

### `skipLibCheck: true`
* Skips type checking of all `.d.ts` files in `node_modules`.
* Significantly speeds up compilation and avoids errors caused by conflicting type declarations across external packages.
* **Standard practice in ForgeTS**.

### `isolatedModules: true`
* Ensures that each file can be transpiled safely by single-file compilers like Vite, esbuild, and Bun without relying on full type analysis.
* Prohibits:
  - Const enums without preserve flag.
  - Re-exporting a type without using `export type`.
  - Ambient namespaces.

---

## 6. Project References & Monorepos

For large frameworks with multiple packages (`@forge/core`, `@forge/database`, `@forge/router`):

```json
// packages/core/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo",
    "outDir": "./dist"
  }
}
```

```json
// Root tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./packages/forge" },
    { "path": "./packages/database" }
  ]
}
```
*Benefits*: Incremental compilation (`tsc --build`), strict boundary enforcement, faster rebuilds during framework development.
