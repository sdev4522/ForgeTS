// routes/api.ts
// ─────────────────────────────────────────────────────────────────────
// API route definitions.
// This is the "table of contents" for your API — import controllers
// and register them here. NO business logic in this file.
// ─────────────────────────────────────────────────────────────────────

import { Router } from '../packages/forge/src/index.js';
import { HealthController } from '../app/controllers/HealthController.js';

const router = new Router();

// ─── API v1 Routes ───
router.group({ prefix: '/api' }, () => {
  router.controller(HealthController);
});

export default router;
