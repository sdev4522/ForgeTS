// tests/integration/SecurityAccessControl.test.ts
// ─────────────────────────────────────────────────────────────────────
// Security Access Control & Path Traversal Regression Test Suite.
// Verifies source code file blocking & valid route responses.
// ─────────────────────────────────────────────────────────────────────

import { describe, expect, test, beforeAll } from 'bun:test';
import app from '../../bootstrap/app.js';
import { getDatabaseConnection } from '@forge/database';

describe('Security Access Control & Static Asset Scoping', () => {
  beforeAll(() => {
    process.env.DB_CONNECTION = 'mysql';
  });

  test('Forbidden path: /packages/forge/src/view/ViewEngine.ts must return 404', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/packages/forge/src/view/ViewEngine.ts')
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('No route matches GET');
  });

  test('Forbidden path: /config/database.ts must return 404', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/config/database.ts')
    );
    expect(res.status).toBe(404);
  });

  test('Forbidden path: /.env must return 404', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/.env')
    );
    expect(res.status).toBe(404);
  });

  test('Forbidden path: /package.json must return 404', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/package.json')
    );
    expect(res.status).toBe(404);
  });

  test('Valid default route: GET / must return 200 OK with React SSR HTML content', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/', {
        headers: { accept: 'text/html' },
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Forge');
    expect(html).toContain('id="root"');
  });

  test('Valid client hydration script: /resources/js/entry-client.tsx must return 200 OK JS', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/resources/js/entry-client.tsx')
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
  });
});
