// packages/forge/src/container/Container.ts
// ─────────────────────────────────────────────────────────────────────
// Lightweight Dependency Injection container.
//
// PERFORMANCE: Uses a simple Map for O(1) resolution. No reflection,
// no proxy objects, no recursive scanning. Factories are plain functions.
//
// Supports two lifetimes:
// - singleton: one instance for the entire app lifecycle
// - transient: new instance on every resolve()
// ─────────────────────────────────────────────────────────────────────

export type Constructor<T = any> = new (...args: any[]) => T;
export type Factory<T = any> = () => T;
export type Token<T = any> = Constructor<T> | string | symbol;

interface Binding<T = any> {
  factory: Factory<T>;
  lifetime: 'singleton' | 'transient';
  instance?: T; // Cached instance for singletons
}

export class Container {
  private bindings: Map<Token, Binding> = new Map();

  /**
   * Bind a factory as transient (new instance every resolve).
   *
   * @example
   * ```ts
   * container.bind(UserService, () => new UserService());
   * ```
   */
  bind<T>(token: Token<T>, factory: Factory<T>): void {
    this.bindings.set(token, { factory, lifetime: 'transient' });
  }

  /**
   * Bind a factory as singleton (one instance, created on first resolve).
   *
   * @example
   * ```ts
   * container.singleton(DatabaseConnection, () => new DatabaseConnection(config));
   * ```
   */
  singleton<T>(token: Token<T>, factory: Factory<T>): void {
    this.bindings.set(token, { factory, lifetime: 'singleton' });
  }

  /**
   * Bind a pre-existing instance directly (always singleton).
   *
   * @example
   * ```ts
   * container.instance('config', configObject);
   * ```
   */
  instance<T>(token: Token<T>, value: T): void {
    this.bindings.set(token, {
      factory: () => value,
      lifetime: 'singleton',
      instance: value,
    });
  }

  /**
   * Resolve an instance from the container.
   *
   * @throws Error if no binding is found for the token.
   *
   * @example
   * ```ts
   * const userService = container.resolve(UserService);
   * const config = container.resolve<AppConfig>('config');
   * ```
   */
  resolve<T>(token: Token<T>): T {
    const binding = this.bindings.get(token);

    if (!binding) {
      // If the token is a constructor, try auto-binding it as transient
      if (typeof token === 'function') {
        const instance = new token();
        return instance;
      }

      throw new Error(
        `[ForgeTS] No binding found for: ${String(token)}. ` +
          `Register it in a provider using container.bind() or container.singleton().`,
      );
    }

    if (binding.lifetime === 'singleton') {
      if (binding.instance === undefined) {
        binding.instance = binding.factory();
      }
      return binding.instance as T;
    }

    // Transient: new instance every time
    return binding.factory() as T;
  }

  /**
   * Check if a binding exists.
   */
  has(token: Token): boolean {
    return this.bindings.has(token);
  }

  /**
   * Remove a binding.
   */
  unbind(token: Token): void {
    this.bindings.delete(token);
  }

  /**
   * Create a child container that inherits parent bindings
   * but can override them without affecting the parent.
   * Useful for request-scoped containers.
   */
  createChild(): Container {
    const child = new Container();
    // Copy parent bindings (shallow — singletons are shared)
    for (const [token, binding] of this.bindings) {
      child.bindings.set(token, { ...binding });
    }
    return child;
  }

  /**
   * Get all registered binding tokens (for debugging/CLI).
   */
  getBindings(): Token[] {
    return [...this.bindings.keys()];
  }
}
