// routes/api.ts
// ─────────────────────────────────────────────────────────────────────
// API route definitions.
// ─────────────────────────────────────────────────────────────────────

import { Router } from '@forge/core';
import { HealthController } from '../app/controllers/HealthController.js';
import { Todo } from '../app/models/Todo.js';
import { LogEntry } from '../app/models/LogEntry.js';

const router = new Router();

router.controller(HealthController);

router.get('/todos', async (_req, res) => {
  const todos = await Todo.all();
  return res.json(todos.map((t) => t.toJSON()));
});

router.post('/todos', async (_req, res) => {
  const todo = await Todo.create({ title: 'Bench Todo', completed: 0 });
  return res.status(201).json(todo.toJSON());
});

router.get('/logs', async (_req, res) => {
  const logs = await LogEntry.all();
  return res.json(logs.map((l) => l.toJSON()));
});

router.post('/logs', async (_req, res) => {
  const log = await LogEntry.create({ level: 'info', message: 'Bench log' });
  return res.status(201).json(log.toJSON());
});

export default router;
