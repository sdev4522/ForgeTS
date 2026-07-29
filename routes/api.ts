// routes/api.ts
// ─────────────────────────────────────────────────────────────────────
// API route definitions.
// All routes in this file are automatically prefixed with `/api`.
// ─────────────────────────────────────────────────────────────────────

import { Router } from '@forge/core';
import { HealthController } from '../app/controllers/HealthController.js';

const router = new Router('/api');

router.controller(HealthController);

export default router;
