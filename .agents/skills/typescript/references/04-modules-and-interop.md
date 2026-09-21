# TypeScript Reference: Modules & Modern Interop

This reference covers ECMAScript modules, CommonJS interoperability, module resolution algorithms (`bundler`, `node16`, `nodenext`), and package exports based on the official [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/introduction.html).

---

## 1. Module Resolution Modes

The `moduleResolution` compiler option dictates how TypeScript resolves module specifiers in `import` / `require` statements.

| Resolution Mode | Target Runtime | File Extensions | `package.json` "exports" | Typical Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`bundler`** (ForgeTS) | Bun, Vite, esbuild, Webpack | Omitted or explicit (`.ts`, `.tsx`, `.js`) | Yes | Modern full-stack apps & monorepos with bundlers |
| **`node16` / `nodenext`** | Node.js native ESM/CJS | Strictly required (`.js` for `.ts`, `.mjs`, `.cjs`) | Yes | Node.js libraries and native Node runtime |
| **`node10` (classic node)** | Legacy Node.js | Omitted (`.ts`, `.js`) | No | Legacy projects, avoid for new framework code |

### Why ForgeTS uses `moduleResolution: "bundler"`
* **Bun & Vite Native**: ForgeTS runs on Bun and uses Vite for SSR and client builds.
* **Extensionless Imports**: Allows importing `./UserController` instead of forcing relative `./UserController.js`.
* **Subpath Exports**: Honors `exports` fields in `package.json` while allowing path aliases (`@/controllers/*`).

---

## 2. CommonJS vs. ECMAScript Modules (ESM) Interop

In ESM (`"type": "module"` in `package.json`):
```typescript
// Standard ECMAScript import:
import { Database } from "@forge/database";
import express from "express";

// Dynamic import (lazy loading routes/controllers):
const controller = await import("./app/controllers/UserController.js");
```

### Key Interop Compiler Options
* **`esModuleInterop: true`**: Allows default imports from CommonJS modules without synthetic wildcard imports (e.g. `import React from "react"` instead of `import * as React from "react"`).
* **`allowSyntheticDefaultImports: true`**: Implicitly enabled when `esModuleInterop` is true.

---

## 3. Type-Only Imports and Exports

Type-only imports are stripped completely during compilation, guaranteeing no runtime side-effects:

```typescript
// Type-only import of symbols:
import type { Request, Response } from "@forge/core";

// Inline type-only specifiers (TypeScript 4.5+):
import { Router, type RouteHandler, type Middleware } from "@forge/core";

// Re-exporting types:
export type { UserAttributes, UserModel } from "./types";
```

### Why `import type` is Critical in Frameworks:
1. **Prevents Circular Dependencies**: Two files can import each other's types without triggering runtime circular module load issues.
2. **Avoids Leaking Server Dependencies into Client Bundles**: In SSR frameworks, client components importing types from server controllers will not pull database drivers into the browser bundle.
3. **Satisfies `isolatedModules: true`**: Required when single-file transpilers (Vite/esbuild/swc) transform code.

---

## 4. `package.json` Modern Fields

For publishing or structuring framework packages (such as `packages/forge`):

```json
{
  "name": "@forge/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./database": {
      "types": "./dist/database/index.d.ts",
      "import": "./dist/database/index.js"
    }
  }
}
```

*Rule for `"exports"`*: Always list `"types"` **before** `"import"` or `"require"`, because tools read properties in object order.

---

## 5. Path Aliases (`paths` and `baseUrl`)

In ForgeTS `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@forge/core": ["./packages/forge/src/index.ts"],
      "@/controllers/*": ["./app/controllers/*"],
      "@/models/*": ["./app/models/*"],
      "@/services/*": ["./app/services/*"]
    }
  }
}
```

### Runtime vs. Compile-Time Path Aliases
* `tsconfig.json` `paths` tells the **type checker** where files reside.
* Bun understands `tsconfig.json` paths natively at runtime.
* Vite resolves paths in the client/SSR bundle via `vite.config.ts` (e.g. `resolve.alias`).

---

## 6. Dynamic Imports & Code Splitting in ForgeTS

ForgeTS dynamically resolves controllers and routes:
```typescript
export async function loadController(controllerPath: string) {
  const module = await import(controllerPath);
  const ControllerClass = module.default || module[Object.keys(module)[0]];
  return new ControllerClass();
}
```
*Note*: When using dynamic string template imports (`import(`./pages/${name}`)`), bundlers like Vite require a relative directory pattern so rollup can analyze chunk boundaries.
