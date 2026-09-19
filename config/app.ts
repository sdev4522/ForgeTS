// config/app.ts
// ─────────────────────────────────────────────────────────────────────
// Core application configuration.
// ─────────────────────────────────────────────────────────────────────

import { defineConfig, env } from '@forge/core';

export default defineConfig({
  name: env('APP_NAME', 'ForgeTS'),
  env: env('NODE_ENV', 'development'),
  debug: env.boolean('APP_DEBUG', false),
  url: env('APP_URL', 'http://localhost:3000'),
  port: env.number('APP_PORT', 3000),
  timezone: env('APP_TIMEZONE', 'UTC'),
  locale: 'en',
});
