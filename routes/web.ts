// routes/web.ts
// ─────────────────────────────────────────────────────────────────────
// Web route definitions.
// Session-based HTML routes with CSRF token protection.
// ─────────────────────────────────────────────────────────────────────

import { Router, CsrfMiddleware } from '@forge/core';
import { WelcomeController } from '@/controllers/WelcomeController.js';

const router = new Router();

router.middleware(CsrfMiddleware);
router.controller(WelcomeController);

export default router;
