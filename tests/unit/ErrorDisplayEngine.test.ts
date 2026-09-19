// tests/unit/ErrorDisplayEngine.test.ts
// ─────────────────────────────────────────────────────────────────────
// Comprehensive test suite for the hardened ErrorDisplayEngine.
// Uses generic, portable test fixtures independent of developer environment.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'bun:test';
import path from 'path';
import { ErrorDisplayEngine } from '../../packages/forge/src/http/ErrorDisplayEngine.js';
import { HttpException } from '../../packages/forge/src/index.js';

describe('ErrorDisplayEngine — Unit & Security Suite', () => {
  test('1. Stack trace parsing: accurately parses Bun and V8 stack frames with category tags', () => {
    const projectRoot = process.cwd();
    const fixtureFile = path.join(projectRoot, 'tests/fixtures/ErrorSourceFixture.ts');
    const pipelineFile = path.join(projectRoot, 'packages/forge/src/http/Pipeline.ts');
    const appFile = path.join(projectRoot, 'packages/forge/src/core/Application.ts');
    const vendorFile = path.join(projectRoot, 'node_modules/bun/dist/index.js');

    const rawStack = `TypeError: Cannot read properties of undefined
    at ExampleController.show (${fixtureFile}:10:5)
    at executePipeline (${pipelineFile}:57:10)
    at handleRequest (${appFile}:396:30)
    at ${vendorFile}:100:5
    at native (native)`;

    const frames = ErrorDisplayEngine.parseStack(rawStack);

    expect(frames.length).toBe(5);

    // Frame 0: App
    expect(frames[0].functionName).toBe('ExampleController.show');
    expect(frames[0].file).toContain('ErrorSourceFixture.ts');
    expect(frames[0].line).toBe(10);
    expect(frames[0].column).toBe(5);
    expect(frames[0].isApp).toBe(true);
    expect(frames[0].isFramework).toBe(false);
    expect(frames[0].isVendor).toBe(false);

    // Frame 1: Framework
    expect(frames[1].functionName).toBe('executePipeline');
    expect(frames[1].file).toContain('Pipeline.ts');
    expect(frames[1].isApp).toBe(false);
    expect(frames[1].isFramework).toBe(true);
    expect(frames[1].isVendor).toBe(false);

    // Frame 3: Vendor
    expect(frames[3].isVendor).toBe(true);
    expect(frames[3].isApp).toBe(false);

    // Frame 4: Native
    expect(frames[4].isVendor).toBe(true);
  });

  test('2. Source snippet extraction: loads surrounding lines and marks active error line', () => {
    const targetFile = path.join(process.cwd(), 'tests/fixtures/ErrorSourceFixture.ts');
    const errorLine = 12;

    const snippet = ErrorDisplayEngine.getCodeSnippet(targetFile, errorLine, 7, 3);
    expect(snippet).not.toBeNull();
    expect(snippet?.file).toBe(targetFile);
    expect(snippet?.line).toBe(12);
    expect(snippet?.column).toBe(7);
    expect(snippet?.lines.length).toBeGreaterThan(2);

    const errorLineObj = snippet?.lines.find((l) => l.isErrorLine);
    expect(errorLineObj).toBeDefined();
    expect(errorLineObj?.lineNum).toBe(12);
    expect(errorLineObj?.code).toContain('throw new Error');
  });

  test('3. Source snippet safety: blocks reading .env or sensitive files and unreadable files', () => {
    // 1. .env file blocked
    const envPath = path.join(process.cwd(), '.env');
    const envSnippet = ErrorDisplayEngine.getCodeSnippet(envPath, 1);
    expect(envSnippet).toBeNull();

    // 2. Non-existent file
    const missingSnippet = ErrorDisplayEngine.getCodeSnippet('/does/not/exist/file.ts', 10);
    expect(missingSnippet).toBeNull();

    // 3. Invalid line number
    const invalidLine = ErrorDisplayEngine.getCodeSnippet(import.meta.path, -5);
    expect(invalidLine).toBeNull();
  });

  test('4. HTML escaping: prevents XSS injection via malicious error message or names', () => {
    const maliciousMsg = '<script>alert("XSS")</script>&foo="bar"\'baz\'<img src=x onerror=alert(1)>';
    const err = new Error(maliciousMsg);
    err.name = '<b style="color:red">MaliciousError</b>';

    const html = ErrorDisplayEngine.renderHtml(err, 'http://example.test/?q=<script>attack</script>');

    // Must NOT contain unescaped tags
    expect(html).not.toContain('<script>alert("XSS")</script>');
    expect(html).not.toContain('<b style="color:red">');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');

    // Must contain properly escaped HTML entities
    expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;b style=&quot;color:red&quot;&gt;MaliciousError&lt;/b&gt;');
    expect(html).toContain('&amp;foo=&quot;bar&quot;&#039;baz&#039;');
  });

  test('5. Header sanitization: redacts sensitive authentication, token, and cookie headers', () => {
    const rawHeaders = {
      authorization: 'Bearer secret-jwt-token-12345',
      cookie: 'forge_session=supersecretcookievalue; user_id=10',
      'x-api-key': 'api-live-key-xyz-987654',
      'x-csrf-token': 'csrf-token-abcde',
      'content-type': 'application/json',
      accept: 'text/html',
      host: 'example.test',
    };

    const sanitized = ErrorDisplayEngine.sanitizeHeaders(rawHeaders);

    expect(sanitized['authorization']).toBe('[REDACTED]');
    expect(sanitized['cookie']).toBe('[REDACTED]');
    expect(sanitized['x-api-key']).toBe('[REDACTED]');
    expect(sanitized['x-csrf-token']).toBe('[REDACTED]');
    expect(sanitized['content-type']).toBe('application/json');
    expect(sanitized['host']).toBe('example.test');
  });

  test('6. Body sanitization: recursively redacts passwords, tokens, secrets, and cards in request body', () => {
    const body = {
      username: 'alice',
      email: 'alice@example.com',
      password: 'MySecretPassword123!',
      password_confirmation: 'MySecretPassword123!',
      token: 'jwt.token.abc',
      card_number: '4111222233334444',
      profile: {
        bio: 'Hello world',
        secret: 'nested-secret-value',
      },
      tags: ['developer', 'admin'],
    };

    const sanitized: any = ErrorDisplayEngine.sanitizeBody(body);

    expect(sanitized.username).toBe('alice');
    expect(sanitized.email).toBe('alice@example.com');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.password_confirmation).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.card_number).toBe('[REDACTED]');
    expect(sanitized.profile.secret).toBe('[REDACTED]');
    expect(sanitized.profile.bio).toBe('Hello world');
    expect(sanitized.tags).toEqual(['developer', 'admin']);
  });

  test('7. Exception cause chaining: extracts nested causes and guards against circular references', () => {
    const rootErr = new Error('Database connection failed');
    const middleErr = new Error('Socket timeout while connecting');
    (middleErr as any).cause = rootErr;

    const topErr = new Error('User controller failed to fetch user');
    (topErr as any).cause = middleErr;

    const causes = ErrorDisplayEngine.extractCauses(topErr);
    expect(causes.length).toBe(2);
    expect(causes[0].message).toBe('Socket timeout while connecting');
    expect(causes[1].message).toBe('Database connection failed');

    // Circular cause test
    const circA = new Error('Circular A');
    const circB = new Error('Circular B');
    (circA as any).cause = circB;
    (circB as any).cause = circA;

    // Must not crash or enter infinite loop
    const circularCauses = ErrorDisplayEngine.extractCauses(circA);
    expect(circularCauses.length).toBe(1);
    expect(circularCauses[0].message).toBe('Circular B');
  });

  test('8. Failure safety: renderer never throws, even with non-Error objects, malformed stacks, or circular structures', () => {
    // Non-Error primitives
    expect(() => ErrorDisplayEngine.renderHtml('plain string error')).not.toThrow();
    expect(() => ErrorDisplayEngine.renderHtml(12345)).not.toThrow();
    expect(() => ErrorDisplayEngine.renderHtml(null)).not.toThrow();
    expect(() => ErrorDisplayEngine.renderHtml(undefined)).not.toThrow();

    // Circular object
    const circularObj: any = { name: 'Circular' };
    circularObj.self = circularObj;
    expect(() => ErrorDisplayEngine.renderHtml(circularObj)).not.toThrow();

    // Malformed stack
    const badStackErr = new Error('Bad stack');
    badStackErr.stack = 'not-a-valid-stack-at-all\n\n@123:abc';
    expect(() => ErrorDisplayEngine.renderHtml(badStackErr)).not.toThrow();

    const output = ErrorDisplayEngine.renderHtml(badStackErr);
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('Bad stack');
  });

  test('9. Production mode HTML rendering: strictly zero leaks of stack, source, or file paths', () => {
    const prod500 = ErrorDisplayEngine.renderProductionHtml(500, 'Internal Server Error');
    expect(prod500).toContain('500');
    expect(prod500).toContain('Something went wrong');
    expect(prod500).not.toContain('Stack Trace');
    expect(prod500).not.toContain('snippet-box');
    expect(prod500).not.toContain(process.cwd());
    expect(prod500).not.toContain('packages/forge');

    const prod404 = ErrorDisplayEngine.renderProductionHtml(404, 'Not Found');
    expect(prod404).toContain('404');
    expect(prod404).toContain('Page Not Found');

    const prod503 = ErrorDisplayEngine.renderProductionHtml(503, 'Service Unavailable');
    expect(prod503).toContain('503');
    expect(prod503).toContain('Service Temporarily Unavailable');
  });

  test('10. Full debug HTML page renders Ignition UI elements and tabs', () => {
    const err = new Error('Uncaught exception in ExampleController');
    err.name = 'ExampleException';
    const fixturePath = path.join(process.cwd(), 'tests/fixtures/ErrorSourceFixture.ts');
    const pipelinePath = path.join(process.cwd(), 'packages/forge/src/http/Pipeline.ts');
    err.stack = `ExampleException: Uncaught exception in ExampleController
    at ExampleController.show (${fixturePath}:12:5)
    at executePipeline (${pipelinePath}:57:10)`;

    const rawReq = new globalThis.Request('http://example.test/items/42?filter=active', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer my-secret-token',
        'x-custom-header': 'safe-value',
      },
    });

    const html = ErrorDisplayEngine.renderHtml(err, rawReq);

    // Check Ignition header elements
    expect(html).toContain('<span>Forge</span>TS Debug Engine');
    expect(html).toContain('APP_DEBUG = TRUE');
    expect(html).toContain('ExampleException');
    expect(html).toContain('Uncaught exception in ExampleController');

    // Check Tabs
    expect(html).toContain('Stack Trace');
    expect(html).toContain('Request &amp; Body');
    expect(html).toContain('Headers');
    expect(html).toContain('Environment');

    // Check App vs Forge badge
    expect(html).toContain('badge-app');
    expect(html).toContain('APP');
    expect(html).toContain('badge-framework');
    expect(html).toContain('FORGE');

    // Check Request & Header sanitization in HTML
    expect(html).toContain('/items/42');
    expect(html).toContain('[REDACTED]');
    expect(html).not.toContain('my-secret-token');
    expect(html).toContain('safe-value');
  });
});
