// packages/forge/src/http/RateLimiter.ts
// ─────────────────────────────────────────────────────────────────────
// In-memory sliding-window Rate Limiter (Laravel Throttle / RateLimiter equivalent).
// Provides RateLimiter.attempt(), RateLimitMiddleware, and @RateLimit() decorator.
// ─────────────────────────────────────────────────────────────────────

import type { Middleware as IMiddleware, NextFunction } from './Middleware.js';
import type { Request } from './Request.js';
import { ForgeResponse } from './Response.js';
import { Middleware } from '../routing/decorators.js';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

export class RateLimiter {
  private static hits: Map<string, { count: number; resetAt: number }> = new Map();

  /**
   * Attempt an action against a rate limit window.
   */
  static attempt(key: string, maxAttempts: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    let entry = this.hits.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      this.hits.set(key, entry);
      return {
        allowed: true,
        limit: maxAttempts,
        remaining: maxAttempts - 1,
        resetInSeconds: windowSeconds,
      };
    }

    entry.count += 1;
    const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);
    const allowed = entry.count <= maxAttempts;
    const remaining = Math.max(0, maxAttempts - entry.count);

    return {
      allowed,
      limit: maxAttempts,
      remaining,
      resetInSeconds,
    };
  }

  /**
   * Clear rate limit state for a key (or clear all if no key passed).
   */
  static clear(key?: string): void {
    if (key) {
      this.hits.delete(key);
    } else {
      this.hits.clear();
    }
  }
}

/**
 * Factory function to create a Rate Limit Middleware class.
 */
export function createRateLimitMiddleware(
  maxAttempts = 60,
  windowSeconds = 60,
): new () => IMiddleware {
  return class RateLimitMiddleware implements IMiddleware {
    async handle(req: Request, next: NextFunction): Promise<ForgeResponse> {
      const clientIp = req.header('x-forwarded-for') || req.header('cf-connecting-ip') || '127.0.0.1';
      const key = `${clientIp}:${req.path}`;

      const res = RateLimiter.attempt(key, maxAttempts, windowSeconds);

      if (!res.allowed) {
        return new ForgeResponse()
          .status(429)
          .header('Retry-After', String(res.resetInSeconds))
          .header('X-RateLimit-Limit', String(res.limit))
          .header('X-RateLimit-Remaining', '0')
          .json({
            error: 'Too Many Requests',
            message: `Too many requests. Please try again in ${res.resetInSeconds} seconds.`,
            statusCode: 429,
          });
      }

      const response = await next();
      response.header('X-RateLimit-Limit', String(res.limit));
      response.header('X-RateLimit-Remaining', String(res.remaining));

      return response;
    }
  };
}

/**
 * TC39 Decorator to apply rate limiting to a controller method or class.
 *
 * @example
 * ```ts
 * @RateLimit(3, 60) // Max 3 requests per 60 seconds
 * @Post('/')
 * async store(req, res) { ... }
 * ```
 */
export function RateLimit(maxAttempts = 60, windowSeconds = 60) {
  const middlewareClass = createRateLimitMiddleware(maxAttempts, windowSeconds);
  return Middleware(middlewareClass);
}
