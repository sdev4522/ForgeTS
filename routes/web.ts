// routes/web.ts
// ─────────────────────────────────────────────────────────────────────
// Web route definitions.
// These routes serve HTML pages (session-based, CSRF-protected in future).
// ─────────────────────────────────────────────────────────────────────

import { Router } from '../packages/forge/src/index.js';
import { WelcomeController } from '../app/controllers/WelcomeController.js';

const router = new Router();

router.controller(WelcomeController);

export default router;
