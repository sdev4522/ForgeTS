// routes/web.ts
// ─────────────────────────────────────────────────────────────────────
// Web route definitions.
// These routes serve HTML pages (session-based, CSRF-protected in future).
// ─────────────────────────────────────────────────────────────────────

import { Router } from '@forge/core';
import { WelcomeController } from '../app/controllers/WelcomeController.js';
import { TodoController } from '../app/controllers/TodoController.js';

const router = new Router();

router.controller(WelcomeController);
router.controller(TodoController);

export default router;
