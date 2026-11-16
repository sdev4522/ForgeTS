// packages/forge/src/config/bootstrapEnv.ts
// ─────────────────────────────────────────────────────────────────────
// Early Environment Bootstrapper.
// Synchronously loads .env into process.env before module configurations
// and route files are evaluated.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let _envBootstrapped = false;

/**
 * Parse .env file contents into key/value pairs.
 *
 * Supports `KEY=VALUE`, optional `export ` prefix, single/double quoted values
 * (double quotes understand \n, \r, \t escapes), full-line `#` comments, and
 * trailing ` # comments` after unquoted values.
 */
export function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('export ')) trimmed = trimmed.slice(7).trimStart();

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) continue;
    let value = trimmed.slice(eqIndex + 1).trim();

    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2) {
      const closing = value.indexOf(quote, 1);
      if (closing !== -1) {
        value = value.slice(1, closing);
        if (quote === '"') {
          value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
        }
        result[key] = value;
        continue;
      }
    }

    // Unquoted: strip a trailing inline comment (" # ...")
    const commentIndex = value.search(/\s#/);
    if (commentIndex !== -1) value = value.slice(0, commentIndex).trimEnd();

    result[key] = value;
  }

  return result;
}

/**
 * Synchronously load .env file into process.env if not already loaded.
 * Ensures system environment variables always take precedence.
 */
export function bootstrapEnv(rootDir: string = process.cwd(), envFile: string = '.env'): void {
  if (_envBootstrapped) {
    return;
  }

  const envPath = resolve(rootDir, envFile);
  if (!existsSync(envPath)) {
    _envBootstrapped = true;
    return;
  }

  try {
    const vars = parseEnv(readFileSync(envPath, 'utf-8'));
    for (const [key, value] of Object.entries(vars)) {
      // Existing process.env takes precedence over .env file
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Non-fatal if .env cannot be read
  }

  _envBootstrapped = true;
}

/**
 * Reset bootstrapped state (primarily for test isolation).
 */
export function resetBootstrapEnv(): void {
  _envBootstrapped = false;
}
