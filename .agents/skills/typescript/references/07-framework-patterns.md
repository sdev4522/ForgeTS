# TypeScript Reference: ForgeTS Framework Architecture Patterns

This guide details advanced TypeScript patterns specifically designed for developing, extending, and maintaining **ForgeTS** framework subsystems.

---

## 1. Type-Safe Routing & Route Parameter Parsing

ForgeTS defines routes with URL templates like `"/users/:id/posts/:postId"`. Using recursive template literal types, we can infer exact parameter types at compile-time:

```typescript
// Recursive parser extracting :param tokens:
export type ParseRouteParams<TPath extends string> =
  TPath extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ParseRouteParams<`/${Rest}`>]: string }
    : TPath extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : {};

// Strongly typed handler accepting inferred params:
export type RouteHandler<TPath extends string, TResponse = any> = (
  ctx: {
    params: ParseRouteParams<TPath>;
    query: Record<string, string | undefined>;
    req: Request;
  }
) => TResponse | Promise<TResponse>;

export class Router {
  get<TPath extends string>(path: TPath, handler: RouteHandler<TPath>): this {
    // Registers path and attaches typed handler
    return this;
  }
}

// Example usage:
const router = new Router();
router.get("/users/:userId/books/:bookId", (ctx) => {
  // ctx.params is strictly typed as: { userId: string; bookId: string }
  console.log(ctx.params.userId, ctx.params.bookId);
  return new Response("OK");
});
```

---

## 2. Strongly Typed Dependency Injection (IoC Container)

ForgeTS manages service instances, database adapters, and controllers via an inversion of control container:

```typescript
export type Constructor<T = any> = new (...args: any[]) => T;
export type Factory<T = any> = (container: Container) => T;
export type Token<T = any> = string | symbol | Constructor<T>;

export class Container {
  private bindings = new Map<any, any>();
  private singletons = new Map<any, any>();

  bind<T>(token: Token<T>, factory: Factory<T>): this {
    this.bindings.set(token, factory);
    return this;
  }

  singleton<T>(token: Token<T>, factory: Factory<T>): this {
    this.bindings.set(token, (c: Container) => {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, factory(c));
      }
      return this.singletons.get(token);
    });
    return this;
  }

  make<T>(token: Token<T>): T {
    const binding = this.bindings.get(token);
    if (binding) {
      return binding(this);
    }
    if (typeof token === "function") {
      // Automatic constructor reflection
      return new (token as Constructor<T>)();
    }
    throw new Error(`Cannot resolve binding for token: ${String(token)}`);
  }
}
```

---

## 3. ORM & Query Builder Type Inference

ForgeTS ORM integrates with database drivers (Kysely, MongoDB, MySQL). To ensure models have strictly typed attributes while supporting dynamic Active Record proxies:

```typescript
// Generic base model wrapping attributes in a Proxy:
export abstract class Model<TAttributes extends Record<string, any>> {
  protected _attributes: Partial<TAttributes> = {};

  constructor(attributes: Partial<TAttributes> = {}) {
    this._attributes = { ...attributes };
    return new Proxy(this, {
      get(target: any, prop: string | symbol) {
        if (prop in target) return target[prop];
        return target._attributes[prop];
      },
      set(target: any, prop: string | symbol, value: any) {
        if (prop in target) {
          target[prop] = value;
        } else {
          target._attributes[prop] = value;
        }
        return true;
      },
    });
  }

  toJSON(): TAttributes {
    return { ...this._attributes } as TAttributes;
  }
}

// Fluent Query Builder type inference:
export interface QueryBuilder<TRecord> {
  where<K extends keyof TRecord>(column: K, operator: "=" | "!=" | ">" | "<", value: TRecord[K]): this;
  select<K extends keyof TRecord>(...columns: K[]): QueryBuilder<Pick<TRecord, K>>;
  first(): Promise<TRecord | null>;
  all(): Promise<TRecord[]>;
}
```

---

## 4. Zod Request Body & Query Validation Pipeline

ForgeTS uses Zod for type-safe input validation, seamlessly inferring TypeScript types from runtime schemas:

```typescript
import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
  age: z.number().int().positive().optional(),
});

// Infer TypeScript type directly from schema:
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Typed validation middleware:
export function validateBody<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return async (req: Request): Promise<z.infer<TSchema>> => {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new Error(`Validation Error: ${JSON.stringify(result.error.flatten())}`);
    }
    return result.data;
  };
}
```

---

## 5. SSR & Hydration Boundary Type Safety

In ForgeTS, server controllers render React components to HTML during SSR, which are subsequently hydrated on the client. Type safety across this boundary guarantees that props passed from controllers match the page's React props:

```tsx
// resources/js/types/ssr.ts
export type SerializablePrimitive = string | number | boolean | null | undefined;
export type Serializable =
  | SerializablePrimitive
  | Serializable[]
  | { [key: string]: Serializable };

// Enforce that view data must be JSON-serializable across SSR boundary:
export type EnsureSerializable<T> = T extends SerializablePrimitive
  ? T
  : T extends Function
  ? never // Functions cannot cross SSR boundary!
  : T extends Array<infer U>
  ? EnsureSerializable<U>[]
  : T extends object
  ? { [K in keyof T]: EnsureSerializable<T[K]> }
  : never;

// Server controller rendering view:
export function renderView<TProps extends Record<string, Serializable>>(
  pageComponent: string,
  props: EnsureSerializable<TProps>
): Response {
  // Serializes props to JSON and renders HTML
  return new Response(`<!-- SSR Page: ${pageComponent} -->`);
}
```

---

## 6. Avoiding TypeScript Anti-Patterns in Framework Code

| Anti-Pattern | Why it Breaks Frameworks | Recommended Alternative |
| :--- | :--- | :--- |
| `any` for context data | Defeats autocomplete and hides breaking schema changes. | Use generics `HttpContext<TParams, TBody>` or declaration merging. |
| Type assertions (`as unknown as X`) | Masks architectural type mismatches. | Use proper discriminated unions, type guards, or narrowing predicates. |
| Swallowed error types (`catch (e: any)`) | Loses error context and types. | Use `catch (err: unknown)` and narrow with `err instanceof Error`. |
| Hardcoded path imports (`../.../../../core`) | Breaks when files are relocated or packaged. | Use configured path aliases (`@forge/core`, `@/services/*`). |
