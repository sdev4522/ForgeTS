import React from 'react';
import { DocsLayout } from '../../components/DocsLayout.js';

export default function DocsGettingStarted() {
  return (
    <DocsLayout currentPath="/docs" title="🚀 Getting Started">
      <p style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '2rem' }}>
        ForgeTS is a batteries-included, TypeScript-first web framework running on Bun.
        It brings Laravel's developer experience to the JavaScript/TypeScript ecosystem.
      </p>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>Prerequisites</h2>
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            ForgeTS requires <strong>Bun 1.3+</strong> runtime. Uses MySQL (or Docker Compose) for database storage.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>1. Start Development Server</h2>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#38bdf8' }}>
          bun run dev
        </pre>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>2. Create Your First Controller</h2>
        <p style={{ color: '#94a3b8', marginBottom: '0.75rem' }}>
          Controllers use TC39 Stage 3 class decorators (`@Controller`, `@Get`, `@Post`).
        </p>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`// app/controllers/HelloController.ts
import { Controller, Get, Request, ForgeResponse } from '@forge/core';

@Controller('/hello')
export class HelloController {
  @Get('/')
  async index(_req: Request, res: ForgeResponse) {
    return res.json({ message: 'Hello from ForgeTS!' });
  }
}`}
        </pre>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>3. Register Controller in Web Routes</h2>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`// routes/web.ts
import { Router } from '@forge/core';
import { HelloController } from '../app/controllers/HelloController.js';

const router = new Router();
router.controller(HelloController);

export default router;`}
        </pre>
      </section>
    </DocsLayout>
  );
}
