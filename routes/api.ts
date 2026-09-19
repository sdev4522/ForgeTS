// routes/api.ts
// ─────────────────────────────────────────────────────────────────────
// API route definitions.
// ─────────────────────────────────────────────────────────────────────

import { Router } from '@forge/core';
import { UserController } from '@/controllers/UserController.js';

const router = new Router();

// ─────────────────────────────────────────────────────────────────────
// Define application API routes here:
// ─────────────────────────────────────────────────────────────────────

router.controller(UserController);

export default router;
