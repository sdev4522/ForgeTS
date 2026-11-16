import { describe, test, expect, beforeAll, afterAll } from '../harness.js';
import app from '../../bootstrap/app.js';
import { Router } from '@forge/core';

describe('HTML Error Handler & Request Type Detection', () => {
  const originalEnvDebug = process.env.APP_DEBUG;

  beforeAll(() => {
    // Add a test web route and test API route that throw an intentional error
    const testRouter = new Router();
    testRouter.get('/test/error', () => {
      throw new Error('Test intentional crash for error handler');
    });
    testRouter.get('/api/test/error', () => {
      throw new Error('Test intentional API crash');
    });
    app.registerRoutes(testRouter);
  });

  afterAll(() => {
    process.env.APP_DEBUG = originalEnvDebug;
  });

  test('Browser HTML request with APP_DEBUG=true returns rich debug HTML error page', async () => {
    process.env.APP_DEBUG = 'true';
    const req = new globalThis.Request('http://example.test/test/error', {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('APP_DEBUG = TRUE');
    expect(html).toContain('Test intentional crash for error handler');
    expect(html).toContain('Stack Trace');
    expect(html).toContain('snippet-box');
  });

  test('Browser HTML request with APP_DEBUG=false returns styled production HTML error page', async () => {
    process.env.APP_DEBUG = 'false';
    const req = new globalThis.Request('http://example.test/test/error', {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('500');
    expect(html).toContain('Something went wrong');
    expect(html).not.toContain('Stack Trace');
    expect(html).not.toContain('snippet-box');
    expect(html).not.toContain('APP_DEBUG = TRUE');
  });

  test('API JSON request keeps existing JSON error response format unchanged (APP_DEBUG=true)', async () => {
    process.env.APP_DEBUG = 'true';
    const req = new globalThis.Request('http://example.test/api/test/error', {
      headers: {
        accept: 'application/json',
      },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');

    const json = await res.json();
    expect(json.message).toBe('Test intentional API crash');
    expect(json.name).toBe('Error');
    expect(Array.isArray(json.stack)).toBe(true);
  });

  test('API JSON request keeps existing JSON error response format unchanged (APP_DEBUG=false)', async () => {
    process.env.APP_DEBUG = 'false';
    const req = new globalThis.Request('http://example.test/api/test/error', {
      headers: {
        accept: 'application/json',
      },
    });

    const res = await (app as any).handleRequest(req);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');

    const json = await res.json();
    expect(json).toEqual({ message: 'Internal Server Error' });
  });
});
