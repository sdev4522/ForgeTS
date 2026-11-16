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
 * TC39 Stage 3 Decorators Architecture:
 * The TypeScript transpiler (tsx/esbuild) emits standard decorators with context.metadata support.
 * Rather than relying on experimental reflect-metadata or monkey-patching class prototypes,
 * ForgeTS attaches metadata directly to context.metadata[Symbol.for('forge:injectable')].
 * This avoids global pollution and ensures future-proof standards compliance.
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
