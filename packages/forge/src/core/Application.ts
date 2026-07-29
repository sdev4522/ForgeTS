// packages/forge/src/core/Application.ts
// ─────────────────────────────────────────────────────────────────────
// The main Application class. This is the entry point for ForgeTS.
//
// Responsibilities:
// 1. Create the DI container
// 2. Load configuration
// 3. Register routes from Router instances
// 4. Build the radix-trie route table
// 5. Start the HTTP server (Bun-native)
// 6. Handle each request: resolve route → build pipeline → execute
//
// PERFORMANCE: Bun's native HTTP server is used directly — no Express,
// no Koa, no abstraction layers. Request handling is a single function
// that resolves the route from the trie and executes the pipeline.
// ─────────────────────────────────────────────────────────────────────

import { join, resolve } from 'node:path';
import { Container } from '../container/Container.js';
import { Router, type RegisteredRoute } from '../routing/Router.js';
import { RouteResolver, type ResolvedRoute } from '../routing/RouteResolver.js';
import { Request, ValidationException } from '../http/Request.js';
import { ValidationError } from '../http/Validator.js';
import { ForgeResponse } from '../http/Response.js';
import { ErrorDisplayEngine } from '../http/ErrorDisplayEngine.js';
import { executePipeline } from '../http/Pipeline.js';
import { initConfig, getConfigManager, type ConfigManager } from '../config/ConfigManager.js';
import { ViewEngine } from '../view/ViewEngine.js';
import { ReactEngine } from '../ssr/ReactEngine.js';
import { getTimezone } from './time.js';
import type { HttpMethod } from '../routing/decorators.js';
import type { MiddlewareClass } from '../http/Middleware.js';

// ─── Provider Interface ───

export abstract class Provider {
  abstract register(container: Container): void;
  boot?(container: Container): void;
}

// ─── Application ───

export class Application {
  readonly container: Container;
  private resolver: RouteResolver;
  private configManager: ConfigManager;
  private viewEngine: ViewEngine;
  private reactEngine: ReactEngine;
  private providers: Provider[] = [];
  private globalMiddleware: MiddlewareClass[] = [];
  private booted = false;

  constructor(private rootDir: string = process.cwd()) {
    this.container = new Container();
    this.resolver = new RouteResolver();
    this.viewEngine = new ViewEngine(rootDir);
    this.reactEngine = new ReactEngine(rootDir);

    // Initialize config system
    this.configManager = initConfig(rootDir);

    // Bind the container and app itself into the container
    this.container.instance('app', this);
    this.container.instance(Container, this.container);
    this.container.instance(ViewEngine, this.viewEngine);
    this.container.instance(ReactEngine, this.reactEngine);
  }

  /**
   * Load environment variables from .env file.
   * Call this before loading config files.
   */
  loadEnv(envFile: string = '.env'): this {
    this.configManager.loadEnv(envFile);
    return this;
  }

  /**
   * Register a config namespace.
   *
   * @example
   * ```ts
   * import appConfig from '../config/app';
   * app.configure('app', appConfig);
   * ```
   */
  configure(namespace: string, values: Record<string, unknown>): this {
    this.configManager.set(namespace, values);
    return this;
  }

  /**
   * Register a service provider.
   */
  registerProvider(provider: Provider): this {
    this.providers.push(provider);
    provider.register(this.container);
    return this;
  }

  /**
   * Register global middleware that runs on EVERY request.
   *
   * @example
   * ```ts
   * app.use(CorsMiddleware, BodyParserMiddleware);
   * ```
   */
  use(...middleware: MiddlewareClass[]): this {
    this.globalMiddleware.push(...middleware);
    return this;
  }

  /**
   * Register routes from a Router instance.
   * Reads the route definitions and adds them to the radix trie.
   */
  registerRoutes(router: Router): this {
    for (const route of router.getRoutes()) {
      this.resolver.add(route);
    }
    return this;
  }

  /**
   * Boot the application: call boot() on all providers.
   */
  private boot(): void {
    if (this.booted) return;

    // Synchronize process-wide timezone with app configuration
    process.env.TZ = getTimezone();

    for (const provider of this.providers) {
      provider.boot?.(this.container);
    }

    this.booted = true;
  }

  /**
   * Start the HTTP server.
   *
   * PERFORMANCE: Uses Bun.serve() directly — the fastest HTTP server
   * available in the JS ecosystem. No Express, no middleware framework.
   * Each request is handled by a single function: resolve → pipeline → respond.
   */
  async start(port?: number): Promise<void> {
    this.boot();

    const listenPort = port ?? this.configManager.get<number>('app.port', 3000);

    const server = Bun.serve({
      port: listenPort,
      fetch: (rawRequest: globalThis.Request) => this.handleRequest(rawRequest),
      error: (err: Error) => this.handleError(err),
    });

    const routeCount = this.resolver.count;
    console.log('');
    console.log(`  ⚡ ForgeTS v0.1.0`);
    console.log(`  ├─ Server:  http://localhost:${server.port}`);
    console.log(`  ├─ Routes:  ${routeCount} registered`);
    console.log(`  ├─ Runtime: Bun ${Bun.version}`);
    console.log(`  └─ Ready in ${Math.round(performance.now())}ms`);
    console.log('');
  }

  /**
   * Safely check if a requested static path is permitted to be served over HTTP.
   */
  private isAllowedStaticPath(path: string, isProduction: boolean): boolean {
    const normalized = path.replace(/\\/g, '/');

    // Explicitly block sensitive framework source files, configs, process secrets, & internal dirs
    if (
      normalized.includes('.env') ||
      normalized.includes('.git') ||
      normalized.includes('package.json') ||
      normalized.includes('tsconfig.json') ||
      normalized.includes('bun.lock') ||
      normalized.includes('yarn.lock') ||
      normalized.startsWith('/packages/') ||
      normalized.startsWith('/config/') ||
      normalized.startsWith('/app/') ||
      normalized.startsWith('/database/') ||
      normalized.startsWith('/bootstrap/') ||
      normalized.startsWith('/bin/')
    ) {
      return false;
    }

    if (isProduction) {
      return (
        normalized.startsWith('/assets/') ||
        normalized.startsWith('/dist/client/') ||
        normalized.endsWith('.js') ||
        normalized.endsWith('.css') ||
        normalized.endsWith('.png') ||
        normalized.endsWith('.ico') ||
        normalized.endsWith('.jpg') ||
        normalized.endsWith('.svg')
      );
    }

    return (
      normalized.startsWith('/public/') ||
      normalized.startsWith('/resources/js/') ||
      normalized.startsWith('/resources/css/') ||
      normalized.startsWith('/@vite/') ||
      normalized.startsWith('/@react-refresh')
    );
  }

  /**
   * Handle a single HTTP request.
   *
   * This is the hot path — every allocation here matters.
   */
  private async handleRequest(rawRequest: globalThis.Request): Promise<globalThis.Response> {
    try {
      const url = new URL(rawRequest.url);
      const method = rawRequest.method as HttpMethod;
      const path = url.pathname;

      // 1. Resolve route from radix trie
      const resolved = this.resolver.resolve(method, path);

      if (!resolved) {
        // Try serving static asset ONLY if path is explicitly whitelisted and within allowed boundaries
        if (method === 'GET' || method === 'HEAD') {
          const relativePath = path.startsWith('/') ? path.slice(1) : path;

          if (process.env.NODE_ENV === 'production') {
            if (this.isAllowedStaticPath(path, true)) {
              const distFilePath = join(this.rootDir, 'dist', 'client', relativePath);
              const resolvedDist = resolve(distFilePath);
              const allowedDistRoot = resolve(join(this.rootDir, 'dist', 'client'));

              if (resolvedDist.startsWith(allowedDistRoot)) {
                const distFile = Bun.file(resolvedDist);
                if (await distFile.exists()) {
                  return new globalThis.Response(distFile);
                }
              }

              const publicFilePath = join(this.rootDir, 'public', relativePath);
              const resolvedPublic = resolve(publicFilePath);
              const allowedPublicRoot = resolve(join(this.rootDir, 'public'));

              if (resolvedPublic.startsWith(allowedPublicRoot)) {
                const publicFile = Bun.file(resolvedPublic);
                if (await publicFile.exists()) {
                  return new globalThis.Response(publicFile);
                }
              }
            }
          } else {
            // Dev mode: serve ONLY whitelisted /resources/js/, /resources/css/, or /public/
            if (this.isAllowedStaticPath(path, false)) {
              const devFilePath = join(this.rootDir, relativePath);
              const resolvedDev = resolve(devFilePath);
              const allowedResourcesRoot = resolve(join(this.rootDir, 'resources'));
              const allowedPublicRoot = resolve(join(this.rootDir, 'public'));

              if (resolvedDev.startsWith(allowedResourcesRoot) || resolvedDev.startsWith(allowedPublicRoot)) {
                const devFile = Bun.file(resolvedDev);
                if (await devFile.exists()) {
                  if (path.endsWith('.tsx') || path.endsWith('.ts') || path.endsWith('.jsx')) {
                    try {
                      const buildResult = await Bun.build({
                        entrypoints: [resolvedDev],
                        target: 'browser',
                        format: 'esm',
                      });
                      if (buildResult.success && buildResult.outputs.length > 0) {
                        const jsText = await buildResult.outputs[0].text();
                        return new globalThis.Response(jsText, {
                          headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
                        });
                      }
                    } catch {
                      // fallback below if build has resolution error
                    }

                    const content = await devFile.text();
                    const transpiler = new Bun.Transpiler({ loader: 'tsx', target: 'browser' });
                    const js = transpiler.transformSync(content);
                    return new globalThis.Response(js, {
                      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
                    });
                  }
                  return new globalThis.Response(devFile);
                }
              }
            }

            // Fallback for root public files (e.g. GET /favicon.png)
            const publicFilePath = join(this.rootDir, 'public', relativePath);
            const resolvedPublic = resolve(publicFilePath);
            const allowedPublicRoot = resolve(join(this.rootDir, 'public'));

            if (resolvedPublic.startsWith(allowedPublicRoot)) {
              const publicFile = Bun.file(resolvedPublic);
              if (await publicFile.exists()) {
                return new globalThis.Response(publicFile);
              }
            }
          }
        }

        // 404 for all forbidden, un-whitelisted, or missing routes/files
        return new ForgeResponse()
          .notFound(`No route matches ${method} ${path}`)
          .toNativeResponse();
      }

      // 2. Create the framework Request
      const req = new Request(rawRequest, resolved.params);

      // 3. Parse body for write methods (lazy — only if needed)
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const contentType = rawRequest.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          try {
            const body = await rawRequest.json();
            req._setBody(body);
          } catch {
            return new ForgeResponse()
              .badRequest('Invalid JSON body')
              .toNativeResponse();
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          try {
            const text = await rawRequest.text();
            const params = new URLSearchParams(text);
            const bodyObj: Record<string, any> = {};
            params.forEach((v, k) => (bodyObj[k] = v));
            req._setBody(bodyObj);
          } catch {
            return new ForgeResponse()
              .badRequest('Invalid form body')
              .toNativeResponse();
          }
        }
      }

      // 4. Resolve the controller from the container
      const { route } = resolved;
      const controller = this.container.has(route.controllerClass)
        ? this.container.resolve(route.controllerClass)
        : new route.controllerClass();

      // 5. Build the middleware pipeline and execute
      const allMiddleware = [...this.globalMiddleware, ...route.middleware];

      const finalHandler = async (_req: Request): Promise<ForgeResponse> => {
        const handler = (controller as any)[route.handlerName];
        if (typeof handler !== 'function') {
          throw new Error(
            `[ForgeTS] Handler '${String(route.handlerName)}' not found on ${route.controllerClass.name}`,
          );
        }

        const response = new ForgeResponse(this.viewEngine, this.reactEngine);
        if ((_req as any)._csrfToken) {
          (response as any)._csrfToken = (_req as any)._csrfToken;
        }
        const result = await handler.call(controller, _req, response);

        // If the handler returned a ForgeResponse, use it.
        // If it returned a plain value, wrap it as JSON.
        if (result instanceof ForgeResponse) {
          return result;
        }
        if (result !== undefined) {
          return new ForgeResponse().json(result);
        }
        return response;
      };

      const response = await executePipeline(
        allMiddleware,
        this.container,
        req,
        finalHandler,
      );

      return response.toNativeResponse();
    } catch (error) {
      return this.handleError(error, rawRequest);
    }
  }

  /**
   * Global error handler engine.
   * Converts known exceptions into structured HTTP responses or HTML debug pages.
   */
  public handleError(error: unknown, rawRequest?: globalThis.Request): globalThis.Response {
    // 1. Validation errors → 422
    if (error instanceof ValidationError || error instanceof ValidationException) {
      return new ForgeResponse()
        .status(422)
        .json({
          message: 'The given data was invalid.',
          statusCode: 422,
          errors: (error as any).errors,
        })
        .toNativeResponse();
    }

    // 2. Custom HttpException → status code
    if (error instanceof HttpException) {
      if (error.statusCode >= 500) {
        console.error('[ForgeTS] Unhandled error:', error);
      }
      return new ForgeResponse()
        .status(error.statusCode)
        .json({
          error: error.message,
          statusCode: error.statusCode,
        })
        .toNativeResponse();
    }

    // 3. System / Unknown Exception → 500
    console.error('[ForgeTS] Unhandled error:', error);
    const isDebug = process.env.APP_DEBUG === 'true';
    const acceptHeader = rawRequest?.headers.get('accept') ?? '';
    const wantsJson = acceptHeader.includes('application/json') && !acceptHeader.includes('text/html');

    if (isDebug) {
      if (wantsJson && error instanceof Error) {
        const redactedMessage = ErrorDisplayEngine.redactSecrets(error.message);
        const rawStack = ErrorDisplayEngine.redactSecrets(error.stack ?? '');
        const stackLines = rawStack
          ? rawStack.split('\n').map((line) => line.trim())
          : [];

        return new ForgeResponse()
          .status(500)
          .json({
            message: redactedMessage,
            name: error.name || 'Error',
            stack: stackLines,
          })
          .toNativeResponse();
      }

      // Render rich HTML debug error page for browser requests
      const debugHtml = ErrorDisplayEngine.renderHtml(error, rawRequest?.url);
      return new ForgeResponse()
        .status(500)
        .html(debugHtml)
        .toNativeResponse();
    }

    // Non-debug / Production mode: generic response only
    if (wantsJson) {
      return new ForgeResponse()
        .status(500)
        .json({ message: 'Internal Server Error' })
        .toNativeResponse();
    }

    return new ForgeResponse()
      .status(500)
      .html(`<!DOCTYPE html><html><head><title>500 Internal Server Error</title></head><body style="background:#090d16;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h1>500 Internal Server Error</h1></body></html>`)
      .toNativeResponse();
  }

  /**
   * Get all registered routes (for CLI routes:list command).
   */
  getRoutes(): RegisteredRoute[] {
    return this.resolver.getAllRoutes();
  }
}

// ─── Base Exception Class ───

export class HttpException extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpException';
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string = 'Not Found') {
    super(404, message);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden') {
    super(403, message);
  }
}

export class BadRequestException extends HttpException {
  constructor(message: string = 'Bad Request') {
    super(400, message);
  }
}
