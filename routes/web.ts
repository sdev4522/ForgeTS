// routes/web.ts
// ─────────────────────────────────────────────────────────────────────
// Web route definitions.
// Session-based HTML routes with CSRF token protection.
// ─────────────────────────────────────────────────────────────────────

import { Router, CsrfMiddleware } from '@forge/core';
import { WelcomeController } from '../app/controllers/WelcomeController.js';
import { TodoController } from '../app/controllers/TodoController.js';
import { NoteController } from '../app/controllers/NoteController.js';
import { DocsController } from '../app/controllers/DocsController.js';
import { LogController } from '../app/controllers/LogController.js';

const router = new Router();

router.middleware(CsrfMiddleware);
router.controller(WelcomeController);
router.controller(TodoController);
router.controller(NoteController);
router.controller(DocsController);
router.controller(LogController);

export default router;
