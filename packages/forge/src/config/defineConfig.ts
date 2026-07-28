// packages/forge/src/config/defineConfig.ts
// ─────────────────────────────────────────────────────────────────────
// Type-safe config definition helper.
// Freezes the object at definition time to prevent accidental mutation.
// ─────────────────────────────────────────────────────────────────────

/**
 * Define a typed configuration object. The returned object is frozen
 * (deeply immutable at the top level) to prevent runtime mutation.
 *
 * @example
 * ```ts
 * // config/app.ts
 * import { defineConfig, env } from '@forge/core';
 *
 * export default defineConfig({
 *   name: env('APP_NAME', 'MyApp'),
 *   port: env.number('APP_PORT', 3000),
 * });
 * ```
 */
export function defineConfig<T extends Record<string, unknown>>(config: T): Readonly<T> {
  return Object.freeze(config);
}
