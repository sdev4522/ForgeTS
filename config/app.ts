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
  host: env('APP_HOST', '127.0.0.1'),
  port: env.number('APP_PORT', 3000),
  // Set true only when running behind a reverse proxy you control: enables
  // X-Forwarded-For / X-Forwarded-Proto for req.ip() and req.isSecure().
  trustProxy: env.boolean('APP_TRUST_PROXY', false),
  // Maximum accepted request body size in bytes.
  maxBodySize: env.number('APP_MAX_BODY_SIZE', 10 * 1024 * 1024),
  timezone: env('APP_TIMEZONE', 'UTC'),
  locale: 'en',
});
