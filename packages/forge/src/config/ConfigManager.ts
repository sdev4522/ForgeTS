// packages/forge/src/config/ConfigManager.ts
// ─────────────────────────────────────────────────────────────────────
// Central configuration store.
// Loads .env files at boot, then lazily loads config/*.ts modules.
// Access values via dot-notation: config('app.port')
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Parse a .env file into key-value pairs.
 * Minimal parser — handles `KEY=VALUE`, `KEY="VALUE"`, `KEY='VALUE'`,
 * comments (#), and empty lines. No dependency on `dotenv`.
 */
function parseDotEnv(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};

  const result: Record<string, string> = {};
  const content = readFileSync(filePath, 'utf-8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export class ConfigManager {
  private store: Map<string, unknown> = new Map();
  private configDir: string;
  private loaded = false;

  constructor(private rootDir: string) {
    this.configDir = join(rootDir, 'config');
  }

  /**
   * Load .env file and populate process.env.
   * Call this FIRST, before importing any config files.
   */
  loadEnv(envFile: string = '.env'): void {
    const envPath = resolve(this.rootDir, envFile);
    const vars = parseDotEnv(envPath);

    // Only set variables that aren't already in the environment.
    // Real env vars always take precedence over .env file values.
    for (const [key, value] of Object.entries(vars)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  /**
   * Register a config namespace (e.g., 'app', 'database') with its values.
   */
  set(namespace: string, values: Record<string, unknown>): void {
    this.store.set(namespace, values);
  }

  /**
   * Get a config value by dot-notation path.
   *
   * @example
   * ```ts
   * config.get<number>('app.port')       // 3000
   * config.get('database.default')       // 'sqlite'
   * config.get('app.missing', 'fallback') // 'fallback'
   * ```
   */
  get<T = unknown>(path: string, defaultValue?: T): T {
    const parts = path.split('.');
    const namespace = parts[0];
    const configObj = this.store.get(namespace);

    if (configObj === undefined) {
      return defaultValue as T;
    }

    // Traverse the nested object
    let current: unknown = configObj;
    for (let i = 1; i < parts.length; i++) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue as T;
      }
      current = (current as Record<string, unknown>)[parts[i]];
    }

    return (current ?? defaultValue) as T;
  }

  /**
   * Check if a config path exists.
   */
  has(path: string): boolean {
    const value = this.get(path);
    return value !== undefined;
  }

  /**
   * Get all config for a namespace.
   */
  all(namespace?: string): unknown {
    if (namespace) {
      return this.store.get(namespace);
    }
    return Object.fromEntries(this.store);
  }
}

// ─── Singleton & Global Accessor ───

let _instance: ConfigManager | null = null;

export function initConfig(rootDir: string): ConfigManager {
  _instance = new ConfigManager(rootDir);
  return _instance;
}

export function getConfigManager(): ConfigManager {
  if (!_instance) {
    throw new Error(
      '[ForgeTS] ConfigManager not initialized. Call initConfig() in your bootstrap.',
    );
  }
  return _instance;
}

/**
 * Global config accessor — the primary way user code reads config.
 *
 * @example
 * ```ts
 * import { config } from '@forge/core';
 * const port = config<number>('app.port');
 * ```
 */
export function config<T = unknown>(path: string, defaultValue?: T): T {
  return getConfigManager().get<T>(path, defaultValue);
}
