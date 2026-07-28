// config/app.ts
// ─────────────────────────────────────────────────────────────────────
// Application configuration.
// Values come from .env with sensible defaults.
// ─────────────────────────────────────────────────────────────────────

import { defineConfig, env } from '../packages/forge/src/index.js';

export default defineConfig({
  name: env('APP_NAME', 'ForgeTS'),
  port: env.number('APP_PORT', 3000),
  environment: env('NODE_ENV', 'development'),
  debug: env.boolean('APP_DEBUG', true),
  url: env('APP_URL', 'http://localhost:3000'),
  timezone: env('APP_TIMEZONE', 'UTC'),
});
