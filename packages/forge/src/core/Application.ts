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

import { join } from 'node:path';
import { Container } from '../container/Container.js';
import { Router, type RegisteredRoute } from '../routing/Router.js';
import { RouteResolver, type ResolvedRoute } from '../routing/RouteResolver.js';
import { Request, ValidationException } from '../http/Request.js';
import { ForgeResponse } from '../http/Response.js';
import { executePipeline } from '../http/Pipeline.js';
import { initConfig, getConfigManager, type ConfigManager } from '../config/ConfigManager.js';
import { ViewEngine } from '../view/ViewEngine.js';
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
  private providers: Provider[] = [];
  private globalMiddleware: MiddlewareClass[] = [];
  private booted = false;

  constructor(private rootDir: string = process.cwd()) {
    this.container = new Container();
    this.resolver = new RouteResolver();
    this.viewEngine = new ViewEngine(rootDir);

    // Initialize config system
    this.configManager = initConfig(rootDir);

    // Bind the container and app itself into the container
    this.container.instance('app', this);
    this.container.instance(Container, this.container);
    this.container.instance(ViewEngine, this.viewEngine);
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
        // Try serving static asset from public/ folder for GET/HEAD requests
        if (method === 'GET' || method === 'HEAD') {
          const publicFilePath = join(this.rootDir, 'public', path);
          const file = Bun.file(publicFilePath);
          if (await file.exists()) {
            return new globalThis.Response(file);
          }
        }

        // No matching route or static file — 404
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

        const response = new ForgeResponse(this.viewEngine);
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
      return this.handleError(error);
    }
  }

  /**
   * Global error handler.
   * Converts known exceptions into proper HTTP responses.
   */
  private handleError(error: unknown): globalThis.Response {
    // Validation errors → 422
    if (error instanceof ValidationException) {
      return new ForgeResponse()
        .status(422)
        .json({
          error: 'Validation Failed',
          statusCode: 422,
          errors: error.errors,
        })
        .toNativeResponse();
    }

    // HttpException (custom exceptions with status codes)
    if (error instanceof HttpException) {
      return new ForgeResponse()
        .status(error.statusCode)
        .json({
          error: error.message,
          statusCode: error.statusCode,
        })
        .toNativeResponse();
    }

    // Unknown errors → 500
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    console.error('[ForgeTS] Unhandled error:', error);

    return new ForgeResponse()
      .serverError(message)
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
