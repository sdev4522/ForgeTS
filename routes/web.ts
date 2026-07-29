// routes/web.ts
// ─────────────────────────────────────────────────────────────────────
// Web route definitions.
// Session-based HTML routes with CSRF token protection.
// ─────────────────────────────────────────────────────────────────────

import { Router, CsrfMiddleware } from '@forge/core';
import { WelcomeController } from '../app/controllers/WelcomeController.js';
import { TodoController } from '../app/controllers/TodoController.js';

const router = new Router();

router.middleware(CsrfMiddleware);
router.controller(WelcomeController);
router.controller(TodoController);

export default router;
