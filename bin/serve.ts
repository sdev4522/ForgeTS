// bin/serve.ts
// ─────────────────────────────────────────────────────────────────────
// Entry point for `bun run serve` / `forge serve`.
// Imports the bootstrapped app and starts the HTTP server.
// If a top-level module / syntax error occurs during bootstrap,
// launches the Emergency Debug Server to render the error to the browser.
// ─────────────────────────────────────────────────────────────────────

import { ErrorDisplayEngine } from '@forge/core';

async function serve() {
  try {
    const appModule = await import('../bootstrap/app.js');
    const app = appModule.default;
    await app.start();
  } catch (err: unknown) {
    console.error('\n❌ [ForgeTS] Startup / Compilation Error:');
    console.error(err);

    const port = process.env.APP_PORT ? Number(process.env.APP_PORT) : 3000;
    const isDebug = process.env.APP_DEBUG !== 'false';

    if (isDebug) {
      console.log(`⚡ [ForgeTS] Emergency Debug Server running at http://localhost:${port}\n`);

      Bun.serve({
        port,
        fetch(req: Request) {
          const accept = req.headers.get('accept') ?? '';
          if (accept.includes('application/json') && !accept.includes('text/html')) {
            const e = err instanceof Error ? err : new Error(String(err));
            return Response.json(
              {
                error: e.message,
                name: e.name,
                stack: e.stack ? e.stack.split('\n').map((l) => l.trim()) : [],
              },
              { status: 500 },
            );
          }
          const html = ErrorDisplayEngine.renderHtml(err, req.url);
          return new Response(html, {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        },
      });
    }
  }
}

serve();
