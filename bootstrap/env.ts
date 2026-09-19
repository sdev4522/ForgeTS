// bootstrap/env.ts
// ─────────────────────────────────────────────────────────────────────
// Early environment initialization.
// Executed as the first import in bootstrap/app.ts to ensure process.env
// is fully populated before any configuration files evaluate.
// ─────────────────────────────────────────────────────────────────────

import { bootstrapEnv } from '@forge/core';

bootstrapEnv();
