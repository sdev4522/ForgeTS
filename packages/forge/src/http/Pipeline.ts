// packages/forge/src/http/Pipeline.ts
// ─────────────────────────────────────────────────────────────────────
// Middleware pipeline executor (onion model).
//
// PERFORMANCE: The pipeline is built as a linked chain of closures.
// No array iteration per request — each middleware holds a direct
// reference to the next function. Zero allocations beyond the
// initial closure chain construction.
// ─────────────────────────────────────────────────────────────────────

import type { Request } from './Request.js';
import type { ForgeResponse } from './Response.js';
import type { Middleware, MiddlewareClass, NextFunction } from './Middleware.js';
import type { Container } from '../container/Container.js';

/**
 * The final handler type — the actual controller method call.
 */
export type FinalHandler = (req: Request) => Promise<ForgeResponse>;

/**
 * Build and execute a middleware pipeline.
 *
 * @param middlewareClasses - Ordered array of middleware classes to execute.
 * @param container - DI container to resolve middleware instances.
 * @param req - The incoming request.
 * @param finalHandler - The controller method handler.
 * @returns The final response.
 *
 * PERFORMANCE NOTE: We build the chain from right-to-left (innermost first).
 * Each middleware receives a `next` closure that calls the next middleware.
 * This means the chain is a stack of closures — no iteration, no array access.
 */
export async function executePipeline(
  middlewareClasses: MiddlewareClass[],
  container: Container,
  req: Request,
  finalHandler: FinalHandler,
): Promise<ForgeResponse> {
  // Start with the final handler as the innermost "next"
  let next: NextFunction = () => finalHandler(req);

  // Build the chain from inside out (reverse order)
  for (let i = middlewareClasses.length - 1; i >= 0; i--) {
    const MiddlewareCls = middlewareClasses[i];
    const currentNext = next; // Capture current next in closure

    // Resolve middleware from container (supports DI in middleware)
    const middleware: Middleware = container.has(MiddlewareCls)
      ? container.resolve(MiddlewareCls)
      : new MiddlewareCls();

    next = () => middleware.handle(req, currentNext);
  }

  // Execute the chain
  return next();
}
