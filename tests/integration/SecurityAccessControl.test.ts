// tests/integration/SecurityAccessControl.test.ts
// ─────────────────────────────────────────────────────────────────────
// Security Access Control & Path Traversal Regression Test Suite.
// Verifies source code file blocking & valid route responses.
// ─────────────────────────────────────────────────────────────────────

import { describe, expect, test, beforeAll } from 'bun:test';
import app from '../../bootstrap/app.ts';
import { getDatabaseConnection } from '@forge/database';

describe('Security Access Control & Static Asset Scoping', () => {
  beforeAll(async () => {
    process.env.DB_CONNECTION = 'mysql';
    try {
      const db = getDatabaseConnection();
      await (db as any).executeQuery({
        sql: `CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title VARCHAR(255), completed TINYINT, created_at VARCHAR(255));`,
        parameters: [],
      });
    } catch {
      // ignore table setup if connection is handled dynamically
    }
  });

  test('Forbidden path: /packages/forge/src/view/ViewEngine.ts must return 404', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/packages/forge/src/view/ViewEngine.ts')
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('No route matches GET');
  });

  test('Forbidden path: /config/database.ts must return 404', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/config/database.ts')
    );
    expect(res.status).toBe(404);
  });

  test('Forbidden path: /.env must return 404', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/.env')
    );
    expect(res.status).toBe(404);
  });

  test('Forbidden path: /package.json must return 404', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/package.json')
    );
    expect(res.status).toBe(404);
  });

  test('Valid route: /todos must return 200 OK with expected JSON array', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/todos')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('Valid SSR route: /todos/react must return 200 OK with HTML content', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/todos/react')
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<title>All Todos</title>');
  });

  test('Valid client hydration script: /resources/js/entry-client.tsx must return 200 OK JS', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/resources/js/entry-client.tsx')
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
  });
});
