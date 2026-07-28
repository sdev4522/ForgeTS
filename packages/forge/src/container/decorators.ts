// packages/forge/src/container/decorators.ts
// ─────────────────────────────────────────────────────────────────────
// DI decorators using TC39 Stage 3 standard.
// ─────────────────────────────────────────────────────────────────────

export const INJECTABLE_META = Symbol.for('forge:injectable');

export interface InjectableOptions {
  /** 'singleton' = one instance for the app; 'transient' = new instance per resolve. */
  lifetime?: 'singleton' | 'transient';
}

/**
 * Mark a class as injectable into the DI container.
 *
 * @example
 * ```ts
 * @Injectable({ lifetime: 'singleton' })
 * export class UserService { ... }
 * ```
 */
export function Injectable(options: InjectableOptions = {}) {
  return function (_target: new (...args: any[]) => any, context: ClassDecoratorContext) {
    context.metadata[INJECTABLE_META] = {
      lifetime: options.lifetime ?? 'transient',
    };
  };
}
