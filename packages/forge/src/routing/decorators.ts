// packages/forge/src/routing/decorators.ts
// ─────────────────────────────────────────────────────────────────────
// TC39 Stage 3 decorators for routing.
// NO experimentalDecorators. NO reflect-metadata.
// Uses context.metadata (the standard metadata API) to store route info.
//
// PERFORMANCE: Decorators run once at class definition time (module load).
// Zero runtime overhead per request.
// ─────────────────────────────────────────────────────────────────────

import type { MiddlewareLike } from '../http/Middleware.js';

// ─── Symbols ───
// Using symbols ensures our metadata never collides with user metadata.

export const CONTROLLER_META = Symbol.for('forge:controller');
export const ROUTES_META = Symbol.for('forge:routes');
export const MIDDLEWARE_META = Symbol.for('forge:middleware');
export const METHOD_MIDDLEWARE_META = Symbol.for('forge:method_middleware');

// ─── Types ───

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlerName: string | symbol;
}

export interface ControllerMeta {
  prefix: string;
}

// ─── Helper to ensure metadata arrays exist ───

// A subclass's metadata object inherits from its parent's through the prototype
// chain. Always write to an OWN copy so a child controller never mutates the
// route / middleware lists of the class it extends.
function getOrCreateArray<T>(metadata: DecoratorMetadataObject, key: symbol): T[] {
  if (!Object.hasOwn(metadata, key)) {
    const inherited = metadata[key] as T[] | undefined;
    metadata[key] = inherited ? [...inherited] : ([] as T[]);
  }
  return metadata[key] as T[];
}

// ─── @Controller('/prefix') ───

/**
 * Mark a class as an HTTP controller with a URL prefix.
 *
 * @example
 * ```ts
 * @Controller('/users')
 * export class UserController { ... }
 * ```
 */
export function Controller(prefix: string = '') {
  return function (_target: new (...args: any[]) => any, context: ClassDecoratorContext) {
    // Normalize prefix: ensure leading slash, no trailing slash
    const normalizedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
    const cleanPrefix = normalizedPrefix.endsWith('/') && normalizedPrefix.length > 1
      ? normalizedPrefix.slice(0, -1)
      : normalizedPrefix;

    context.metadata[CONTROLLER_META] = { prefix: cleanPrefix } satisfies ControllerMeta;

    // Initialize routes array if method decorators haven't already
    getOrCreateArray<RouteDefinition>(context.metadata, ROUTES_META);
  };
}

// ─── HTTP Method Decorators ───

function createMethodDecorator(method: HttpMethod) {
  return function (path: string = '') {
    return function (_target: Function, context: ClassMethodDecoratorContext) {
      // Normalize path
      const normalizedPath = path && !path.startsWith('/') ? `/${path}` : path;

      const routes = getOrCreateArray<RouteDefinition>(context.metadata, ROUTES_META);
      if (routes.some((r) => r.handlerName === context.name && r.method === method && r.path === normalizedPath)) {
        return;
      }
      routes.push({
        method,
        path: normalizedPath,
        handlerName: context.name,
      });
    };
  };
}

/**
 * Map a controller method to a GET request.
 *
 * @example
 * ```ts
 * @Get('/') async index(req, res) { ... }
 * @Get('/:id') async show(req, res) { ... }
 * ```
 */
export const Get = createMethodDecorator('GET');

/** Map a controller method to a POST request. */
export const Post = createMethodDecorator('POST');

/** Map a controller method to a PUT request. */
export const Put = createMethodDecorator('PUT');

/** Map a controller method to a PATCH request. */
export const Patch = createMethodDecorator('PATCH');

/** Map a controller method to a DELETE request. */
export const Delete = createMethodDecorator('DELETE');

/** Map a controller method to a HEAD request. */
export const Head = createMethodDecorator('HEAD');

/** Map a controller method to an OPTIONS request. */
export const Options = createMethodDecorator('OPTIONS');

// ─── @Middleware(...) ───

/**
 * Attach middleware to a controller class or a specific method.
 *
 * @example
 * ```ts
 * // Class-level middleware — applies to ALL methods
 * @Controller('/admin')
 * @Middleware(AuthMiddleware, AdminMiddleware)
 * export class AdminController { ... }
 *
 * // Method-level middleware — applies to THIS method only
 * @Post('/')
 * @Middleware(RateLimitMiddleware)
 * async store(req, res) { ... }
 * ```
 */
export function Middleware(...middleware: MiddlewareLike[]) {
  // Return a decorator that works on both classes and methods
  return function (_target: any, context: ClassDecoratorContext | ClassMethodDecoratorContext) {
    if (context.kind === 'class') {
      // Class-level middleware
      const existing = getOrCreateArray<MiddlewareLike>(context.metadata, MIDDLEWARE_META);
      existing.push(...middleware);
    } else if (context.kind === 'method') {
      // Method-level middleware — keyed by method name
      if (!Object.hasOwn(context.metadata, METHOD_MIDDLEWARE_META)) {
        const inherited = context.metadata[METHOD_MIDDLEWARE_META] as
          | Record<string | symbol, MiddlewareLike[]>
          | undefined;
        const own: Record<string | symbol, MiddlewareLike[]> = {};
        if (inherited) {
          for (const k of Reflect.ownKeys(inherited)) own[k] = [...inherited[k]];
        }
        context.metadata[METHOD_MIDDLEWARE_META] = own;
      }
      const map = context.metadata[METHOD_MIDDLEWARE_META] as Record<string | symbol, MiddlewareLike[]>;
      const key = context.name;
      if (!Object.hasOwn(map, key)) {
        map[key] = [];
      }
      map[key].push(...middleware);
    }
  };
}
