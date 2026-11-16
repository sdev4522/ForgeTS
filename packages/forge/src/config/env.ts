// packages/forge/src/config/env.ts
// ─────────────────────────────────────────────────────────────────────
// Ultra-lightweight environment variable reader.
// No dependencies. No runtime overhead. Just reads process.env.
// ─────────────────────────────────────────────────────────────────────

/**
 * Read a string environment variable with an optional default.
 *
 * @example
 * ```ts
 * const appName = env('APP_NAME', 'ForgeTS');
 * ```
 */
export function env(key: string, defaultValue: string = ''): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Read an environment variable as a number.
 * Returns `defaultValue` if the variable is unset or not a valid number.
 */
env.number = (key: string, defaultValue: number = 0): number => {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Read an environment variable as a boolean.
 * Truthy values: `"true"`, `"1"`, `"yes"`, `"on"` (case-insensitive, trimmed).
 * Falsy values: `"false"`, `"0"`, `"no"`, `"off"` (case-insensitive, trimmed).
 * Returns `defaultValue` if unset or unrecognized.
 */
env.boolean = (key: string, defaultValue: boolean = false): boolean => {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  const val = raw.trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(val)) return false;
  if (['true', '1', 'yes', 'on'].includes(val)) return true;
  return defaultValue;
};

/**
 * Read a required environment variable. Throws at boot if missing.
 * Use this for secrets and critical config that must never have defaults.
 */
env.required = (key: string): string => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(
      `[ForgeTS] Missing required environment variable: ${key}. ` +
        `Add it to your .env file or set it in your environment.`,
    );
  }
  return value;
};
