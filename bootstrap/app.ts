// bootstrap/app.ts
// ─────────────────────────────────────────────────────────────────────
// Application bootstrap.
// Creates the Application, loads config, registers routes.
// This is the single wiring point for the entire app.
// ─────────────────────────────────────────────────────────────────────

import './env.js';
import { Application } from '@forge/core';
import appConfig from '@/config/app.js';
import databaseConfig from '@/config/database.js';
import apiRoutes from '@/routes/api.js';
import webRoutes from '@/routes/web.js';

// Create the application
const app = new Application();

// 1. Load environment variables
app.loadEnv();

// 2. Register configuration
app.configure('app', appConfig);
app.configure('database', databaseConfig);

// 3. Register routes
app.registerRoutes(webRoutes, { type: 'web' });   // Web routes first (serves /)
app.registerRoutes(apiRoutes, { prefix: '/api', type: 'api' });   // API routes under /api

export default app;
