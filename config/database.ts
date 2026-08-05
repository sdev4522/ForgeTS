// config/database.ts
// ─────────────────────────────────────────────────────────────────────
// Database configuration.
// Supports MySQL (SQL default) and MongoDB (NoSQL document store).
// ─────────────────────────────────────────────────────────────────────

import { defineConfig, env } from '@forge/core';

export default defineConfig({
  default: env('DB_CONNECTION', 'mysql'),

  connections: {
    mysql: {
      driver: 'mysql' as const,
      host: env('DB_HOST', '127.0.0.1'),
      port: env.number('DB_PORT', 3306),
      database: env('DB_DATABASE', 'forgets'),
      username: env('DB_USERNAME', 'root'),
      password: env('DB_PASSWORD', ''),
    },
    mongodb: {
      driver: 'mongodb' as const,
      uri: env('MONGO_URI', 'mongodb://127.0.0.1:27017'),
      database: env('MONGO_DB_NAME', 'forgets'),
    },
    postgres: {
      driver: 'postgres' as const,
      host: env('DB_HOST', '127.0.0.1'),
      port: env.number('DB_PORT', 5432),
      database: env('DB_DATABASE', 'forgets'),
      username: env('DB_USERNAME', 'root'),
      password: env('DB_PASSWORD', ''),
    },
  },
});
