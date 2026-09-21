// packages/forge/src/errors/renderers/FallbackRenderer.ts
// ─────────────────────────────────────────────────────────────────────
// Fail-safe emergency fallback renderer.
// Invoked only if the primary error renderers encounter an unhandled exception.
// Guaranteed to NEVER throw and produces valid HTML or JSON.
// ─────────────────────────────────────────────────────────────────────

export class FallbackRenderer {
  /**
   * Safe HTML escaping with zero external dependencies.
   */
  static escapeHtml(str: unknown): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Minimal, ultra-resilient HTML fallback document.
   */
  static renderHtml(originalError: unknown, rendererError?: unknown, errorId: string = 'err_fallback'): string {
    let origMsg = 'An unexpected error occurred';
    try {
      origMsg = String((originalError as any)?.message ?? originalError ?? 'Unknown error');
    } catch {
      origMsg = '[Unreadable original error]';
    }

    let renderMsg = '';
    try {
      if (rendererError) {
        renderMsg = String((rendererError as any)?.message ?? rendererError ?? '');
      }
    } catch {
      renderMsg = '[Unreadable renderer error]';
    }

    const safeErrorId = this.escapeHtml(errorId);
    const safeOrigMsg = this.escapeHtml(origMsg);
    const safeRenderMsg = this.escapeHtml(renderMsg);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>500 — ForgeTS Error Handler Fallback</title>
  <style>
    body { background: #090d16; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; padding: 2rem; margin: 0; }
    .card { background: #0f172a; border: 1px solid #ef4444; border-radius: 8px; padding: 2rem; max-width: 800px; margin: 2rem auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #f87171; font-size: 1.5rem; margin-top: 0; margin-bottom: 0.5rem; }
    .error-id { color: #94a3b8; font-size: 0.85rem; font-family: monospace; margin-bottom: 1.5rem; }
    p { color: #cbd5e1; line-height: 1.6; }
    h3 { color: #fca5a5; font-size: 1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    pre { background: #020617; border: 1px solid #1e293b; padding: 1rem; border-radius: 6px; overflow-x: auto; color: #e2e8f0; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>ForgeTS Error Handler Fallback</h1>
    <div class="error-id">Error ID: ${safeErrorId}</div>
    <p>An error occurred, and the error display engine encountered an issue while formatting it.</p>
    <h3>Original Error:</h3>
    <pre>${safeOrigMsg}</pre>
    ${safeRenderMsg ? `<h3>Renderer Issue:</h3><pre>${safeRenderMsg}</pre>` : ''}
  </div>
</body>
</html>`;
  }

  /**
   * Minimal, ultra-resilient JSON fallback string.
   */
  static renderJson(originalError: unknown, errorId: string = 'err_fallback', isDebug = false): string {
    let message = 'Internal Server Error';
    if (isDebug) {
      try {
        message = String((originalError as any)?.message ?? originalError ?? 'Internal Server Error');
      } catch {
        message = 'Internal Server Error';
      }
    }

    try {
      return JSON.stringify({
        message,
        error: {
          type: 'InternalServerError',
          code: 'ERR_INTERNAL_SERVER_ERROR',
          message,
          status: 500,
        },
        request: {
          id: errorId,
        },
        statusCode: 500,
      });
    } catch {
      return `{"message":"Internal Server Error","statusCode":500,"request":{"id":"${errorId}"}}`;
    }
  }
}
