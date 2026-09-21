# TypeScript Reference: Everyday Types & Core Concepts

This reference covers fundamental TypeScript types, language semantics, narrowing, functions, classes, and compiler diagnostics based on the official [TypeScript Handbook (v2)](https://www.typescriptlang.org/docs/handbook/2/basic-types.html).

---

## 1. Type Primitives & Everyday Types

### Core Primitives
* `string`, `number`, `boolean`, `symbol`, `bigint`.
* `null` and `undefined`: Under `strictNullChecks: true`, `null` and `undefined` are not assignable to domain types unless explicitly in a union (e.g., `string | null`).
* `void`: Return type for functions that return no value.
* `never`: Represents values that never occur (e.g., functions that always throw, or unreachable branches in exhaustive pattern matching).
* `unknown`: Top type representing any value. Safe alternative to `any`; requires type narrowing before performing operations.
* `any`: Disables all type checking on the variable. Avoid in ForgeTS core unless wrapping un-typed third-party dynamic APIs.

### Arrays & Tuples
```typescript
// Array syntax:
const ids: number[] = [1, 2, 3];
const names: Array<string> = ["Alice", "Bob"];

// Readonly array:
const roArray: readonly number[] = [1, 2, 3];

// Tuples (fixed-length arrays with typed positions):
type RouteMatch = [matched: boolean, params: Record<string, string>];
const match: RouteMatch = [true, { id: "123" }];

// Named and optional tuple elements:
type ResponseTuple = [status: number, body?: unknown, headers?: Headers];
```

### Type Aliases vs. Interfaces

| Feature | `interface` | `type` Alias |
| :--- | :--- | :--- |
| **Declaration Merging** | Yes (multiple declarations with same name merge) | No (duplicate identifier error) |
| **Object Type Extension** | `interface B extends A { ... }` | `type B = A & { ... }` |
| **Primitives / Unions / Tuples** | Cannot name a primitive or union | Can represent any type |
| **Computed Properties** | Yes | Yes |
| **Performance in Compiler** | Cached by type checker by identifier | Flattened / evaluated during check |
| **Best For** | Public APIs, configs, models, extensibility | Unions, mapped types, utility transforms |

---

## 2. Type Narrowing

Narrowing is the process where TypeScript refines an untyped or union type to a more specific type within a control flow branch.

### 1. `typeof` Type Guards
Checks primitive types at runtime: `"string"`, `"number"`, `"bigint"`, `"boolean"`, `"symbol"`, `"undefined"`, `"object"`, `"function"`.
*Caveat*: `typeof null === "object"` at runtime.

### 2. Truthiness Narrowing
Checks for truthy/falsy values (`false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`).
```typescript
function printAll(strs: string | string[] | null) {
  if (strs && typeof strs === "object") {
    for (const s of strs) {
      console.log(s);
    }
  }
}
```

### 3. Equality Narrowing
```typescript
function example(x: string | number, y: string | boolean) {
  if (x === y) {
    // x and y are narrowed to string
    x.toUpperCase();
    y.toLowerCase();
  }
}
```

### 4. The `in` Operator Narrowing
Checks whether a property exists on an object:
```typescript
type DatabaseResult = { rows: Record<string, any>[] } | { error: Error };

function handle(result: DatabaseResult) {
  if ("error" in result) {
    throw result.error;
  }
  return result.rows;
}
```

### 5. `instanceof` Narrowing
Checks prototype chain:
```typescript
function handleError(err: unknown) {
  if (err instanceof ValidationError) {
    return { status: 422, errors: err.errors };
  }
  if (err instanceof Error) {
    return { status: 500, message: err.message };
  }
  return { status: 500, message: "Unknown error" };
}
```

### 6. Discriminated Unions (Tagged Unions)
A common literal property (tag) shared across union members:
```typescript
interface HttpRequestPending {
  status: "pending";
}
interface HttpRequestSuccess {
  status: "success";
  data: unknown;
}
interface HttpRequestFailed {
  status: "failed";
  error: Error;
}

type HttpRequestState = HttpRequestPending | HttpRequestSuccess | HttpRequestFailed;

function processState(state: HttpRequestState) {
  switch (state.status) {
    case "pending":
      return "Loading...";
    case "success":
      return state.data;
    case "failed":
      return state.error.message;
  }
}
```

### 7. Exhaustiveness Checking with `never`
Ensures all cases of a discriminated union are handled:
```typescript
function assertNever(x: never): never {
  throw new Error(`Unhandled union member: ${JSON.stringify(x)}`);
}

function renderState(state: HttpRequestState): string {
  switch (state.status) {
    case "pending": return "Loading";
    case "success": return "Done";
    case "failed": return "Error";
    default: return assertNever(state); // Compiler error if any variant unhandled!
  }
}
```

### 8. User-Defined Type Predicates (`is`)
Functions whose return value acts as a custom type guard:
```typescript
function isForgeController(val: unknown): val is Controller {
  return typeof val === "object" && val !== null && "__isForgeController" in val;
}
```

### 9. Assertion Functions (`asserts`)
```typescript
function assertIsDefined<T>(val: T): asserts val is NonNullable<T> {
  if (val === undefined || val === null) {
    throw new Error(`Expected value to be defined, got ${val}`);
  }
}
```

---

## 3. Functions & Call Signatures

### Generic Functions
```typescript
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

### Function Overloads
When a function can be invoked with different argument combinations:
```typescript
export class Router {
  get<THandler extends Function>(path: string, handler: THandler): this;
  get<THandler extends Function>(path: string, middleware: Middleware[], handler: THandler): this;
  get(path: string, ...args: any[]): this {
    // implementation
    return this;
  }
}
```

### `this` Parameter Typing
```typescript
interface DatabaseContext {
  table: string;
}

function executeQuery(this: DatabaseContext, sql: string) {
  console.log(`Executing ${sql} on ${this.table}`);
}
```

---

## 4. Object Types & Classes

### Property Modifiers
* `readonly`: Prevents direct reassignment (`readonly id: string`). Note: does not make nested objects immutable.
* Optional (`?`): `name?: string`. Under `exactOptionalPropertyTypes: true`, `{ name: undefined }` is distinct from omitting `name`.

### Index Signatures
```typescript
interface Dictionary<T> {
  [key: string]: T;
}
```

### Parameter Properties in Classes
ForgeTS uses parameter properties in controllers, services, and models:
```typescript
export class UserService {
  constructor(
    private readonly db: DatabaseAdapter,
    protected readonly logger: Logger
  ) {}
}
```

---

## 5. Compiler Error Diagnostics Reference

| Error Code | Meaning | Typical Cause & Fix |
| :--- | :--- | :--- |
| **TS2322** | Type 'A' is not assignable to type 'B'. | Property mismatch, nullability violation, or missing property. Check strictNullChecks or add appropriate casting/narrowing. |
| **TS2345** | Argument of type 'A' not assignable to parameter of type 'B'. | Function call argument does not fulfill function signature requirements. |
| **TS2741** | Property 'X' is missing in type 'A' but required in type 'B'. | Incomplete object literal. Provide required property or make it optional (`?`) in interface. |
| **TS2532** | Object is possibly 'undefined'. | Accessing value without checking existence. Use optional chaining (`?.`), nullish coalescing (`??`), or `if (val)` guard. |
| **TS1208** | Cannot compile namespaces when '--isolatedModules' is enabled. | Avoid `namespace` or ensure file contains `export {}` or top-level import. |
| **TS1371** | This import syntax is not supported in the selected module resolution. | Ensure `import type` is used for type-only imports when `isolatedModules` or `verbatimModuleSyntax` is active. |
