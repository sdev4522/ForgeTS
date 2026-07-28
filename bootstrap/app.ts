// bootstrap/app.ts
// ─────────────────────────────────────────────────────────────────────
// Application bootstrap.
// Creates the Application, loads config, registers routes.
// This is the single wiring point for the entire app.
// ─────────────────────────────────────────────────────────────────────

import { Application } from '../packages/forge/src/index.js';
import appConfig from '../config/app.js';
import apiRoutes from '../routes/api.js';
import webRoutes from '../routes/web.js';

// Create the application
const app = new Application();

// 1. Load environment variables
app.loadEnv();

// 2. Register configuration
app.configure('app', appConfig);

// 3. Register routes
app.registerRoutes(webRoutes);   // Web routes first (serves /)
app.registerRoutes(apiRoutes);   // API routes under /api

export default app;
