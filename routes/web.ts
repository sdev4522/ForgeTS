// routes/web.ts
// ─────────────────────────────────────────────────────────────────────
// Web route definitions.
// Session-based HTML routes with CSRF token protection.
// ─────────────────────────────────────────────────────────────────────

import { Router, CsrfMiddleware } from '@forge/core';
import { WelcomeController } from '@/controllers/WelcomeController.js';
import { AboutController } from '@/controllers/AboutController.js';
import { UserController } from '@/controllers/UserController.js';

const router = new Router();

router.middleware(CsrfMiddleware);
router.controller(WelcomeController);
router.controller(AboutController);
router.controller(UserController);

export default router;
