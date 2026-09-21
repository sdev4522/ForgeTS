# TypeScript Reference: Type Manipulation & Generics

This reference covers advanced type-level programming, generics, type operators, conditional types, mapped types, and template literals based on the official [TypeScript Type Manipulation Guide](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html).

---

## 1. Generics & Constraints

### Generic Functions & Classes
Generics allow functions, classes, and interfaces to operate over a variety of types while retaining type fidelity.

```typescript
// Generic class:
export class Collection<TItem> {
  constructor(private items: TItem[] = []) {}

  all(): TItem[] {
    return [...this.items];
  }

  find(predicate: (item: TItem) => boolean): TItem | undefined {
    return this.items.find(predicate);
  }
}
```

### Generic Constraints (`extends`)
Restrict the shapes that a generic type parameter can accept:
```typescript
interface HasId {
  id: string | number;
}

function findById<T extends HasId>(items: T[], id: string | number): T | undefined {
  return items.find(item => item.id === id);
}
```

### Using Type Parameters in Generic Constraints
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Default Type Arguments
```typescript
interface ApiResponse<TData = unknown, TMeta = Record<string, any>> {
  data: TData;
  meta?: TMeta;
  timestamp: number;
}
```

---

## 2. Key Operators: `keyof` and `typeof`

### The `keyof` Operator
Takes an object type and produces a string or numeric literal union of its keys:
```typescript
type UserModel = {
  id: number;
  name: string;
  email: string;
};

type UserKey = keyof UserModel; // "id" | "name" | "email"
```

### The `typeof` Type Operator
Refers to the compile-time type of a runtime variable or expression:
```typescript
const appConfig = {
  port: 3000,
  host: "localhost",
  env: "production" as const,
};

type AppConfig = typeof appConfig;
// { port: number; host: string; env: "production" }
```

### Combining `ReturnType<typeof function>`
```typescript
function createServer() {
  return {
    listen: (port: number) => {},
    close: () => {},
  };
}

type ServerInstance = ReturnType<typeof createServer>;
```

---

## 3. Indexed Access Types (`Type[Key]`)

Look up a specific property type on another type:
```typescript
type Person = { age: number; name: string; alive: boolean };
type Age = Person["age"]; // number

// Using unions of keys:
type AgeOrName = Person["age" | "name"]; // number | string

// Using keyof:
type AllPropertyTypes = Person[keyof Person]; // number | string | boolean

// Accessing array element types via number:
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number]; // "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
```

---

## 4. Conditional Types

Conditional types select one of two possible types based on a subtyping relationship:
```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false
```

### Distributive Conditional Types
When conditional types act on a generic parameter that is a union, they distribute over the union:
```typescript
type ToArray<T> = T extends any ? T[] : never;

type StrOrNumArr = ToArray<string | number>; 
// Evaluates to: ToArray<string> | ToArray<number> => string[] | number[]
```
To avoid distribution, wrap each side of `extends` in square brackets:
```typescript
type ToArrayNonDistributive<T> = [T] extends [any] ? T[] : never;
type StrOrNumArrTogether = ToArrayNonDistributive<string | number>; // (string | number)[]
```

---

## 5. Inferring Within Conditional Types (`infer`)

The `infer` keyword allows extracting a component type from a larger generic type:

### 1. Extract Return Type
```typescript
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
```

### 2. Extract Promise Inner Type (`Awaited`)
```typescript
type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T;
```

### 3. Extract Array Element Type
```typescript
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
```

### 4. Extract Controller Action Parameter
```typescript
type ActionPayload<T> = T extends (req: any, body: infer P) => any ? P : never;
```

---

## 6. Mapped Types

Mapped types build new types by transforming each property in an existing type:

```typescript
type ReadonlyRecord<T> = {
  readonly [P in keyof T]: T[P];
};

type OptionalRecord<T> = {
  [P in keyof T]?: T[P];
};
```

### Mapping Modifiers (`+` and `-`)
You can add or remove `readonly` and `?` (optional):
```typescript
// Removes 'readonly' attributes from a type's properties:
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// Removes 'optional' attributes from a type's properties:
type Concrete<T> = {
  [P in keyof T]-?: T[P];
};
```

### Key Remapping via `as`
Filter or transform keys during mapping:
```typescript
// Prefix all keys with 'get':
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User {
  id: number;
  name: string;
}

type UserGetters = Getters<User>;
// { getId: () => number; getName: () => string }

// Filter out specific properties (by returning 'never'):
type RemovePrivateFields<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};
```

---

## 7. Template Literal Types

Template literal types build upon string literal types and can expand into many strings via unions:

```typescript
type Event = "create" | "update" | "delete";
type Resource = "user" | "post" | "comment";

type EventName = `${Resource}:${Event}`;
// "user:create" | "user:update" | "user:delete" | "post:create" ...
```

### Built-in String Manipulation Utilities
* `Uppercase<StringType>`: Converts each character in string to uppercase.
* `Lowercase<StringType>`: Converts each character in string to lowercase.
* `Capitalize<StringType>`: Converts first character to uppercase.
* `Uncapitalize<StringType>`: Converts first character to lowercase.

### Extracting Path Parameters from Route Templates
```typescript
// Extracts ':param' from a route string like "/users/:id/posts/:postId"
export type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<`/${Rest}`>]: string }
    : T extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : {};

type Params = ExtractRouteParams<"/users/:userId/comments/:commentId">;
// { userId: string; commentId: string }
```

---

## 8. Recursive & Deep Utility Types

```typescript
// Deep Partial: recursively makes all properties optional
export type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? DeepPartial<U>[]
  : T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

// Deep Readonly: recursively freezes all properties
export type DeepReadonly<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;
```
