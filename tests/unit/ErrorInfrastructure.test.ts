// tests/unit/ErrorInfrastructure.test.ts
// ─────────────────────────────────────────────────────────────────────
// Comprehensive Test Suite for ForgeTS Error Infrastructure & Diagnostics
// Validates all 22 required error failure scenarios, contracts, and security.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import path from 'node:path';
import {
  ForgeError,
  HttpError,
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  MethodNotAllowedException,
  MethodNotAllowedError,
  UnprocessableEntityException,
  ServiceUnavailableException,
  InternalServerErrorException,
  ValidationError,
  ValidationException,
  RoutingError,
  RouteNotFoundException,
  ContainerError,
  BindingResolutionException,
  CircularDependencyException,
  DatabaseError,
  DatabaseConnectionException,
  QueryException,
  ModelNotFoundException,
  ViewError,
  ViewNotFoundException,
  ViewRenderException,
  ConfigurationError,
  ConfigurationException,
  AuthenticationError,
  AuthorizationError,
  Redactor,
  SourceFrameReader,
  ErrorNormalizer,
  ContextCollector,
  ContentNegotiator,
  HtmlErrorRenderer,
  JsonErrorRenderer,
  FallbackRenderer,
} from '../../packages/forge/src/errors/index.js';
import { Container } from '../../packages/forge/src/container/Container.js';
import { ViewEngine } from '../../packages/forge/src/view/ViewEngine.js';

describe('ForgeTS Error Infrastructure & Failure Experience', () => {
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/ErrorSourceFixture.ts');
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.TEST_DB_PASSWORD = 'super_secret_db_password_123';
    process.env.TEST_API_SECRET = 'api_secret_jwt_token_999';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ─── 1. Basic Error ───
  test('1. basic Error is normalized with correct status, code, and message', () => {
    const raw = new Error('Standard basic error occurred');
    const normalized = ErrorNormalizer.normalize(raw);

    expect(normalized.type).toBe('Error');
    expect(normalized.message).toBe('Standard basic error occurred');
    expect(normalized.statusCode).toBe(500);
    expect(normalized.code).toBe('ERR_INTERNAL_SERVER_ERROR');
    expect(normalized.stackFrames.length).toBeGreaterThan(0);
    expect(Array.isArray(normalized.causes)).toBe(true);
  });

  // ─── 2. TypeError ───
  test('2. TypeError retains native exception class and normalizes to 500', () => {
    const raw = new TypeError("Cannot read properties of undefined (reading 'name')");
    const normalized = ErrorNormalizer.normalize(raw);

    expect(normalized.type).toBe('TypeError');
    expect(normalized.message).toContain("Cannot read properties of undefined");
    expect(normalized.statusCode).toBe(500);
    expect(normalized.code).toBe('ERR_TYPE_ERROR');
  });

  // ─── 3. Custom ForgeError ───
  test('3. Custom ForgeError subclass preserves status, code, and details', () => {
    class TeapotError extends ForgeError {
      constructor() {
        super("I'm a teapot", {
          statusCode: 418,
          code: 'ERR_TEAPOT',
          details: { temperature: '95C', tea: 'Earl Grey' },
        });
      }
    }

    const raw = new TeapotError();
    const normalized = ErrorNormalizer.normalize(raw);

    expect(normalized.type).toBe('TeapotError');
    expect(normalized.statusCode).toBe(418);
    expect(normalized.code).toBe('ERR_TEAPOT');
    expect(normalized.message).toBe("I'm a teapot");
    expect(normalized.details).toEqual({ temperature: '95C', tea: 'Earl Grey' });
  });

  // ─── 4. Nested Cause Chain ───
  test('4. Nested cause chain is extracted and rendered across multiple levels', () => {
    const rootErr = new DatabaseConnectionException('Socket closed unexpectedly');
    const middleErr = new QueryException('SELECT * FROM users WHERE id = 1 failed', { cause: rootErr });
    const topErr = new InternalServerErrorException('Failed to process user registration', { cause: middleErr });

    const normalized = ErrorNormalizer.normalize(topErr);
    expect(normalized.causes.length).toBe(2);
    expect(normalized.causes[0].type).toBe('QueryException');
    expect(normalized.causes[0].message).toContain('Database Query Error');
    expect(normalized.causes[1].type).toBe('DatabaseConnectionException');
    expect(normalized.causes[1].message).toBe('Socket closed unexpectedly');

    // Verify HTML debug renderer includes causes section
    const context = ContextCollector.collect();
    const html = HtmlErrorRenderer.renderDebug(normalized, context);
    expect(html).toContain('Causes (2)');
    expect(html).toContain('QueryException');
    expect(html).toContain('DatabaseConnectionException');

    // Verify JSON debug renderer includes causes array
    const json = JsonErrorRenderer.renderDebug(normalized, context);
    expect(json.causes.length).toBe(2);
    expect(json.causes[0].type).toBe('QueryException');
  });

  // ─── 5. Missing Stack ───
  test('5. Error with missing or empty stack is handled gracefully without crashing', () => {
    const err = new Error('Error without a stack');
    err.stack = undefined;

    const normalized = ErrorNormalizer.normalize(err);
    expect(normalized.stackFrames).toEqual([]);
    expect(normalized.primaryFrame).toBeUndefined();

    const context = ContextCollector.collect();
    const html = HtmlErrorRenderer.renderDebug(normalized, context);
    expect(html).toContain('Error without a stack');
    expect(html).toContain('No stack frames available');

    const json = JsonErrorRenderer.renderDebug(normalized, context);
    expect(json.stack).toEqual([]);
    expect(json.trace.stack).toEqual([]);
  });

  // ─── 6. Malformed Stack ───
  test('6. Malformed and corrupted stack traces do not cause parser crashes', () => {
    const err = new Error('Malformed stack test');
    err.stack = 'Corrupted\n!@#$%^&*( bogus frame :not-a-number:xyz\n    at invalid-line';

    const frames = SourceFrameReader.parseStack(err.stack);
    expect(Array.isArray(frames)).toBe(true);

    const normalized = ErrorNormalizer.normalize(err);
    expect(normalized.message).toBe('Malformed stack test');

    const context = ContextCollector.collect();
    const html = HtmlErrorRenderer.renderDebug(normalized, context);
    expect(html).toContain('Malformed stack test');
  });

  // ─── 7. Source File Available ───
  test('7. Available source file extracts snippet with line numbers, error highlight, and caret', () => {
    const snippet = SourceFrameReader.getCodeSnippet(fixturePath, 12, 11, 3);

    expect(snippet).not.toBeNull();
    expect(snippet!.file).toBe(fixturePath);
    expect(snippet!.line).toBe(12);
    expect(snippet!.column).toBe(11);

    const errorLine = snippet!.lines.find((l) => l.isErrorLine);
    expect(errorLine).toBeDefined();
    expect(errorLine!.lineNum).toBe(12);
    expect(errorLine!.code).toContain('throw new Error');

    // Surrounding context lines
    expect(snippet!.lines.some((l) => l.lineNum === 10)).toBe(true);
    expect(snippet!.lines.some((l) => l.lineNum === 14)).toBe(true);
  });

  // ─── 8. Source File Missing ───
  test('8. Missing or inaccessible source file returns null without throwing', () => {
    const snippet = SourceFrameReader.getCodeSnippet('/non/existent/file/DeadPath.ts', 42, 5);
    expect(snippet).toBeNull();

    // Verify parser handles non-existent file in stack frame
    const rawStack = 'Error: Fail\n    at testMethod (/non/existent/file/DeadPath.ts:42:5)';
    const frames = SourceFrameReader.parseStack(rawStack);
    expect(frames.length).toBe(1);
    expect(frames[0].line).toBe(42);
    expect(frames[0].column).toBe(5);
  });

  // ─── 9. HTML Development Response ───
  test('9. HTML development error page renders complete Ignition debugging interface', () => {
    const err = new NotFoundException('The requested resource was not found');
    const rawReq = new globalThis.Request('http://localhost:3000/users/999?expand=orders', {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'ForgeTestBrowser/1.0',
      },
    });

    const normalized = ErrorNormalizer.normalize(err);
    const context = ContextCollector.collect(rawReq, undefined, {
      pattern: '/users/:id',
      controller: 'UserController',
      action: 'show',
      params: { id: '999' },
      middleware: ['AuthMiddleware'],
    });

    const html = HtmlErrorRenderer.renderDebug(normalized, context);

    // Ignition branding and status
    expect(html).toContain('<span>Forge</span>TS Debug Engine');
    expect(html).toContain('APP_DEBUG = TRUE');
    expect(html).toContain('404');
    expect(html).toContain('Not Found');
    expect(html).toContain('ERR_NOT_FOUND');
    expect(html).toContain(context.errorId);

    // Route inspection tab
    expect(html).toContain('Route Information');
    expect(html).toContain('/users/:id');
    expect(html).toContain('UserController');
    expect(html).toContain('show');
    expect(html).toContain('AuthMiddleware');

    // Request inspection tab
    expect(html).toContain('Request &amp; Body');
    expect(html).toContain('/users/999');
    expect(html).toContain('expand=orders');

    // Headers inspection tab
    expect(html).toContain('Headers');
    expect(html).toContain('ForgeTestBrowser/1.0');

    // Environment tab
    expect(html).toContain('Environment');
    expect(html).toContain('Bun');
  });

  // ─── 10. JSON Development Response ───
  test('10. JSON development error response delivers deterministic structured payload', () => {
    const err = new BadRequestException('Validation filter failed', {
      details: {
        field: 'age',
        reason: 'must be >= 18',
      },
    });

    const rawReq = new globalThis.Request('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const normalized = ErrorNormalizer.normalize(err);
    const context = ContextCollector.collect(rawReq, undefined, {
      pattern: '/api/register',
      controller: 'AuthController',
      action: 'register',
      params: {},
      middleware: [],
    });

    const json = JsonErrorRenderer.renderDebug(normalized, context);

    expect(json.statusCode).toBe(400);
    expect(json.error).toBe('Validation filter failed');
    expect(json.message).toBe('Validation filter failed');
    expect(json.name).toBe('BadRequestException');

    // Structured error detail
    expect(json.errorDetail.type).toBe('BadRequestException');
    expect(json.errorDetail.code).toBe('ERR_BAD_REQUEST');
    expect(json.errorDetail.status).toBe(400);
    expect(json.errorDetail.details).toEqual({ field: 'age', reason: 'must be >= 18' });

    // Request & Route context
    expect(json.request.id).toBe(context.errorId);
    expect(json.request.method).toBe('POST');
    expect(json.request.path).toBe('/api/register');
    expect(json.route.pattern).toBe('/api/register');
    expect(json.route.controller).toBe('AuthController');

    // Trace & causes
    expect(json.trace.id).toBe(context.errorId);
    expect(Array.isArray(json.trace.stack)).toBe(true);
    expect(Array.isArray(json.causes)).toBe(true);
  });

  // ─── 11. HTML Production Response ───
  test('11. HTML production error response has strictly zero leaks of stack, paths, or secrets', () => {
    const prodHtml = HtmlErrorRenderer.renderProduction(500, 'Internal Server Error', 'err_prod_test_001');

    expect(prodHtml).toContain('<!DOCTYPE html>');
    expect(prodHtml).toContain('500');
    expect(prodHtml).toContain('Something went wrong');
    expect(prodHtml).toContain('err_prod_test_001');

    // Zero-leak guarantees
    expect(prodHtml).not.toContain('Stack Trace');
    expect(prodHtml).not.toContain('snippet-box');
    expect(prodHtml).not.toContain('APP_DEBUG');
    expect(prodHtml).not.toContain(process.cwd());
    expect(prodHtml).not.toContain('packages/forge');
    expect(prodHtml).not.toContain('super_secret_db_password_123');
    expect(prodHtml).not.toContain('api_secret_jwt_token_999');
  });

  // ─── 12. JSON Production Response ───
  test('12. JSON production error response is safe, leak-free, and adheres to contract', () => {
    // 500 error in production
    const err500 = ErrorNormalizer.normalize(new Error('Internal failure with secret: super_secret_db_password_123'));
    const context = ContextCollector.collect();
    const json500 = JsonErrorRenderer.renderProduction(err500, context);

    expect(json500).toEqual({ message: 'Internal Server Error' });
    expect(JSON.stringify(json500)).not.toContain('super_secret_db_password_123');

    // 404 client error in production
    const err404 = ErrorNormalizer.normalize(new NotFoundException('Item not found'));
    const json404 = JsonErrorRenderer.renderProduction(err404, context);

    expect(json404.statusCode).toBe(404);
    expect(json404.error).toBe('Item not found');
    expect(json404.message).toBe('Item not found');
  });

  // ─── 13. Secret Redaction ───
  test('13. Secret redaction neutralizes environment secrets, URIs, query params, and tokens without mutation', () => {
    const rawError = new Error(
      `DB connect failed to mysql://root:secret_mysql_pass@127.0.0.1:3306/prod?token=jwt_sensitive_999&auth=private_key_abc ` +
      `with env secret: super_secret_db_password_123`
    );

    const originalMessage = rawError.message;
    const redacted = Redactor.redactString(rawError.message);

    // Verify zero mutation of original error object
    expect(rawError.message).toBe(originalMessage);

    // Verify credentials in URI are masked
    expect(redacted).toContain('mysql://');
    expect(redacted).toContain(':[REDACTED]@127.0.0.1:3306/prod');
    expect(redacted).not.toContain('secret_mysql_pass');

    // Verify sensitive query params are masked
    expect(redacted).toContain('?token=[REDACTED]');
    expect(redacted).toContain('&auth=[REDACTED]');
    expect(redacted).not.toContain('jwt_sensitive_999');
    expect(redacted).not.toContain('private_key_abc');

    // Verify process.env secret is redacted
    expect(redacted).not.toContain('super_secret_db_password_123');
    expect(redacted).toContain('[REDACTED]');
  });

  // ─── 14. Database Failure ───
  test('14. Database failures map to proper HTTP status (503 on outage, 404 on ModelNotFound)', () => {
    // Database connection outage
    const connErr = new DatabaseConnectionException('Could not connect to MySQL server at 127.0.0.1:3306');
    const normConn = ErrorNormalizer.normalize(connErr);
    expect(normConn.statusCode).toBe(503);
    expect(normConn.code).toBe('ERR_DATABASE_CONNECTION');
    expect(normConn.type).toBe('DatabaseConnectionException');

    // Model not found (QueryBuilder firstOrFail)
    const modelErr = new ModelNotFoundException('No query results for model [User] 999');
    const normModel = ErrorNormalizer.normalize(modelErr);
    expect(normModel.statusCode).toBe(404);
    expect(normModel.code).toBe('ERR_MODEL_NOT_FOUND');
    expect(normModel.type).toBe('ModelNotFoundException');
  });

  // ─── 15. Validation Failure ───
  test('15. Validation failure produces HTTP 422 with field-level errors', () => {
    const valErr = new ValidationError({
      email: ['The email must be a valid email address.'],
      password: ['The password must be at least 8 characters.'],
    });

    const normalized = ErrorNormalizer.normalize(valErr);
    expect(normalized.statusCode).toBe(422);
    expect(normalized.code).toBe('ERR_VALIDATION_FAILED');
    expect(normalized.type).toBe('ValidationError');
    expect(normalized.details).toEqual({
      email: ['The email must be a valid email address.'],
      password: ['The password must be at least 8 characters.'],
    });

    const context = ContextCollector.collect();
    const json = JsonErrorRenderer.renderDebug(normalized, context);
    expect(json.statusCode).toBe(422);
    expect(json.errors).toBeDefined();
    expect((json.errors as any).email).toContain('The email must be a valid email address.');
  });

  // ─── 16. Routing Failure ───
  test('16. Routing failures produce 404 on RouteNotFound and 405 on MethodNotAllowed', () => {
    const notFound = new RouteNotFoundException('No route matches GET /admin/secret');
    const norm404 = ErrorNormalizer.normalize(notFound);
    expect(norm404.statusCode).toBe(404);
    expect(norm404.code).toBe('ERR_ROUTE_NOT_FOUND');
    expect(norm404.type).toBe('RouteNotFoundException');

    const notAllowed = new MethodNotAllowedException('Method POST not allowed for /articles');
    const norm405 = ErrorNormalizer.normalize(notAllowed);
    expect(norm405.statusCode).toBe(405);
    expect(norm405.code).toBe('ERR_METHOD_NOT_ALLOWED');
    expect(norm405.type).toBe('MethodNotAllowedException');
  });

  // ─── 17. DI Container Failure ───
  test('17. DI container failure throws BindingResolutionException and normalizes to 500', () => {
    const container = new Container();
    expect(() => container.resolve('NonExistentServiceToken')).toThrow(BindingResolutionException);

    try {
      container.resolve('NonExistentServiceToken');
    } catch (err) {
      const normalized = ErrorNormalizer.normalize(err);
      expect(normalized.type).toBe('BindingResolutionException');
      expect(normalized.statusCode).toBe(500);
      expect(normalized.code).toBe('ERR_CONTAINER_RESOLUTION');
      expect(normalized.message).toContain('No binding found for: NonExistentServiceToken');
    }
  });

  // ─── 18. ViewEngine Failure ───
  test('18. ViewEngine throws ViewNotFoundException on missing template', async () => {
    const viewEngine = new ViewEngine(process.cwd());

    let thrown: any;
    try {
      await viewEngine.render('nonexistent_template_file_xyz', {});
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeDefined();
    expect(thrown instanceof ViewNotFoundException).toBe(true);

    const normalized = ErrorNormalizer.normalize(thrown);
    expect(normalized.statusCode).toBe(500);
    expect(normalized.code).toBe('ERR_VIEW_NOT_FOUND');
    expect(normalized.message).toContain("View template not found: 'nonexistent_template_file_xyz'");
  });

  // ─── 19. Renderer Failure Fallback ───
  test('19. Fallback renderer safely recovers if error object has throwing malicious getters', () => {
    const maliciousErr = {
      get message(): string {
        throw new Error('Explosive message getter');
      },
      get stack(): string {
        throw new Error('Explosive stack getter');
      },
      get name(): string {
        throw new Error('Explosive name getter');
      },
      get cause(): unknown {
        throw new Error('Explosive cause getter');
      },
    };

    // Normalizer must not crash on throwing getters
    expect(() => ErrorNormalizer.normalize(maliciousErr)).not.toThrow();

    // Fallback HTML and JSON must always produce valid 500 response
    const fallbackHtml = FallbackRenderer.renderHtml(maliciousErr, 'err_fallback_01');
    expect(fallbackHtml).toContain('<!DOCTYPE html>');
    expect(fallbackHtml).toContain('500');
    expect(fallbackHtml).toContain('err_fallback_01');

    const fallbackJson = JSON.parse(FallbackRenderer.renderJson(maliciousErr, 'err_fallback_02'));
    expect(fallbackJson.error.status).toBe(500);
    expect(fallbackJson.request.id).toBe('err_fallback_02');
  });

  // ─── 20. Large Stack ───
  test('20. Large stack traces with 150+ frames parse efficiently without crashing', () => {
    const stackLines = ['Error: Heavy stack trace'];
    for (let i = 0; i < 180; i++) {
      stackLines.push(`    at func${i} (/app/controllers/HeavyController.ts:${10 + i}:${(i % 20) + 1})`);
    }

    const heavyErr = new Error('Heavy stack error');
    heavyErr.stack = stackLines.join('\n');

    const frames = SourceFrameReader.parseStack(heavyErr.stack);
    expect(frames.length).toBe(180);
    expect(frames[0].functionName).toBe('func0');
    expect(frames[179].functionName).toBe('func179');

    const normalized = ErrorNormalizer.normalize(heavyErr);
    expect(normalized.stackFrames.length).toBe(180);

    const context = ContextCollector.collect();
    const html = HtmlErrorRenderer.renderDebug(normalized, context);
    expect(html).toContain('Stack Trace (180 app / 180 total)');
  });

  // ─── 21. Circular Context ───
  test('21. Circular references in error cause and context data do not produce stack overflows', () => {
    const circularObj: any = { name: 'CircularContext' };
    circularObj.self = circularObj;
    circularObj.nested = { back: circularObj };

    // Sanitization with circular references
    const sanitized = Redactor.sanitizeData(circularObj);
    expect(sanitized).toBeDefined();

    // Circular cause chain
    const circ1 = new Error('Circular 1');
    const circ2 = new Error('Circular 2');
    (circ1 as any).cause = circ2;
    (circ2 as any).cause = circ1;

    const causes = ErrorNormalizer.extractCauses(circ1);
    expect(causes.length).toBe(1);
    expect(causes[0].message).toBe('Circular 2');
  });

  // ─── 22. Sensitive Request Headers ───
  test('22. Sensitive request headers are redacted while safe headers are preserved intact', () => {
    const rawHeaders: Record<string, string> = {
      'authorization': 'Bearer super_secret_access_token_xyz',
      'cookie': 'session_id=s%3Asecret12345; remember_token=tok999',
      'x-api-key': 'secret_vendor_api_key_888',
      'x-csrf-token': 'csrf_token_secret_value',
      'content-type': 'application/json',
      'accept': 'application/json, text/plain',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'x-custom-safe-header': 'visible_public_value',
    };

    const sanitized = Redactor.sanitizeHeaders(rawHeaders);

    // Sensitive headers must be masked
    expect(sanitized['authorization']).toBe('[REDACTED]');
    expect(sanitized['cookie']).toBe('[REDACTED]');
    expect(sanitized['x-api-key']).toBe('[REDACTED]');
    expect(sanitized['x-csrf-token']).toBe('[REDACTED]');

    // Safe headers must be preserved
    expect(sanitized['content-type']).toBe('application/json');
    expect(sanitized['accept']).toBe('application/json, text/plain');
    expect(sanitized['user-agent']).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(sanitized['x-custom-safe-header']).toBe('visible_public_value');
  });

  // ─── Content Negotiation ───
  test('ContentNegotiator correctly determines HTML browser vs JSON API responses', () => {
    // API route path is always JSON
    const apiReq = new globalThis.Request('http://localhost:3000/api/users', {
      headers: { accept: 'text/html,application/xhtml+xml' },
    });
    expect(ContentNegotiator.prefersHtml(apiReq, '/api/users')).toBe(false);
    expect(ContentNegotiator.wantsJson(apiReq, '/api/users')).toBe(true);

    // Browser navigation with Accept: text/html is HTML
    const browserReq = new globalThis.Request('http://localhost:3000/dashboard', {
      headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9' },
    });
    expect(ContentNegotiator.prefersHtml(browserReq, '/dashboard')).toBe(true);
    expect(ContentNegotiator.wantsJson(browserReq, '/dashboard')).toBe(false);

    // Fetch / curl with Accept: application/json is JSON
    const curlReq = new globalThis.Request('http://localhost:3000/items/1', {
      headers: { accept: 'application/json' },
    });
    expect(ContentNegotiator.prefersHtml(curlReq, '/items/1')).toBe(false);
    expect(ContentNegotiator.wantsJson(curlReq, '/items/1')).toBe(true);
  });
});
