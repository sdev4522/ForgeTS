// packages/forge/src/http/Middleware.ts
// ─────────────────────────────────────────────────────────────────────
// Middleware interface and pipeline types.
//
// Middleware uses the "onion model" — each middleware wraps the next.
// The `next()` function calls the next middleware in the chain.
// If a middleware doesn't call `next()`, the chain stops (useful for auth).
// ─────────────────────────────────────────────────────────────────────

import type { Request } from './Request.js';
import type { ForgeResponse } from './Response.js';

/**
 * The function passed to middleware to continue the chain.
 * Call `next()` to pass control to the next middleware/handler.
 * Returns the Response from downstream.
 */
export type NextFunction = () => Promise<ForgeResponse>;

/**
 * Middleware interface.
 * Every middleware class must implement this.
 *
 * @example
 * ```ts
 * export class AuthMiddleware implements Middleware {
 *   async handle(req: Request, next: NextFunction): Promise<ForgeResponse> {
 *     const token = req.bearerToken();
 *     if (!token) return new ForgeResponse().unauthorized();
 *     return next();
 *   }
 * }
 * ```
 */
export interface Middleware {
  handle(req: Request, next: NextFunction): Promise<ForgeResponse>;
}

/**
 * Constructor type for middleware classes.
 * Used in `@Middleware(AuthMiddleware)` decorator.
 */
export type MiddlewareClass = new (...args: any[]) => Middleware;

/**
 * Function middleware — the shortest form.
 *
 * @example
 * ```ts
 * const auth: MiddlewareHandler = async (req, next) => {
 *   if (!req.bearerToken()) return json({ error: 'Unauthorized' }, 401);
 *   return next();
 * };
 * router.get('/me', showMe, [auth]);
 * ```
 */
export type MiddlewareHandler = (
  req: Request,
  next: NextFunction,
) => Promise<ForgeResponse> | ForgeResponse;

/** Anything accepted where middleware is expected: a class or a plain function. */
export type MiddlewareLike = MiddlewareClass | MiddlewareHandler;
