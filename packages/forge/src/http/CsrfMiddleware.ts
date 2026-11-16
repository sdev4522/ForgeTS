// packages/forge/src/http/CsrfMiddleware.ts
// ─────────────────────────────────────────────────────────────────────
// CSRF Protection Middleware (double-submit cookie).
// Validates CSRF tokens on state-modifying HTTP requests (POST, PUT, PATCH, DELETE).
// Rejects mismatched requests with HTTP 419 (Page Expired).
//
// Every state-modifying request on a web route must present the token that
// matches its cookie — a request that arrives WITHOUT the cookie is rejected,
// never waved through. Only routes registered as type 'api' (stateless,
// token-authenticated) are exempt.
// ─────────────────────────────────────────────────────────────────────

import type { Middleware, NextFunction } from './Middleware.js';
import type { Request } from './Request.js';
import { ForgeResponse } from './Response.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export class CsrfMiddleware implements Middleware {
  static COOKIE_NAME = 'forge_session';

  /**
   * Handle CSRF token validation and session cookie management.
   */
  async handle(req: Request, next: NextFunction): Promise<ForgeResponse> {
    // 1. Get existing token from cookie, or generate a fresh one.
    //    Cookie values that are not tokens we could have issued are discarded.
    const cookieToken = req.cookie(CsrfMiddleware.COOKIE_NAME);
    const hasValidCookie = typeof cookieToken === 'string' && TOKEN_PATTERN.test(cookieToken);
    const sessionToken = hasValidCookie ? cookieToken : randomBytes(32).toString('hex');

    // Attach token to request object for automatic view injection
    (req as any)._csrfToken = sessionToken;

    // 2. State-modifying HTTP methods require CSRF validation on session-based routes
    const method = req.method.toUpperCase();
    const isStateModifying = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isApiRoute = req.routeType === 'api';

    if (isStateModifying && !isApiRoute) {
      let requestToken: unknown = undefined;

      const body = req.body<Record<string, any>>();
      if (body && typeof body === 'object' && Object.hasOwn(body, '_token')) {
        requestToken = body['_token'];
      }

      // Tokens are never read from the query string: URLs end up in logs and Referer headers
      if (typeof requestToken !== 'string' || requestToken === '') {
        requestToken = req.header('x-csrf-token') || req.header('x-xsrf-token');
      }

      if (!hasValidCookie || !this.tokensMatch(requestToken, sessionToken)) {
        return this.reject(req, sessionToken);
      }
    }

    const response = await next();

    // 3. Set or refresh session cookie
    this.setCookie(req, response, sessionToken);

    return response;
  }

  private tokensMatch(candidate: unknown, expected: string): boolean {
    if (typeof candidate !== 'string' || candidate.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
  }

  private setCookie(req: Request, response: ForgeResponse, token: string): void {
    response.cookie(CsrfMiddleware.COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: req.isSecure(),
    });
  }

  /** 419 Page Expired (Laravel CSRF mismatch convention). */
  private reject(req: Request, token: string): ForgeResponse {
    let response: ForgeResponse;

    if (req.expectsJson()) {
      response = new ForgeResponse()
        .status(419)
        .json({ error: 'CSRF token mismatch', statusCode: 419 });
    } else {
      response = new ForgeResponse().status(419).html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>419 Page Expired — ForgeTS</title>
  <style>
    body { background: #090d16; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.08); padding: 2.5rem; border-radius: 1rem; text-align: center; max-width: 480px; backdrop-filter: blur(12px); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    h1 { font-size: 2.5rem; color: #ef4444; margin: 0 0 0.5rem 0; font-weight: 800; }
    p { color: #94a3b8; font-size: 1rem; line-height: 1.5; margin: 0 0 1.5rem 0; }
    a { color: #818cf8; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>419 | Page Expired</h1>
    <p>The page has expired due to inactivity or a CSRF token mismatch. Please go back, refresh the page and try again.</p>
    <a href="/">Return Home</a>
  </div>
</body>
</html>`);
    }

    // Issue the cookie so the next page load carries a usable token
    this.setCookie(req, response, token);
    return response;
  }
}
