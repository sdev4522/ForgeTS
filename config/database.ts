// config/database.ts
// ─────────────────────────────────────────────────────────────────────
// Database configuration.
// Supports SQLite (default), PostgreSQL, and MySQL.
// ─────────────────────────────────────────────────────────────────────

import { defineConfig, env } from '../packages/forge/src/index.js';

export default defineConfig({
  default: env('DB_CONNECTION', 'sqlite'),

  connections: {
    sqlite: {
      driver: 'sqlite' as const,
      filename: env('DB_FILENAME', './storage/database.sqlite'),
    },
    postgres: {
      driver: 'postgres' as const,
      host: env('DB_HOST', '127.0.0.1'),
      port: env.number('DB_PORT', 5432),
      database: env('DB_DATABASE', 'forge'),
      user: env('DB_USER', 'forge'),
      password: env('DB_PASSWORD', ''),
    },
  },
});
