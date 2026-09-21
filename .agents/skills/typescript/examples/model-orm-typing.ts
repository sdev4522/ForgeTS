/**
 * Strongly Typed Active Record / ORM Model Pattern for ForgeTS
 * 
 * Demonstrates:
 * 1. Proxy-based dynamic attribute access with compile-time type safety.
 * 2. Fluent query builder method chaining.
 * 3. Serialization safety across boundaries.
 */

export interface ModelMetadata {
  table: string;
  primaryKey?: string;
}

export abstract class BaseModel<TAttributes extends Record<string, any>> {
  protected _attributes: Partial<TAttributes> = {};
  protected _isDirty: boolean = false;

  constructor(attributes: Partial<TAttributes> = {}) {
    this._attributes = { ...attributes };

    // Dynamic Proxy: intercept attribute access and route to _attributes
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
          target._isDirty = true;
        }
        return true;
      },
    });
  }

  getAttributes(): Readonly<Partial<TAttributes>> {
    return { ...this._attributes };
  }

  toJSON(): TAttributes {
    return { ...this._attributes } as TAttributes;
  }
}

// Fluent Query Builder interface
export interface QueryBuilder<TRecord> {
  where<K extends keyof TRecord>(column: K, operator: "=" | "!=" | ">" | "<", value: TRecord[K]): this;
  select<K extends keyof TRecord>(...columns: K[]): QueryBuilder<Pick<TRecord, K>>;
  first(): Promise<TRecord | null>;
  all(): Promise<TRecord[]>;
}

// Concrete Model Example
export interface UserAttributes {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: Date;
}

export class User extends BaseModel<UserAttributes> {
  static table = "users";

  // Type helper for IDE intellisense when not using class field declarations
  declare id: number;
  declare name: string;
  declare email: string;
  declare role: "admin" | "member";
  declare createdAt: Date;

  isAdmin(): boolean {
    return this.role === "admin";
  }
}

// ==========================================
// Verification & Usage Example
// ==========================================
const user = new User({
  id: 1,
  name: "Jane Doe",
  email: "jane@example.com",
  role: "admin",
  createdAt: new Date(),
});

console.log(`User ${user.name} is admin: ${user.isAdmin()}`);
const json = user.toJSON();
console.log(`Serialized User: ${JSON.stringify(json)}`);
