// packages/forge/src/http/ErrorDisplayEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Interactive Debug Error Display Engine (Laravel Ignition / Youch style).
// Generates a rich, dark-mode HTML error page with code snippet previews,
// line highlighting, stack trace frames, and system metadata when APP_DEBUG=true.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';

export class ErrorDisplayEngine {
  /**
   * Render a rich HTML error page for browser requests when APP_DEBUG=true.
   */
  static renderHtml(error: unknown, reqUrl?: string): string {
    const err = error instanceof Error ? error : new Error(String(error));
    const name = err.name || 'Error';
    const message = this.redactSecrets(err.message || 'An unexpected error occurred');
    const stackRaw = this.redactSecrets(err.stack || '');

    // Parse top non-node_modules frame for code snippet display
    const stackLines = stackRaw.split('\n');
    let errorFile = '';
    let errorLine = 0;
    let errorCol = 0;
    let snippetHtml = '';

    for (const line of stackLines) {
      const match =
        line.match(/(?:at\s+.*?\s+\()?([\/\\].*?):(\d+):(\d+)\)?$/) ||
        line.match(/at\s+([\/\\].*?):(\d+):(\d+)$/);

      if (match) {
        const [, file, l, c] = match;
        if (!file.includes('node_modules') && !file.includes('bun:')) {
          errorFile = file;
          errorLine = parseInt(l, 10);
          errorCol = parseInt(c, 10);
          break;
        }
      }
    }

    if (errorFile && existsSync(errorFile) && errorLine > 0) {
      try {
        const fileContent = readFileSync(errorFile, 'utf-8');
        const lines = fileContent.split('\n');
        const start = Math.max(0, errorLine - 5);
        const end = Math.min(lines.length, errorLine + 4);

        let snippetLines = '';
        for (let i = start; i < end; i++) {
          const lineNum = i + 1;
          const isErrorLine = lineNum === errorLine;
          const lineText = this.escapeHtml(lines[i]);
          const numStr = String(lineNum).padStart(4, ' ');

          if (isErrorLine) {
            snippetLines += `<div class="code-line highlight"><span class="line-num">${numStr} |</span> <span class="line-code">${lineText}</span></div>`;
          } else {
            snippetLines += `<div class="code-line"><span class="line-num">${numStr} |</span> <span class="line-code">${lineText}</span></div>`;
          }
        }
        snippetHtml = `
          <div class="snippet-box">
            <div class="snippet-header">📍 ${this.escapeHtml(errorFile)}:${errorLine}:${errorCol}</div>
            <div class="snippet-body">${snippetLines}</div>
          </div>
        `;
      } catch {
        snippetHtml = '';
      }
    }

    const formattedStack = stackLines
      .map((line) => `<div class="stack-frame">${this.escapeHtml(line.trim())}</div>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ ${this.escapeHtml(name)}: ${this.escapeHtml(message)} — ForgeTS Debug</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(15, 23, 42, 0.8);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-red: #ef4444;
      --accent-red-glow: rgba(239, 68, 68, 0.15);
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
      padding: 2rem;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 40%);
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    .badge-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 800;
      font-size: 1.25rem;
    }
    .brand span { color: #818cf8; }
    .env-badge {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .error-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .error-type {
      color: #f87171;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .error-message {
      font-size: 1.75rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
      margin-bottom: 1rem;
    }
    .error-location {
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
      font-size: 0.85rem;
      background: rgba(0, 0, 0, 0.3);
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border-left: 3px solid #f87171;
      word-break: break-all;
    }
    .snippet-box {
      margin-top: 1.5rem;
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      overflow: hidden;
    }
    .snippet-header {
      background: rgba(255, 255, 255, 0.03);
      padding: 0.6rem 1rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: #94a3b8;
      border-bottom: 1px solid var(--card-border);
    }
    .snippet-body {
      padding: 1rem 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      line-height: 1.6;
    }
    .code-line {
      display: flex;
      padding: 0.15rem 1rem;
    }
    .code-line.highlight {
      background: var(--accent-red-glow);
      border-left: 3px solid #ef4444;
    }
    .code-line.highlight .line-code {
      color: #fca5a5;
      font-weight: 600;
    }
    .line-num {
      color: #475569;
      width: 4.5rem;
      user-select: none;
      flex-shrink: 0;
    }
    .line-code {
      color: #e2e8f0;
      white-space: pre-wrap;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .stack-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1rem;
      padding: 1.5rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      overflow-x: auto;
    }
    .stack-frame {
      padding: 0.4rem 0.6rem;
      border-radius: 0.375rem;
      color: #cbd5e1;
    }
    .stack-frame:nth-child(even) {
      background: rgba(255, 255, 255, 0.02);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .meta-card {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--card-border);
      padding: 1rem;
      border-radius: 0.75rem;
    }
    .meta-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }
    .meta-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      color: #f1f5f9;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge-bar">
      <div class="brand">⚡ <span>Forge</span>TS Debug Engine</div>
      <div class="env-badge">APP_DEBUG = TRUE</div>
    </div>

    <div class="error-card">
      <div class="error-type">${this.escapeHtml(name)}</div>
      <div class="error-message">${this.escapeHtml(message)}</div>
      ${errorFile ? `<div class="error-location">📍 ${this.escapeHtml(errorFile)}:${errorLine}:${errorCol}</div>` : ''}
      ${snippetHtml}
    </div>

    <div class="section-title">🔍 Stack Trace</div>
    <div class="stack-box">
      ${formattedStack}
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Runtime</div>
        <div class="meta-val">Bun ${typeof Bun !== 'undefined' ? Bun.version : 'Node'}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Request URL</div>
        <div class="meta-val">${this.escapeHtml(reqUrl ?? '/')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Environment</div>
        <div class="meta-val">${process.env.NODE_ENV ?? 'development'}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Timestamp</div>
        <div class="meta-val">${this.formatTimestamp()}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Render a simple, clean production HTML error page when APP_DEBUG=false.
   * Contains zero stack traces or internal implementation details.
   */
  static renderProductionHtml(statusCode = 500, message = 'Something went wrong'): string {
    const title = statusCode === 404 ? '404 | Page Not Found' : statusCode + ' | Internal Server Error';
    const heading = statusCode === 404 ? 'Page Not Found' : 'Something went wrong';
    const description = statusCode === 404
      ? 'The page you are looking for does not exist or has been moved.'
      : 'An unexpected error occurred on our server. Please try again later.';

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
      --card-bg: rgba(15, 23, 42, 0.8);
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
      background-image: 
        radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.12) 0%, transparent 60%);
    }
    .error-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 1rem;
      padding: 3rem 2.5rem;
      max-width: 500px;
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
      margin-bottom: 2rem;
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
    <div class="status-code">${statusCode}</div>
    <h1 class="error-heading">${this.escapeHtml(heading)}</h1>
    <p class="error-desc">${this.escapeHtml(description)}</p>
    <a href="/" class="home-btn">Return Home</a>
  </div>
</body>
</html>`;
  }

  private static formatTimestamp(): string {
    let tz = 'Asia/Kolkata';
    try {
      const { getConfigManager } = require('../config/ConfigManager.js');
      const cfg = getConfigManager();
      if (cfg) {
        tz = cfg.get('app.timezone', 'Asia/Kolkata');
      }
    } catch {
      tz = process.env.APP_TIMEZONE ?? process.env.TZ ?? 'Asia/Kolkata';
    }

    const ianaTz = tz === 'IST' ? 'Asia/Kolkata' : tz;

    try {
      const timeStr = new Date().toLocaleTimeString('en-US', {
        timeZone: ianaTz,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return `${timeStr} (${tz})`;
    } catch {
      return new Date().toISOString().slice(11, 19) + ' UTC';
    }
  }

  static redactSecrets(text: string): string {
    if (!text) return text;
    let result = text;

    const safeWhitelist = new Set([
      'true', 'false', 'development', 'production', 'test', '3000', '3306',
      'localhost', '127.0.0.1', 'sqlite', 'mysql', 'ForgeTS', 'en', 'IST', 'Asia/Kolkata', 'UTC'
    ]);

    for (const [key, val] of Object.entries(process.env)) {
      if (!val || typeof val !== 'string' || val.trim().length < 4) continue;
      const trimmedVal = val.trim();
      if (safeWhitelist.has(trimmedVal)) continue;

      const isSecretKey =
        key.includes('SECRET') ||
        key.includes('PASS') ||
        key.includes('KEY') ||
        key.includes('TOKEN') ||
        key.includes('DB') ||
        key.includes('AUTH') ||
        key.includes('CREDENTIAL');

      if (isSecretKey || trimmedVal.length >= 6) {
        if (result.includes(trimmedVal)) {
          result = result.replaceAll(trimmedVal, '[REDACTED]');
        }
      }
    }

    return result;
  }

  private static escapeHtml(str: string): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
