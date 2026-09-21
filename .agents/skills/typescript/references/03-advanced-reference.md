# TypeScript Reference: Language Reference & Advanced Concepts

This reference covers decorators, declaration merging, built-in utility types, JSX/TSX typing, mixins, and structural typing based on the official [TypeScript Language Reference](https://www.typescriptlang.org/docs/handbook/declaration-merging.html).

---

## 1. Decorators: Legacy vs. Stage 3

TypeScript supports two decorator paradigms:
1. **Experimental Decorators (Legacy)**: Enabled via `"experimentalDecorators": true` and `"emitDecoratorMetadata": true` using `reflect-metadata`. Widely used in NestJS, TypeORM, and ForgeTS core.
2. **Stage 3 Decorators (Modern ECMAScript standard)**: Native in TypeScript 5.0+ without requiring experimental flags.

### Legacy Decorators & `reflect-metadata`
In ForgeTS, decorators annotate classes, methods, accessors, and properties:

```typescript
import "reflect-metadata";

// Class Decorator:
export function Controller(prefix: string = ""): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata("prefix", prefix, target);
  };
}

// Method Decorator:
export function Get(path: string = ""): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata("path", path, descriptor.value);
    Reflect.defineMetadata("method", "GET", descriptor.value);
  };
}

// Parameter Decorator:
export function Param(paramName: string): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingParams = Reflect.getOwnMetadata("params", target, propertyKey!) || [];
    existingParams.push({ index: parameterIndex, name: paramName });
    Reflect.defineMetadata("params", existingParams, target, propertyKey!);
  };
}
```

### Stage 3 Decorators (TS 5.0+)
Stage 3 decorators use context objects:
```typescript
type ClassMethodDecorator = (
  target: Function,
  context: ClassMethodDecoratorContext
) => Function | void;

export function LogTime(): ClassMethodDecorator {
  return function (target, context) {
    const methodName = String(context.name);
    return function (this: any, ...args: any[]) {
      const start = performance.now();
      const result = target.apply(this, args);
      console.log(`${methodName} took ${(performance.now() - start).toFixed(2)}ms`);
      return result;
    };
  };
}
```

---

## 2. Declaration Merging

Declaration merging means the compiler merges two separate declarations declared with the same name into a single definition.

### 1. Interface Merging
Most critical for framework extensibility (plugins, session data, container bindings):
```typescript
interface SessionData {
  userId?: string;
}

// In an auth plugin:
interface SessionData {
  roles?: string[];
  permissions?: string[];
}

// Resulting SessionData has userId, roles, and permissions.
```

### 2. Merging Namespaces with Classes & Functions
Allows attaching static helper functions or types directly to a class or function:
```typescript
export class Route {
  constructor(public path: string) {}
}

export namespace Route {
  export type Handler = (req: Request) => Response | Promise<Response>;
  export function create(path: string): Route {
    return new Route(path);
  }
}

// Usage:
const r = Route.create("/home");
let h: Route.Handler;
```

---

## 3. Built-in Utility Types Reference

| Utility Type | Definition / Transform | Example Usage |
| :--- | :--- | :--- |
| `Partial<T>` | Makes all properties in `T` optional | `Partial<User>` for update DTOs |
| `Required<T>` | Makes all properties in `T` required | `Required<Config>` after defaults applied |
| `Readonly<T>` | Makes all properties in `T` readonly | `Readonly<State>` to enforce immutability |
| `Record<K, T>` | Constructs object type with keys `K` and values `T` | `Record<string, Controller>` |
| `Pick<T, K>` | Selects subset of properties `K` from `T` | `Pick<User, "id" | "email">` |
| `Omit<T, K>` | Removes properties `K` from `T` | `Omit<User, "passwordHash">` |
| `Exclude<T, U>` | Excludes types from `T` that are assignable to `U` | `Exclude<"a" | "b" | "c", "a">` => `"b" | "c"` |
| `Extract<T, U>` | Extracts types from `T` that are assignable to `U` | `Extract<string | number, string>` => `string` |
| `NonNullable<T>` | Excludes `null` and `undefined` from `T` | `NonNullable<string | null>` => `string` |
| `Parameters<T>` | Obtains tuple of parameters of function type `T` | `Parameters<typeof router.get>` |
| `ConstructorParameters<T>` | Obtains tuple of constructor parameters of `T` | `ConstructorParameters<typeof User>` |
| `ReturnType<T>` | Obtains return type of function type `T` | `ReturnType<typeof fetchUser>` |
| `InstanceType<T>` | Obtains instance type of a constructor function | `InstanceType<typeof Model>` |
| `Awaited<T>` | Recursively unwraps promises | `Awaited<Promise<Promise<string>>>` => `string` |

---

## 4. JSX / TSX Typing in ForgeTS (React 19 & SSR)

ForgeTS supports React 19 SSR and client-side hydration:

```tsx
import type { FC, ReactNode, JSX } from "react";

// Typed component props:
export interface UserPageProps {
  user: { id: string; name: string; email: string };
  canEdit?: boolean;
  children?: ReactNode;
}

export const UserPage: FC<UserPageProps> = ({ user, canEdit = false }) => {
  return (
    <div className="user-profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      {canEdit && <button>Edit Profile</button>}
    </div>
  );
};
```

### Key TSX Compiler Configurations:
* `"jsx": "react-jsx"`: Emits `_jsx` runtime calls automatically without needing `import React from 'react'`.
* `"types": ["bun-types"]`: Provides ambient types for Bun runtime while preserving `@types/react` for components.

---

## 5. Mixins Pattern

A mixin is a function that takes a class constructor and returns an extended class constructor:

```typescript
type Constructor<T = {}> = new (...args: any[]) => T;

export function Timestampable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    touch() {
      this.updatedAt = new Date();
    }
  };
}

class BaseModel {}
class User extends Timestampable(BaseModel) {}

const user = new User();
user.touch();
console.log(user.createdAt);
```

---

## 6. Type Compatibility & Structural Typing

TypeScript uses **structural typing** (duck typing). If two objects have the same shape, they are compatible regardless of whether they implement the same nominal interface.

### Function Parameter Bivariance vs. Strict Function Types
Under `"strictFunctionTypes": true`:
* Function parameter types are checked **contravariantly**.
* Method syntax in interfaces is checked **bivariantly** (for historical compatibility).

```typescript
// Function property syntax (checked contravariantly under strictFunctionTypes):
interface AnimalHandlerStrict {
  handle: (animal: Animal) => void;
}

// Method syntax (checked bivariantly):
interface AnimalHandlerMethod {
  handle(animal: Animal): void;
}
```
*Rule of Thumb for Frameworks*: Use function property syntax for callback properties in config interfaces to ensure strict type safety.
