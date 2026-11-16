// packages/forge/src/config/defineConfig.ts
// ─────────────────────────────────────────────────────────────────────
// Type-safe config definition helper.
// Freezes the object at definition time to prevent accidental mutation.
// ─────────────────────────────────────────────────────────────────────

/**
 * Define a typed configuration object. The returned object is deeply frozen
 * (nested plain objects and arrays included) to prevent runtime mutation.
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
  return deepFreeze(config);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      // Only plain data is frozen; class instances (drivers, clients) are left alone
      if (Array.isArray(nested) || (nested && Object.getPrototypeOf(nested) === Object.prototype)) {
        deepFreeze(nested);
      }
    }
  }
  return value;
}
