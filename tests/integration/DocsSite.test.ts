import { describe, test, expect } from 'bun:test';
import app from '../../bootstrap/app.js';

describe('Minimal Documentation Site Routes (React SSR Dogfooding)', () => {
  test('1. GET /docs renders Getting Started page', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/docs', {
        headers: { accept: 'text/html' },
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Getting Started');
    expect(html).toContain('bun run dev');
    expect(html).toContain('HelloController');
  });

  test('2. GET /docs/routing renders Routing & Decorators page', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/docs/routing', {
        headers: { accept: 'text/html' },
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Routing');
    expect(html).toContain('@RateLimit');
    expect(html).toContain('req.validate');
  });

  test('3. GET /docs/models renders Active Record Models page', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/docs/models', {
        headers: { accept: 'text/html' },
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Active Record');
    expect(html).toContain('Note.all()');
  });

  test('4. GET /docs/views renders Views (HTML & React) page', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/docs/views', {
        headers: { accept: 'text/html' },
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Views (HTML &amp; React SSR)');
    expect(html).toContain('res.view');
  });

  test('5. GET /docs/cli renders CLI Commands page', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/docs/cli', {
        headers: { accept: 'text/html' },
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('CLI Scaffolding Commands');
    expect(html).toContain('forge make:page &lt;Name&gt; [--crud]');
  });
});
