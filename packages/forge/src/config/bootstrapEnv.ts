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
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

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
