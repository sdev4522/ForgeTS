# TypeScript Reference: Declaration Files (`.d.ts`) & Framework Augmentation

This reference covers authoring declaration files, ambient types, global augmentation, and module augmentation for framework extensibility based on the official [TypeScript Declaration Files Guide](https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html).

---

## 1. What Are Declaration Files?

Declaration files (`.d.ts`) describe the shape of existing JavaScript or TypeScript libraries without containing runtime code. They are consumed by the compiler for type checking and IDE autocomplete.

### Key Characteristics
* Contain only **types**, **interfaces**, and **ambient declarations** (`declare`).
* Contain no runtime code, executable statements, or function bodies.
* Can be automatically generated with `"declaration": true` in `tsconfig.json`.

---

## 2. Module Augmentation (`declare module`)

Module augmentation allows user applications or framework plugins to add new methods, properties, or bindings to an already declared framework module.

### Augmenting Framework Request Context
Suppose `@forge/core` defines an `HttpRequest` class. A session plugin can augment it:

```typescript
// types/session-augmentation.d.ts
import "@forge/core";

declare module "@forge/core" {
  interface HttpRequest {
    session: {
      get<T = unknown>(key: string): T | undefined;
      set(key: string, value: unknown): void;
      destroy(): void;
    };
    user?: {
      id: string;
      email: string;
      roles: string[];
    };
  }
}
```

*Crucial Rule for Module Augmentation*:
* The file **must be a module** (contain at least one top-level `import` or `export`).
* If there is nothing to import, use `import {} from "@forge/core";` or `export {};`.

---

## 3. Global Augmentation (`declare global`)

Use `declare global` from within a module to attach types to the global scope (e.g., `window`, `globalThis`, global helper functions, or Node/Bun process environments):

```typescript
// types/global.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
      PORT?: string;
      DATABASE_URL: string;
      APP_KEY: string;
    }
  }

  // Global framework helper function (if provided globally)
  function env(key: string, fallback?: string): string;
}

export {}; // Ensures this is treated as a module
```

---

## 4. Declaration Merging for Framework Registries

In extensible web frameworks like ForgeTS, user code defines routes, events, and container bindings. Using empty interfaces as extension hooks:

```typescript
// In framework core (@forge/core/types.ts):
export interface ContainerBindings {
  // Empty by default; consumer projects augment this
}

export interface AppEvents {
  // Empty by default; events are augmented by listener registrations
}

export class Container {
  make<K extends keyof ContainerBindings>(key: K): ContainerBindings[K];
  make<T>(token: new (...args: any[]) => T): T;
  make(token: any): any {
    // runtime resolution
  }
}
```

```typescript
// In user application (types/bindings.d.ts):
import type { UserService } from "@/services/UserService";
import type { Database } from "@forge/database";

declare module "@forge/core" {
  interface ContainerBindings {
    "db": Database;
    "users.service": UserService;
  }

  interface AppEvents {
    "user:registered": { userId: string; timestamp: number };
  }
}
```
Now `container.make("users.service")` automatically returns `UserService` with complete autocomplete and type safety.

---

## 5. Ambient Declarations (`declare namespace` vs. `declare module`)

### Ambient External Module
When integrating a third-party library without bundled types:
```typescript
// types/third-party.d.ts
declare module "untyped-markdown-parser" {
  export interface ParseOptions {
    sanitize?: boolean;
  }
  export function parse(markdown: string, options?: ParseOptions): string;
}
```

### Wildcard Module Declarations (Assets & CSS)
```typescript
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
```

---

## 6. Do's and Don'ts for Declaration Authoring

1. **Don't use `Number`, `String`, `Boolean`, `Object`**:
   * *Bad*: `function reverse(s: String): String;`
   * *Good*: `function reverse(s: string): string;`
2. **Don't use `Function` or `{}` for generic callbacks**:
   * *Bad*: `function handle(cb: Function);`
   * *Good*: `function handle(cb: (...args: any[]) => void);`
3. **Don't put optional parameters before required ones**:
   * *Bad*: `function get(id?: string, required: number);`
   * *Good*: `function get(id: string | undefined, required: number);` or put optional at end.
4. **Use Overloads judiciously**:
   * Put more specific overloads before more general overloads.
   * Prefer union types or generics over overloads when return types do not depend on argument types.
