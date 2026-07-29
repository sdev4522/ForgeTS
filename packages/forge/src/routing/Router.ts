// packages/forge/src/routing/Router.ts
// ─────────────────────────────────────────────────────────────────────
// Route registration and grouping.
// Routes are defined in route files (routes/api.ts, routes/web.ts)
// and reference controller classes decorated with @Controller/@Get/etc.
//
// The Router reads TC39 decorator metadata from controller classes
// and builds a flat route table. No auto-discovery, no magic scanning.
// ─────────────────────────────────────────────────────────────────────

import {
  CONTROLLER_META,
  ROUTES_META,
  MIDDLEWARE_META,
  METHOD_MIDDLEWARE_META,
  type ControllerMeta,
  type RouteDefinition,
  type HttpMethod,
} from './decorators.js';
import type { MiddlewareClass } from '../http/Middleware.js';

// ─── Types ───

export interface RegisteredRoute {
  method: HttpMethod;
  fullPath: string;
  controllerClass: new (...args: any[]) => any;
  handlerName: string | symbol;
  middleware: MiddlewareClass[];
}

export interface RouteGroupOptions {
  prefix?: string;
  middleware?: MiddlewareClass[];
}

// ─── Router ───

export class Router {
  private routes: RegisteredRoute[] = [];
  private currentPrefix: string = '';
  private currentMiddleware: MiddlewareClass[] = [];

  /**
   * Apply middleware to all subsequent controllers registered on this router.
   */
  middleware(...middlewareList: MiddlewareClass[]): this {
    this.currentMiddleware.push(...middlewareList);
    return this;
  }

  /**
   * Alias for middleware().
   */
  use(...middlewareList: MiddlewareClass[]): this {
    return this.middleware(...middlewareList);
  }

  /**
   * Register a decorated controller class.
   * Reads @Controller, @Get/@Post/etc., and @Middleware metadata.
   *
   * @example
   * ```ts
   * const router = new Router();
   * router.controller(UserController);
   * router.controller(PostController);
   * ```
   */
  controller(controllerClass: new (...args: any[]) => any): this {
    const metadata = controllerClass[Symbol.metadata];

    if (!metadata) {
      throw new Error(
        `[ForgeTS] ${controllerClass.name} has no decorator metadata. ` +
          `Did you forget to add @Controller() to the class?`,
      );
    }

    const controllerMeta = metadata[CONTROLLER_META] as ControllerMeta | undefined;
    if (!controllerMeta) {
      throw new Error(
        `[ForgeTS] ${controllerClass.name} is missing @Controller() decorator.`,
      );
    }

    const routeDefs = (metadata[ROUTES_META] as RouteDefinition[]) ?? [];
    const classMiddleware = (metadata[MIDDLEWARE_META] as MiddlewareClass[]) ?? [];
    const methodMiddleware = (metadata[METHOD_MIDDLEWARE_META] as Record<string | symbol, MiddlewareClass[]>) ?? {};

    for (const route of routeDefs) {
      // Build full path: groupPrefix + controllerPrefix + methodPath
      const fullPath = this.normalizePath(
        this.currentPrefix + controllerMeta.prefix + route.path,
      );

      // Merge middleware: group → class → method
      const middleware = [
        ...this.currentMiddleware,
        ...classMiddleware,
        ...(methodMiddleware[route.handlerName] ?? []),
      ];

      this.routes.push({
        method: route.method,
        fullPath,
        controllerClass,
        handlerName: route.handlerName,
        middleware,
      });
    }

    return this;
  }

  /**
   * Group routes under a common prefix and/or middleware.
   *
   * @example
   * ```ts
   * router.group({ prefix: '/api/v1', middleware: [AuthMiddleware] }, () => {
   *   router.controller(UserController);
   *   router.controller(PostController);
   * });
   * ```
   */
  group(options: RouteGroupOptions, callback: () => void): this {
    // Save current state
    const previousPrefix = this.currentPrefix;
    const previousMiddleware = [...this.currentMiddleware];

    // Apply group settings
    if (options.prefix) {
      const normalizedPrefix = options.prefix.startsWith('/')
        ? options.prefix
        : `/${options.prefix}`;
      this.currentPrefix = previousPrefix + normalizedPrefix;
    }
    if (options.middleware) {
      this.currentMiddleware.push(...options.middleware);
    }

    // Execute the group callback — controllers registered inside
    // will inherit the group prefix and middleware
    callback();

    // Restore previous state
    this.currentPrefix = previousPrefix;
    this.currentMiddleware = previousMiddleware;

    return this;
  }

  /**
   * Register a standalone route without a controller class.
   * Useful for simple health checks or one-off routes.
   *
   * @example
   * ```ts
   * router.get('/ping', (req, res) => res.text('pong'));
   * ```
   */
  get(
    path: string,
    handler: (req: any, res: any) => any,
    middleware: MiddlewareClass[] = [],
  ): this {
    return this.addStandaloneRoute('GET', path, handler, middleware);
  }

  post(
    path: string,
    handler: (req: any, res: any) => any,
    middleware: MiddlewareClass[] = [],
  ): this {
    return this.addStandaloneRoute('POST', path, handler, middleware);
  }

  put(
    path: string,
    handler: (req: any, res: any) => any,
    middleware: MiddlewareClass[] = [],
  ): this {
    return this.addStandaloneRoute('PUT', path, handler, middleware);
  }

  patch(
    path: string,
    handler: (req: any, res: any) => any,
    middleware: MiddlewareClass[] = [],
  ): this {
    return this.addStandaloneRoute('PATCH', path, handler, middleware);
  }

  delete(
    path: string,
    handler: (req: any, res: any) => any,
    middleware: MiddlewareClass[] = [],
  ): this {
    return this.addStandaloneRoute('DELETE', path, handler, middleware);
  }

  private addStandaloneRoute(
    method: HttpMethod,
    path: string,
    handler: Function,
    middleware: MiddlewareClass[],
  ): this {
    const fullPath = this.normalizePath(this.currentPrefix + (path.startsWith('/') ? path : `/${path}`));

    // Create an anonymous controller-like wrapper
    const StandaloneController = class {
      handle = handler;
    };

    this.routes.push({
      method,
      fullPath,
      controllerClass: StandaloneController as any,
      handlerName: 'handle',
      middleware: [...this.currentMiddleware, ...middleware],
    });

    return this;
  }

  /**
   * Get all registered routes. Used by the Application to build the route table.
   * @internal
   */
  getRoutes(): readonly RegisteredRoute[] {
    return this.routes;
  }

  /**
   * Normalize a path: ensure leading slash, remove trailing slash,
   * collapse double slashes.
   */
  private normalizePath(path: string): string {
    let normalized = path.replace(/\/+/g, '/'); // collapse //
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
}
