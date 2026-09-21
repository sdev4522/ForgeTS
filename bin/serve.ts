// bin/serve.ts
// ─────────────────────────────────────────────────────────────────────
// Entry point for `bun run serve` / `forge serve`.
// Imports the bootstrapped app and starts the HTTP server.
// If a top-level module / syntax error occurs during bootstrap,
// launches the Emergency Debug Server to render the error to the browser.
// ─────────────────────────────────────────────────────────────────────

import { ErrorDisplayEngine, bootstrapEnv } from '@forge/core';
import { DevSupervisor } from './dev.js';

bootstrapEnv();

let activeApp: { stop: () => Promise<void> } | null = null;
let emergencyServer: ReturnType<typeof Bun.serve> | null = null;

async function handleShutdown() {
  try {
    if (activeApp) {
      await activeApp.stop();
      activeApp = null;
    }
    if (emergencyServer) {
      emergencyServer.stop(true);
      emergencyServer = null;
    }
  } catch {
    // Non-fatal cleanup
  }
  process.exit(0);
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

async function serve() {
  try {
    const appModule = await import('../bootstrap/app.js');
    const app = appModule.default;
    activeApp = app;
    await app.start();
  } catch (err: unknown) {
    console.error('\n[ForgeTS] Startup / Compilation Error:');
    console.error(err);

    const port = process.env.APP_PORT ? Number(process.env.APP_PORT) : 3000;
    const isDebug = process.env.APP_DEBUG !== 'false';

    if (isDebug) {
      console.log(`[ForgeTS] Emergency Debug Server running at http://localhost:${port}\n`);

      try {
        emergencyServer = Bun.serve({
          port,
          fetch(req: Request) {
            const accept = req.headers.get('accept') ?? '';
            if (accept.includes('application/json') && !accept.includes('text/html')) {
              return Response.json(
                ErrorDisplayEngine.renderJson(err, req.url),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
              );
            }
            const html = ErrorDisplayEngine.renderHtml(err, req.url);
            return new Response(html, {
              status: 500,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          },
        });
      } catch (serveErr: any) {
        if (serveErr?.code === 'EADDRINUSE' || String(serveErr?.message).includes('address already in use')) {
          console.error(`\n[ForgeTS] Emergency Debug Server failed: Port ${port} is already in use by another process.\n`);
      }
    }
  }
}
}

if (process.env.NODE_ENV !== 'production' && process.env.FORGETS_WORKER !== '1') {
  const supervisor = new DevSupervisor({
    entryFile: import.meta.filename,
    env: { ...process.env, FORGETS_WORKER: '1' },
  });

  const handleTermination = async () => {
    await supervisor.stop();
    process.exit(0);
  };

  process.on('SIGINT', handleTermination);
  process.on('SIGTERM', handleTermination);

  supervisor.start();
} else {
  serve();
}

