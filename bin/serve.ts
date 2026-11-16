// bin/serve.ts
// ─────────────────────────────────────────────────────────────────────
// Entry point for `npm run serve` / `forge serve`.
// Imports the bootstrapped app and starts the HTTP server.
// If a top-level module / syntax error occurs during bootstrap in a
// development environment with APP_DEBUG enabled, launches the Emergency
// Debug Server to render the error to the browser.
// ─────────────────────────────────────────────────────────────────────

import { createServer, type Server } from 'node:http';
import { ErrorDisplayEngine, bootstrapEnv, env } from '@forge/core';
import { DevSupervisor } from './dev.js';

bootstrapEnv();

const isProduction = process.env.NODE_ENV === 'production';

async function serve() {
  let activeApp: { stop: () => Promise<void> } | null = null;
  let emergencyServer: Server | null = null;
  let shuttingDown = false;

  const handleShutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    // Never hang forever on a stuck connection
    setTimeout(() => process.exit(0), 5000).unref();
    try {
      if (activeApp) {
        await activeApp.stop();
        activeApp = null;
      }
      if (emergencyServer) {
        emergencyServer.close();
        emergencyServer.closeAllConnections();
        emergencyServer = null;
      }
    } catch {
      // Non-fatal cleanup
    }
    process.exit(0);
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);

  try {
    const appModule = await import('../bootstrap/app.js');
    const app = appModule.default;
    activeApp = app;
    await app.start();
  } catch (err: unknown) {
    console.error('\n[ForgeTS] Startup / Compilation Error:');
    console.error(err);

    // The emergency page exposes stack traces and source code: development only,
    // and only when debug mode is explicitly enabled.
    const isDebug = !isProduction && env.boolean('APP_DEBUG', false);
    if (!isDebug) {
      process.exit(1);
    }

    const port = env.number('APP_PORT', 3000);
    const hostname = env('APP_HOST', '127.0.0.1') || '127.0.0.1';

    emergencyServer = createServer((req, res) => {
      const accept = req.headers.accept ?? '';
      const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
      const noStore = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

      if (accept.includes('application/json') && !accept.includes('text/html')) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', ...noStore });
        res.end(JSON.stringify(ErrorDisplayEngine.renderJson(err, url)));
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8', ...noStore });
      res.end(ErrorDisplayEngine.renderHtml(err, url));
    });

    emergencyServer.once('error', (serveErr: any) => {
      if (serveErr?.code === 'EADDRINUSE') {
        console.error(`\n[ForgeTS] Emergency Debug Server failed: Port ${port} is already in use by another process.\n`);
      } else {
        console.error('\n[ForgeTS] Emergency Debug Server failed:', serveErr?.message);
      }
      process.exit(1);
    });

    emergencyServer.listen(port, hostname, () => {
      console.log(`[ForgeTS] Emergency Debug Server running at http://${hostname}:${port}\n`);
    });
  }
}

if (!isProduction && process.env.FORGETS_WORKER !== '1') {
  // Supervisor process: watches sources and (re)starts the worker.
  // It owns the only signal handlers here, so the worker is always stopped
  // before this process exits.
  const supervisor = new DevSupervisor({
    entryFile: import.meta.filename,
    env: { ...process.env, FORGETS_WORKER: '1' },
  });

  let terminating = false;
  const handleTermination = async () => {
    if (terminating) return;
    terminating = true;
    await supervisor.stop();
    process.exit(0);
  };

  process.on('SIGINT', handleTermination);
  process.on('SIGTERM', handleTermination);

  supervisor.start();
} else {
  serve();
}
