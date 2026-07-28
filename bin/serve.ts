// bin/serve.ts
// ─────────────────────────────────────────────────────────────────────
// Entry point for `bun run serve` / `forge serve`.
// Imports the bootstrapped app and starts the HTTP server.
// ─────────────────────────────────────────────────────────────────────

import app from '../bootstrap/app.js';

app.start();
