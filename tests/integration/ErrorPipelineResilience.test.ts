import { describe, test, expect, beforeAll, afterAll } from '../harness.js';
import app from '../../bootstrap/app.js';
import { Router, ValidationError } from '@forge/core';
import { getDatabaseConnection } from '../../packages/forge/src/database/Connection.js';

describe('Error Pipeline Resilience & Status Contract', () => {
  const originalEnvDebug = process.env.APP_DEBUG;

  beforeAll(() => {
    const testRouter = new Router();

    // 1. Route throwing intentional application error
    testRouter.get('/test/intentional-error', () => {
      throw new Error('Intentional test error');
    });

    // 2. Route setting status 0 explicitly
    testRouter.get('/test/status-zero', (_req, res) => {
      return res.status(0 as any).json({ ok: false });
    });

    // 3. Route calling redirect with an options object as status
    testRouter.post('/test/redirect-with-object', (_req, res) => {
      return res.redirect('/about', { user: { name: 'Test' } } as any);
    });

    // 4. Route throwing a ValidationError
    testRouter.post('/test/validation-error', () => {
      throw new ValidationError({ email: ['The email field is required.'] });
    });

    // 5. Route triggering a controlled database query error
    testRouter.get('/test/database-error', async () => {
      const db = getDatabaseConnection();
      await (db as any).executeQuery({ sql: 'SELECT * FROM nonexistent_table_for_test_xyz;', parameters: [], query: {} });
      return { success: true };
    });

    app.registerRoutes(testRouter);
  });

  afterAll(() => {
    process.env.APP_DEBUG = originalEnvDebug;
  });

  test('1. Successful CRUD create returns 2xx with valid timestamps', async () => {
    // Web routes require a CSRF token: load a page first to obtain the cookie
    const page = await (app as any).handleRequest(
      new globalThis.Request('http://localhost:3000/about', { headers: { Accept: 'text/html' } }),
    );
    const csrfToken = /forge_session=([a-f0-9]+)/.exec(page.headers.get('set-cookie') ?? '')?.[1] ?? '';
    expect(csrfToken).toMatch(/^[a-f0-9]{64}$/);

    const req = new globalThis.Request('http://localhost:3000/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': `forge_session=${csrfToken}`,
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        name: 'Resilience Tester',
        email: `resilience_${Date.now()}@example.com`,
        password: 'secure_password',
      }),
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(201);
    expect(res.status).not.toBe(0);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Resilience Tester');
    expect(body.created_at).toBeDefined();
    // MySQL timestamp should not contain 'T' or 'Z'
    expect(body.created_at).not.toContain('T');
    expect(body.created_at).not.toContain('Z');
  });

  test('2. Intentional controller error returns HTTP 500 (NOT RangeError status 0)', async () => {
    process.env.APP_DEBUG = 'true';
    const req = new globalThis.Request('http://localhost:3000/test/intentional-error', {
      headers: { Accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.status).not.toBe(0);

    const body = await res.json();
    expect(body.message).toContain('Intentional test error');
    expect(body.stack).toBeDefined();
    expect(body.name).not.toBe('RangeError');
  });

  test('3. Nonexistent route returns HTTP 404 (NOT status 0)', async () => {
    const req = new globalThis.Request('http://localhost:3000/nonexistent-route-999999', {
      headers: { Accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(0);
  });

  test('4. Validation error returns HTTP 422 (NOT status 0)', async () => {
    const req = new globalThis.Request('http://localhost:3000/test/validation-error', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(422);
    expect(res.status).not.toBe(0);

    const body = await res.json();
    expect(body.errors).toBeDefined();
    expect(body.statusCode).toBe(422);
  });

  test('5. Controller setting status 0 is normalized to 200 (never throws RangeError)', async () => {
    const req = new globalThis.Request('http://localhost:3000/test/status-zero', {
      headers: { Accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(0);
  });

  test('6. Controller redirect with object argument defaults to 302 (never status 0)', async () => {
    const req = new globalThis.Request('http://localhost:3000/test/redirect-with-object', {
      method: 'POST',
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(302);
    expect(res.status).not.toBe(0);
    expect(res.headers.get('location')).toBe('/about');
  });

  test('7. Database query error with APP_DEBUG=true preserves original database error at HTTP 500', async () => {
    process.env.APP_DEBUG = 'true';
    const req = new globalThis.Request('http://localhost:3000/test/database-error', {
      headers: { Accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.status).not.toBe(0);

    const body = await res.json();
    expect(body.message).toMatch(/nonexistent_table_for_test_xyz|Table.*doesn't exist/i);
    expect(body.stack).toBeDefined();
  });

  test('8. Database query error with APP_DEBUG=false returns safe HTTP 500 without leaking SQL', async () => {
    process.env.APP_DEBUG = 'false';
    const req = new globalThis.Request('http://localhost:3000/test/database-error', {
      headers: { Accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.status).not.toBe(0);

    const body = await res.json();
    expect(body.message).toBe('Internal Server Error');
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('nonexistent_table_for_test_xyz');
  });

  test('9. Emergency fallback in handleError returns safe 500 if error handling encounters a failure', async () => {
    // Calling handleError directly with an object designed to stress error handling
    const corruptedError = {
      get message(): string {
        throw new Error('Fatal error inside error message getter');
      },
      get stack(): string {
        throw new Error('Fatal error inside error stack getter');
      },
    };

    const res = (app as any).handleError(corruptedError);
    expect(res.status).toBe(500);
    expect(res.status).not.toBe(0);

    const body = await res.json();
    expect(body.message).toBe('Internal Server Error');
    expect(body.statusCode).toBe(500);
  });
});
