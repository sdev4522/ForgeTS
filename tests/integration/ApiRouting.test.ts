// tests/integration/ApiRouting.test.ts
// ─────────────────────────────────────────────────────────────────────
// Integration tests for ForgeTS First-Class API Routing Subsystem.
// Validates routes/api.ts loading, /api prefix, CSRF separation,
// JSON responses, status code helpers, and error formatting.
// ─────────────────────────────────────────────────────────────────────

import { describe, expect, test, beforeAll, afterAll } from '../harness.js';
import app from '@/bootstrap/app.js';
import {
  Router,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@forge/core';
import type { Request, ForgeResponse, Middleware, NextFunction } from '@forge/core';

describe('ForgeTS First-Class API Routing', () => {
  const originalEnvDebug = process.env.APP_DEBUG;

  beforeAll(() => {
    // Register custom API test router demonstrating API middleware, status codes, and exceptions
    class TestApiMiddleware implements Middleware {
      async handle(req: Request, next: NextFunction): Promise<ForgeResponse> {
        const response = await next();
        return response.header('X-Api-Custom-Header', 'forge-api-v1');
      }
    }

    const testApiRouter = new Router();
    testApiRouter.use(TestApiMiddleware);

    // Health check endpoint
    testApiRouter.get('/health', (_req: Request, res: ForgeResponse) => {
      return res.json({ status: 'ok', timestamp: 1234567890 });
    });

    // Verb route using controller-style tuple syntax
    testApiRouter.post('/action', async (req: Request, res: ForgeResponse) => {
      const body = await req.body<{ name?: string }>();
      return res.created({ action: 'created', name: body?.name });
    });

    // Specific HTTP status test endpoints
    testApiRouter.get('/status/bad-request', () => {
      throw new BadRequestException('Malformed query parameter');
    });

    testApiRouter.get('/status/unauthorized', () => {
      throw new UnauthorizedException('Missing bearer token');
    });

    testApiRouter.get('/status/forbidden', () => {
      throw new ForbiddenException('Insufficient permissions');
    });

    testApiRouter.get('/status/unprocessable', () => {
      throw new UnprocessableEntityException('Validation failed', {
        email: ['The email field is required.'],
      });
    });

    testApiRouter.get('/status/server-error', () => {
      throw new Error('Database query crash with sensitive DB credentials: secret_token_12345');
    });

    app.registerRoutes(testApiRouter, { prefix: '/api', type: 'api' });
  });

  afterAll(() => {
    process.env.APP_DEBUG = originalEnvDebug;
  });

  test('1. API route is reachable and automatically prefixed with /api', async () => {
    const req = new globalThis.Request('http://example.test/api/health', {
      headers: { accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBe(1234567890);
  });

  test('2. API middleware executes and injects headers', async () => {
    const req = new globalThis.Request('http://example.test/api/health');
    const res = await (app as any).handleRequest(req);

    expect(res.headers.get('x-api-custom-header')).toBe('forge-api-v1');
  });

  test('3. API routes are exempt from web CSRF middleware', async () => {
    // POST to API route without any CSRF token
    const req = new globalThis.Request('http://example.test/api/action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ name: 'Alpha' }),
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.action).toBe('created');
    expect(data.name).toBe('Alpha');
  });

  test('4. Web routes still enforce CSRF protection', async () => {
    // POST to Web route /user without CSRF token must be rejected (419 Page Expired)
    const req = new globalThis.Request('http://example.test/user', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'name=TestUser',
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(419);
  });

  test('5. API 404 returns structured JSON instead of HTML', async () => {
    const req = new globalThis.Request('http://example.test/api/nonexistent-endpoint', {
      headers: { accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = await res.json();
    expect(data.statusCode).toBe(404);
    expect(data.error).toContain('No route matches GET /api/nonexistent-endpoint');
  });

  test('6. API HTTP status exceptions return structured JSON: 400, 401, 403, 422', async () => {
    // 400 Bad Request
    const res400 = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/api/status/bad-request')
    );
    expect(res400.status).toBe(400);
    const json400 = await res400.json();
    expect(json400.statusCode).toBe(400);
    expect(json400.error).toBe('Malformed query parameter');

    // 401 Unauthorized
    const res401 = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/api/status/unauthorized')
    );
    expect(res401.status).toBe(401);
    const json401 = await res401.json();
    expect(json401.statusCode).toBe(401);
    expect(json401.error).toBe('Missing bearer token');

    // 403 Forbidden
    const res403 = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/api/status/forbidden')
    );
    expect(res403.status).toBe(403);
    const json403 = await res403.json();
    expect(json403.statusCode).toBe(403);
    expect(json403.error).toBe('Insufficient permissions');

    // 422 Unprocessable Entity
    const res422 = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/api/status/unprocessable')
    );
    expect(res422.status).toBe(422);
    const json422 = await res422.json();
    expect(json422.statusCode).toBe(422);
    expect(json422.message).toBe('Validation failed');
    expect(json422.errors.email).toContain('The email field is required.');
  });

  test('7. API 500 error hides sensitive stack traces when APP_DEBUG=false', async () => {
    process.env.APP_DEBUG = 'false';

    const req = new globalThis.Request('http://example.test/api/status/server-error', {
      headers: { accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = await res.json();
    expect(data.message).toBe('Internal Server Error');
    expect(data.stack).toBeUndefined();
    expect(data.diagnostics).toBeUndefined();
  });

  test('8. API 500 error includes sanitized diagnostic details when APP_DEBUG=true', async () => {
    process.env.APP_DEBUG = 'true';

    const req = new globalThis.Request('http://example.test/api/status/server-error', {
      headers: { accept: 'application/json' },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = await res.json();
    expect(data.name).toBe('Error');
    expect(data.message).toContain('Database query crash');
    expect(Array.isArray(data.stack)).toBe(true);
  });
});
