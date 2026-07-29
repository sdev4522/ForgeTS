// packages/forge/src/http/CsrfMiddleware.ts
// ─────────────────────────────────────────────────────────────────────
// CSRF Protection Middleware.
// Validates CSRF tokens on state-modifying HTTP requests (POST, PUT, PATCH, DELETE).
// Rejects mismatched requests with HTTP 419 (Page Expired).
// Automatically generates and injects tokens into sessions and cookies.
// ─────────────────────────────────────────────────────────────────────

import type { Middleware, NextFunction } from './Middleware.js';
import type { Request } from './Request.js';
import { ForgeResponse } from './Response.js';
import { randomBytes } from 'node:crypto';

export class CsrfMiddleware implements Middleware {
  static COOKIE_NAME = 'forge_session';

  /**
   * Handle CSRF token validation and session cookie management.
   */
  async handle(req: Request, next: NextFunction): Promise<ForgeResponse> {
    // 1. Get existing session token from cookie, or generate a fresh token
    const cookies = this.parseCookies(req.header('cookie') ?? '');
    let sessionToken = cookies[CsrfMiddleware.COOKIE_NAME];

    if (!sessionToken) {
      sessionToken = randomBytes(32).toString('hex');
    }

    // Attach token to request object for automatic view injection
    (req as any)._csrfToken = sessionToken;

    // 2. State-modifying HTTP methods require CSRF validation for session-based routes
    const method = req.method.toUpperCase();
    const isStateModifying = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isJsonApiRequest = req.wantsJson() && !cookies[CsrfMiddleware.COOKIE_NAME];
    const isApiRoute = req.path.startsWith('/api/');

    if (isStateModifying && !isJsonApiRequest && !isApiRoute) {
      let requestToken: string | undefined = undefined;

      const body = req.body<Record<string, any>>();
      if (body && typeof body === 'object') {
        requestToken = body['_token'];
      }

      if (!requestToken) {
        requestToken =
          (req.query['_token'] as string | undefined) ||
          req.header('x-csrf-token') ||
          req.header('x-xsrf-token');
      }

      if (!requestToken || requestToken !== sessionToken) {
        // Return 419 Page Expired (Laravel CSRF Mismatch Convention)
        if (req.wantsJson()) {
          return new ForgeResponse()
            .status(419)
            .json({ error: 'CSRF token mismatch', statusCode: 419 });
        }

        return new ForgeResponse().status(419).html(`<!DOCTYPE html>
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
    <p>The page has expired due to inactivity or a CSRF token mismatch. Please refresh and try again.</p>
    <a href="javascript:location.reload()">Refresh Page</a>
  </div>
</body>
</html>`);
      }
    }

    const response = await next();

    // 3. Set or refresh session cookie
    response.cookie(CsrfMiddleware.COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    });

    return response;
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;
    for (const pair of cookieHeader.split(';')) {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        list[key] = decodeURIComponent(val);
      }
    }
    return list;
  }
}
