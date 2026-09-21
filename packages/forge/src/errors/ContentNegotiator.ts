// packages/forge/src/errors/ContentNegotiator.ts
// ─────────────────────────────────────────────────────────────────────
// Centralized HTTP content negotiation for error responses.
// Guarantees consistent decision logic across all error handlers and servers.
// ─────────────────────────────────────────────────────────────────────

export class ContentNegotiator {
  /**
   * Determine whether the client expects an HTML error response (e.g. browser navigation).
   */
  static prefersHtml(rawRequest?: globalThis.Request, pathname?: string): boolean {
    if (!rawRequest) return false;

    let path = pathname;
    if (!path && rawRequest.url) {
      try {
        path = new URL(rawRequest.url, 'http://localhost').pathname;
      } catch {
        path = '';
      }
    }

    // 1. API routes always receive JSON, never HTML error pages
    if (path && (path.startsWith('/api/') || path === '/api')) {
      return false;
    }

    // 2. Inspect Accept header
    const accept = rawRequest.headers.get('accept') ?? '';

    // If Accept explicitly prefers JSON over HTML
    if (accept.includes('application/json') && !accept.includes('text/html')) {
      return false;
    }

    // If Accept includes text/html (standard browser navigation)
    if (accept.includes('text/html')) {
      return true;
    }

    return false;
  }

  /**
   * Determine whether the client expects a JSON error response (API or non-HTML request).
   */
  static wantsJson(rawRequest?: globalThis.Request, pathname?: string): boolean {
    return !this.prefersHtml(rawRequest, pathname);
  }
}
