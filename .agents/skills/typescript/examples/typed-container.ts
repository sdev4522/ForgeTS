/**
 * Strongly Typed Dependency Injection Container Pattern for ForgeTS
 * 
 * Demonstrates:
 * 1. Binding abstract tokens or class constructors to concrete instances/factories.
 * 2. Declaration merging support for string tokens.
 * 3. Singleton lifecycle management.
 */

export type Constructor<T = any> = new (...args: any[]) => T;
export type ServiceFactory<T = any> = (container: TypedContainer) => T;

// Registry interface designed for user declaration merging
export interface ServiceBindings {
  // Can be extended via declaration merging in user code
}

export type ServiceToken<T> =
  | (T extends keyof ServiceBindings ? T : never)
  | Constructor<T>
  | (string & { __type?: T });

export class TypedContainer {
  private factories = new Map<any, ServiceFactory>();
  private singletons = new Map<any, any>();

  /**
   * Bind a transient factory
   */
  bind<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): this {
    this.factories.set(token, factory);
    return this;
  }

  /**
   * Bind a singleton factory
   */
  singleton<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): this {
    this.factories.set(token, (c: TypedContainer) => {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, factory(c));
      }
      return this.singletons.get(token);
    });
    return this;
  }

  /**
   * Resolve a token from registered ServiceBindings interface
   */
  make<K extends keyof ServiceBindings>(token: K): ServiceBindings[K];
  /**
   * Resolve a token by class constructor
   */
  make<T>(token: Constructor<T>): T;
  /**
   * Fallback resolution
   */
  make<T = unknown>(token: any): T;
  make(token: any): any {
    const factory = this.factories.get(token);
    if (factory) {
      return factory(this);
    }

    if (typeof token === "function") {
      // Auto-instantiate class constructor if not explicitly bound
      return new token();
    }

    throw new Error(`[TypedContainer] Unbound token: ${String(token)}`);
  }
}

// ==========================================
// Verification & Usage Example
// ==========================================
class DatabaseConnection {
  query(sql: string) {
    return `Results for ${sql}`;
  }
}

class UserRepository {
  constructor(private db: DatabaseConnection = new DatabaseConnection()) {}
  findUser(id: string) {
    return this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
  }
}

const container = new TypedContainer();
container.singleton(DatabaseConnection, () => new DatabaseConnection());
container.bind(UserRepository, (c) => new UserRepository(c.make(DatabaseConnection)));

const repo = container.make(UserRepository);
console.log(repo.findUser("101"));
