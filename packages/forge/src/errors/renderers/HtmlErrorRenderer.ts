// packages/forge/src/errors/renderers/HtmlErrorRenderer.ts
// ─────────────────────────────────────────────────────────────────────
// Rich development HTML debugging interface & zero-leak production HTML pages.
// Features interactive stack frames, code snippets, route context,
// cause hierarchy, and request inspector.
// ─────────────────────────────────────────────────────────────────────

import type { NormalizedError } from '../ErrorNormalizer.js';
import type { ErrorContext } from '../ContextCollector.js';
import type { CodeSnippet } from '../SourceFrameReader.js';
import { FallbackRenderer } from './FallbackRenderer.js';

export class HtmlErrorRenderer {
  /**
   * Escape HTML entities.
   */
  static escapeHtml(str: unknown): string {
    return FallbackRenderer.escapeHtml(str);
  }

  /**
   * Render rich development HTML debugging page.
   */
  static renderDebug(error: NormalizedError, context: ErrorContext): string {
    try {
      return this.doRenderDebug(error, context);
    } catch (renderError) {
      return FallbackRenderer.renderHtml(error.raw, renderError, context.errorId);
    }
  }

  /**
   * Render clean, zero-leak production HTML error page.
   */
  static renderProduction(statusCode: number = 500, message: string = 'Something went wrong', errorId?: string): string {
    const pages: Record<number, { heading: string; description: string }> = {
      400: { heading: 'Bad Request', description: 'The request could not be understood by the server.' },
      401: { heading: 'Unauthorized', description: 'Authentication is required to access this resource.' },
      403: { heading: 'Access Forbidden', description: 'You do not have permission to access this resource.' },
      404: { heading: 'Page Not Found', description: 'The page you are looking for does not exist or has been moved.' },
      405: { heading: 'Method Not Allowed', description: 'This action is not supported for the requested page.' },
      408: { heading: 'Request Timeout', description: 'The server timed out waiting for the request. Please try again.' },
      413: { heading: 'Payload Too Large', description: 'The submitted data is larger than the server is willing to accept.' },
      419: { heading: 'Page Expired', description: 'Your session has expired. Please refresh the page and try again.' },
      422: { heading: 'Unprocessable Request', description: 'The submitted data was invalid. Please check your input and try again.' },
      429: { heading: 'Too Many Requests', description: 'You have made too many requests. Please wait a moment and try again.' },
      500: { heading: 'Something went wrong', description: 'An unexpected error occurred on our server. Please try again later.' },
      502: { heading: 'Bad Gateway', description: 'The server received an invalid response from an upstream service. Please try again shortly.' },
      503: {
        heading: 'Service Temporarily Unavailable',
        description: 'The server is temporarily unable to service your request due to maintenance or connection limits. Please try again shortly.',
      },
      504: { heading: 'Gateway Timeout', description: 'An upstream service took too long to respond. Please try again shortly.' },
    };

    const isClientError = statusCode >= 400 && statusCode < 500;
    const page = pages[statusCode] ?? (isClientError
      ? { heading: 'Request Error', description: 'The request could not be completed.' }
      : pages[500]);

    const heading = page.heading;
    const description = page.description;
    const titleText =
      statusCode === 500 || !pages[statusCode]
        ? (isClientError ? heading : 'Internal Server Error')
        : statusCode === 403
          ? 'Forbidden'
          : heading;
    const title = `${statusCode} | ${titleText}`;

    const safeErrorId = errorId ? this.escapeHtml(errorId) : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)} — ForgeTS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(15, 23, 42, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent-blue: #6366f1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background-image: radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.12) 0%, transparent 60%);
    }
    .error-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 1rem;
      padding: 3rem 2.5rem;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .status-code {
      font-size: 4rem;
      font-weight: 800;
      background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
      margin-bottom: 1rem;
    }
    .error-heading {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.75rem;
    }
    .error-desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .error-id-badge {
      display: inline-block;
      font-family: monospace;
      font-size: 0.8rem;
      color: #64748b;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0.35rem 0.75rem;
      border-radius: 0.375rem;
      margin-bottom: 2rem;
      user-select: all;
    }
    .home-btn {
      display: inline-block;
      background: var(--accent-blue);
      color: #ffffff;
      font-weight: 600;
      font-size: 0.9rem;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
      transition: background-color 0.2s ease;
    }
    .home-btn:hover {
      background-color: #4f46e5;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="status-code">${this.escapeHtml(String(statusCode))}</div>
    <h1 class="error-heading">${this.escapeHtml(heading)}</h1>
    <p class="error-desc">${this.escapeHtml(description)}</p>
    ${safeErrorId ? `<div class="error-id-badge">Error ID: ${safeErrorId}</div><br>` : ''}
    <a href="/" class="home-btn">Return Home</a>
  </div>
</body>
</html>`;
  }

  private static doRenderDebug(error: NormalizedError, context: ErrorContext): string {
    const { type, message, statusCode, code, primarySnippet, stackFrames, causes, diagnostics } = error;
    const { request, route, environment, errorId } = context;

    // Snippet HTML
    const snippetHtml = this.renderSnippetHtml(primarySnippet);

    // Multi-error diagnostic tabs
    let multiErrorHtml = '';
    if (diagnostics && diagnostics.length > 1) {
      const tabs = diagnostics
        .map(
          (d, idx) => `
        <button class="diag-btn ${idx === 0 ? 'active' : ''}" onclick="selectDiagnostic(${idx})">
          <span>${this.escapeHtml(d.location ? `${d.location.displayPath}:${d.location.line}` : d.name)}</span>
        </button>
      `,
        )
        .join('');

      const panels = diagnostics
        .map(
          (d, idx) => `
        <div class="diagnostic-panel ${idx === 0 ? 'active' : 'hidden'}" id="diag-panel-${idx}">
          <div class="diag-title">${this.escapeHtml(d.name)}: ${this.escapeHtml(d.message)}</div>
          ${
            d.location
              ? `<div class="error-location">${this.escapeHtml(d.location.displayPath)}:${d.location.line}:${d.location.column}</div>`
              : ''
          }
          ${d.snippet ? this.renderSnippetHtml(d.snippet) : ''}
          ${d.stack ? `<pre class="diag-stack">${this.escapeHtml(d.stack)}</pre>` : ''}
        </div>
      `,
        )
        .join('');

      multiErrorHtml = `
        <div class="multi-error-bar">
          <div class="multi-error-header">
            <span class="multi-error-badge">${diagnostics.length} Build Errors</span>
            <span class="multi-error-sub">Found ${diagnostics.length} issues during build/execution:</span>
          </div>
          <div class="diagnostic-nav">${tabs}</div>
          <div class="diagnostic-content">${panels}</div>
        </div>
      `;
    }

    // Stack trace frames HTML
    const appFrameCount = stackFrames.filter((f) => f.isApp).length;
    const totalFrameCount = stackFrames.length;

    let framesHtml = '';
    stackFrames.forEach((frame, idx) => {
      const badgeClass = frame.isApp ? 'badge-app' : frame.isFramework ? 'badge-framework' : 'badge-vendor';
      const badgeText = frame.isApp ? 'APP' : frame.isFramework ? 'FORGE' : 'VENDOR';
      const pathText = frame.displayPath || frame.file || 'native';
      const locText = frame.line > 0 ? `:${frame.line}:${frame.column}` : '';

      let frameSnippetHtml = '';
      if (frame.snippet && frame.snippet.lines.length > 0) {
        let fLines = '';
        for (const item of frame.snippet.lines) {
          const numStr = String(item.lineNum).padStart(4, ' ');
          const escapedCode = this.escapeHtml(item.code);
          const isErr = item.isErrorLine;
          fLines += `<div class="code-line ${isErr ? 'highlight' : ''}"><span class="line-num">${numStr} |</span> <span class="line-code">${escapedCode}</span></div>`;
        }
        frameSnippetHtml = `
          <div class="frame-snippet" id="snippet-frame-${idx}" style="display: none;">
            <div class="snippet-body">${fLines}</div>
          </div>
        `;
      }

      framesHtml += `
        <div class="stack-frame-item ${frame.isApp ? 'app-frame' : ''}" onclick="toggleFrame(${idx})">
          <div class="frame-main">
            <span class="frame-badge ${badgeClass}">${badgeText}</span>
            <span class="frame-fn">${this.escapeHtml(frame.functionName)}</span>
            <span class="frame-file">${this.escapeHtml(pathText)}${locText}</span>
          </div>
          ${frameSnippetHtml}
        </div>
      `;
    });

    // Causes HTML
    let causesHtml = '';
    if (causes.length > 0) {
      causesHtml = `
        <div class="causes-section">
          <div class="section-title">Exception Causes Chain</div>
          <div class="causes-list">
            ${causes
              .map(
                (cause, i) => `
              <div class="cause-card">
                <div class="cause-header">
                  <span class="cause-arrow">↳ Caused by #${i + 1}:</span>
                  <span class="cause-type">${this.escapeHtml(cause.type)}</span>
                  ${cause.code ? `<span class="code-pill">${this.escapeHtml(cause.code)}</span>` : ''}
                </div>
                <div class="cause-message">${this.escapeHtml(cause.message)}</div>
                ${
                  cause.stackLines.length > 0
                    ? `<div class="cause-stack">${this.escapeHtml(cause.stackLines.slice(0, 8).join('\n'))}</div>`
                    : ''
                }
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      `;
    }

    // Route Information
    const routeTable = `
      <table class="key-val-table">
        <tr><td class="key-col">Matched Route Pattern</td><td class="val-col"><code>${this.escapeHtml(route.pattern ?? 'None (Unmatched / Static)')}</code></td></tr>
        <tr><td class="key-col">Controller</td><td class="val-col"><code>${this.escapeHtml(route.controller ?? 'None')}</code></td></tr>
        <tr><td class="key-col">Action</td><td class="val-col"><code>${this.escapeHtml(route.action ?? 'None')}</code></td></tr>
        <tr><td class="key-col">Route Parameters</td><td class="val-col">${this.renderKeyValueTable(route.params)}</td></tr>
        <tr><td class="key-col">Applied Middleware</td><td class="val-col">${route.middleware.length > 0 ? route.middleware.map((m) => `<span class="frame-badge badge-framework">${this.escapeHtml(m)}</span>`).join(' ') : '<span class="empty-hint">None</span>'}</td></tr>
      </table>
    `;

    // Request Tables
    const hasQueryParams = Object.keys(request.queryParams).length > 0;
    const queryTable = hasQueryParams ? this.renderKeyValueTable(request.queryParams) : '<p class="empty-hint">No query parameters</p>';
    const headersTable = Object.keys(request.headers).length > 0 ? this.renderKeyValueTable(request.headers) : '<p class="empty-hint">No headers provided</p>';

    let bodyDisplay = '<p class="empty-hint">Empty body</p>';
    if (request.body !== undefined && request.body !== null) {
      bodyDisplay = `<pre class="json-box">${this.escapeHtml(JSON.stringify(request.body, null, 2))}</pre>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(type)}: ${this.escapeHtml(message)} — ForgeTS Debug</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(15, 23, 42, 0.88);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-red: #ef4444;
      --accent-red-glow: rgba(239, 68, 68, 0.16);
      --accent-blue: #6366f1;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --code-bg: #020617;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      padding: 2rem 1.5rem;
      background-image: 
        radial-gradient(circle at 10% 10%, rgba(239, 68, 68, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 90% 90%, rgba(99, 102, 241, 0.10) 0%, transparent 40%);
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .badge-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 800;
      font-size: 1.25rem;
      letter-spacing: -0.02em;
    }
    .brand span { color: #818cf8; }
    .badge-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .status-pill {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 0.3rem 0.8rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .code-pill {
      background: rgba(148, 163, 184, 0.15);
      border: 1px solid rgba(148, 163, 184, 0.3);
      color: #cbd5e1;
      padding: 0.3rem 0.65rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }
    .id-pill {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #c7d2fe;
      padding: 0.3rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      user-select: all;
    }
    .env-pill {
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
      padding: 0.3rem 0.8rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .hero-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(16px);
      border-radius: 1rem;
      padding: 2.25rem;
      margin-bottom: 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .exception-type {
      font-size: 0.95rem;
      font-weight: 700;
      color: #f87171;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .exception-msg {
      font-size: 1.6rem;
      font-weight: 700;
      line-height: 1.35;
      color: #ffffff;
      word-break: break-word;
    }
    .snippet-box {
      background: var(--code-bg);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.75rem;
      overflow: hidden;
      margin-top: 1.5rem;
    }
    .snippet-header {
      background: rgba(15, 23, 42, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding: 0.65rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
    }
    .snippet-icon { color: #818cf8; font-weight: 600; }
    .snippet-path { color: #f8fafc; font-weight: 500; }
    .snippet-pos { color: #94a3b8; }
    .snippet-body {
      padding: 0.85rem 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      line-height: 1.6;
    }
    .code-line {
      display: flex;
      padding: 0.15rem 1.25rem;
      white-space: pre;
    }
    .code-line.highlight {
      background: rgba(239, 68, 68, 0.16);
      border-left: 3px solid #ef4444;
      padding-left: calc(1.25rem - 3px);
    }
    .caret-line {
      background: rgba(239, 68, 68, 0.08);
      color: #ef4444;
      font-weight: 700;
    }
    .line-num {
      color: #64748b;
      min-width: 4rem;
      user-select: none;
      text-align: right;
      padding-right: 1.25rem;
    }
    .line-code { color: #e2e8f0; flex: 1; }
    .tabs-nav {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 1.5rem;
      overflow-x: auto;
    }
    .tab-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 600;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .tab-btn:hover { color: #ffffff; }
    .tab-btn.active {
      color: #818cf8;
      border-bottom-color: #818cf8;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .stack-frame-item {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      transition: background 0.15s ease;
      border-radius: 0.375rem;
    }
    .stack-frame-item:hover { background: rgba(255, 255, 255, 0.03); }
    .stack-frame-item.app-frame { border-left: 3px solid #6366f1; }
    .frame-main { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .frame-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-app { background: rgba(99, 102, 241, 0.25); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.4); }
    .badge-framework { background: rgba(14, 165, 233, 0.25); color: #bae6fd; border: 1px solid rgba(14, 165, 233, 0.4); }
    .badge-vendor { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.25); }
    .frame-fn { color: #f8fafc; font-weight: 600; }
    .frame-file { color: #94a3b8; }
    .key-val-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .key-val-table tr { border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
    .key-col { width: 220px; color: var(--text-muted); padding: 0.6rem 0.75rem; font-weight: 600; }
    .val-col { color: #f8fafc; padding: 0.6rem 0.75rem; font-family: 'JetBrains Mono', monospace; word-break: break-all; }
    .empty-hint { color: #64748b; font-style: italic; font-size: 0.85rem; }
    .json-box { background: var(--code-bg); border: 1px solid rgba(255, 255, 255, 0.06); padding: 1rem; border-radius: 0.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; overflow-x: auto; color: #e2e8f0; }
    .causes-section { margin-bottom: 1.5rem; }
    .section-title { font-size: 1rem; font-weight: 700; color: #ffffff; margin-bottom: 0.75rem; }
    .cause-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.75rem; }
    .cause-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem; }
    .cause-arrow { color: #ef4444; font-weight: 700; font-size: 0.85rem; }
    .cause-type { color: #fca5a5; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
    .cause-message { color: #f8fafc; font-size: 0.9rem; margin-bottom: 0.5rem; }
    .cause-stack { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #94a3b8; white-space: pre-wrap; background: var(--code-bg); padding: 0.5rem; border-radius: 0.25rem; }
    .multi-error-bar { background: var(--card-bg); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1.5rem; }
    .multi-error-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
    .multi-error-badge { background: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
    .multi-error-sub { color: var(--text-muted); font-size: 0.85rem; }
    .diagnostic-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .diag-btn { background: var(--code-bg); border: 1px solid var(--card-border); color: var(--text-muted); padding: 0.45rem 0.8rem; border-radius: 0.5rem; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; }
    .diag-btn.active { background: rgba(239, 68, 68, 0.15); border-color: #ef4444; color: #ffffff; font-weight: 600; }
    .diag-idx { background: rgba(255, 255, 255, 0.1); padding: 0.1rem 0.35rem; border-radius: 0.25rem; font-size: 0.7rem; }
    .diagnostic-panel { margin-top: 1rem; }
    .diagnostic-panel.hidden { display: none; }
    .diag-title { font-weight: 600; color: #ffffff; margin-bottom: 0.5rem; }
    .diag-stack { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; background: var(--code-bg); padding: 0.75rem; border-radius: 0.375rem; color: #cbd5e1; white-space: pre-wrap; margin-top: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge-bar">
      <div class="brand"><span>Forge</span>TS Debug Engine</div>
      <div class="badge-group">
        <span class="status-pill">${this.escapeHtml(String(statusCode))} ${this.escapeHtml(this.getStatusText(statusCode))}</span>
        <span class="code-pill">${this.escapeHtml(code)}</span>
        <span class="id-pill" title="Click to copy Error ID" onclick="navigator.clipboard.writeText('${this.escapeHtml(errorId)}')">ID: ${this.escapeHtml(errorId)}</span>
        <span class="env-pill">APP_DEBUG = TRUE</span>
      </div>
    </div>

    <div class="hero-card">
      <div class="exception-type">
        <span>${this.escapeHtml(type)}</span>
      </div>
      <div class="exception-msg">${this.escapeHtml(message)}</div>
      ${snippetHtml}
    </div>

    ${multiErrorHtml}

    <div class="tabs-nav">
      <button class="tab-btn active" onclick="switchTab('tab-stack')">Stack Trace (${appFrameCount} app / ${totalFrameCount} total)</button>
      <button class="tab-btn" onclick="switchTab('tab-route')">Route Information</button>
      <button class="tab-btn" onclick="switchTab('tab-request')">Request &amp; Body</button>
      <button class="tab-btn" onclick="switchTab('tab-headers')">Headers</button>
      ${causes.length > 0 ? `<button class="tab-btn" onclick="switchTab('tab-causes')">Causes (${causes.length})</button>` : ''}
      <button class="tab-btn" onclick="switchTab('tab-env')">Environment</button>
    </div>

    <div class="tab-content active" id="tab-stack">
      <div class="card">
        ${framesHtml || '<p class="empty-hint">No stack frames available</p>'}
      </div>
    </div>

    <div class="tab-content" id="tab-route">
      <div class="card">
        ${routeTable}
      </div>
    </div>

    <div class="tab-content" id="tab-request">
      <div class="card">
        <table class="key-val-table">
          <tr><td class="key-col">Method</td><td class="val-col"><code>${this.escapeHtml(request.method)}</code></td></tr>
          <tr><td class="key-col">Path</td><td class="val-col"><code>${this.escapeHtml(request.path)}</code></td></tr>
          <tr><td class="key-col">Full URL</td><td class="val-col">${this.escapeHtml(request.url)}</td></tr>
          <tr><td class="key-col">Content Type</td><td class="val-col">${this.escapeHtml(request.contentType || 'none')}</td></tr>
          <tr><td class="key-col">Timestamp</td><td class="val-col">${this.escapeHtml(request.timestamp)}</td></tr>
        </table>
      </div>

      <div class="card">
        <div class="section-title">Query Parameters</div>
        ${queryTable}
      </div>

      <div class="card">
        <div class="section-title">Request Body</div>
        ${bodyDisplay}
      </div>
    </div>

    <div class="tab-content" id="tab-headers">
      <div class="card">
        ${headersTable}
      </div>
    </div>

    ${
      causes.length > 0
        ? `
      <div class="tab-content" id="tab-causes">
        <div class="card">
          ${causesHtml}
        </div>
      </div>
    `
        : ''
    }

    <div class="tab-content" id="tab-env">
      <div class="card">
        <table class="key-val-table">
          <tr><td class="key-col">Runtime</td><td class="val-col">${this.escapeHtml(environment.runtime)}</td></tr>
          <tr><td class="key-col">Environment (NODE_ENV)</td><td class="val-col">${this.escapeHtml(environment.nodeEnv)}</td></tr>
          <tr><td class="key-col">Debug Mode (APP_DEBUG)</td><td class="val-col">${environment.appDebug ? 'true' : 'false'}</td></tr>
          <tr><td class="key-col">Timezone</td><td class="val-col">${this.escapeHtml(environment.timezone)}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <script>
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
      if (activeBtn) activeBtn.classList.add('active');
      
      const activeContent = document.getElementById(tabId);
      if (activeContent) activeContent.classList.add('active');
    }

    function toggleFrame(idx) {
      const el = document.getElementById('snippet-frame-' + idx);
      if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
      }
    }

    function selectDiagnostic(idx) {
      document.querySelectorAll('.diag-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
      document.querySelectorAll('.diagnostic-panel').forEach((p, i) => {
        if (i === idx) {
          p.classList.remove('hidden');
          p.classList.add('active');
        } else {
          p.classList.add('hidden');
          p.classList.remove('active');
        }
      });
    }
  </script>
</body>
</html>`;
  }

  private static renderSnippetHtml(snippet: CodeSnippet | null | undefined): string {
    if (!snippet || !snippet.lines || snippet.lines.length === 0) {
      return '';
    }

    let linesHtml = '';
    for (const item of snippet.lines) {
      const numStr = String(item.lineNum).padStart(4, ' ');
      const escapedCode = this.escapeHtml(item.code);
      if (item.isErrorLine) {
        linesHtml += `<div class="code-line highlight"><span class="line-num">${numStr} |</span> <span class="line-code">${escapedCode}</span></div>`;
        if (snippet.column > 0) {
          // Align caret properly
          const indent = ' '.repeat(Math.max(0, snippet.column - 1));
          linesHtml += `<div class="code-line caret-line"><span class="line-num">     |</span> <span class="line-code"><span class="caret-marker">${indent}^</span></span></div>`;
        }
      } else {
        linesHtml += `<div class="code-line"><span class="line-num">${numStr} |</span> <span class="line-code">${escapedCode}</span></div>`;
      }
    }

    return `
      <div class="snippet-box">
        <div class="snippet-header">
          <span class="snippet-icon">[Source]</span>
          <span class="snippet-path">${this.escapeHtml(snippet.displayPath)}</span>
          <span class="snippet-pos">:${snippet.line}:${snippet.column}</span>
        </div>
        <div class="snippet-body">${linesHtml}</div>
      </div>
    `;
  }

  private static renderKeyValueTable(data: Record<string, any>): string {
    if (!data || typeof data !== 'object') {
      return '<p class="empty-hint">None</p>';
    }
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return '<p class="empty-hint">None</p>';
    }

    let rows = '';
    for (const [key, val] of Object.entries(data)) {
      const valStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
      rows += `<tr><td class="key-col">${this.escapeHtml(key)}</td><td class="val-col">${this.escapeHtml(valStr)}</td></tr>`;
    }

    return `<table class="key-val-table">${rows}</table>`;
  }

  private static getStatusText(code: number): string {
    switch (code) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 405: return 'Method Not Allowed';
      case 413: return 'Payload Too Large';
      case 419: return 'Page Expired';
      case 422: return 'Unprocessable Entity';
      case 429: return 'Too Many Requests';
      case 500: return 'Internal Server Error';
      case 503: return 'Service Unavailable';
      default: return 'Error';
    }
  }
}
