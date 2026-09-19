// packages/forge/src/http/ErrorDisplayEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Developer Exception & Error Display Engine (Laravel Ignition style).
// Generates a rich, interactive, dark-mode HTML error debugging page with:
// - Code snippet previews with active line & caret indicator
// - Structured stack trace with Application vs Framework vs Vendor categorization
// - Request metadata, query params, route params, and sanitized headers/body
// - Exception cause chain inspection
// - Process secrets & credential redaction
// - Bulletproof failure safety (never throws while handling an error)
// - Clean, zero-leak production error pages when APP_DEBUG=false
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../config/env.js';

export interface DiagnosticLocation {
  file: string;
  displayPath: string;
  line: number;
  column: number;
  lineText?: string;
}

export interface NormalizedDiagnostic {
  name: string;
  message: string;
  location?: DiagnosticLocation;
  snippet?: CodeSnippet | null;
  stack?: string;
}

export interface StackFrame {
  raw: string;
  functionName: string;
  file: string;
  displayPath: string;
  line: number;
  column: number;
  isApp: boolean;
  isFramework: boolean;
  isVendor: boolean;
  snippet?: CodeSnippet | null;
}

export interface CodeSnippet {
  file: string;
  displayPath: string;
  line: number;
  column: number;
  lines: Array<{
    lineNum: number;
    code: string;
    isErrorLine: boolean;
  }>;
}

export interface ExceptionCause {
  name: string;
  message: string;
  stackLines: string[];
}

export interface RequestDetails {
  method: string;
  url: string;
  path: string;
  queryParams: Record<string, string | string[]>;
  routeParams: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
  contentType: string;
  timestamp: string;
}

export interface EnvironmentDetails {
  runtime: string;
  nodeEnv: string;
  appDebug: boolean;
  timezone: string;
}

export class ErrorDisplayEngine {
  /**
   * Render a rich HTML error page for browser requests when APP_DEBUG=true.
   * Guaranteed to NEVER throw an unhandled exception.
   */
  static renderHtml(
    error: unknown,
    requestOrUrl?: unknown,
    forgeReq?: unknown,
  ): string {
    try {
      return this.doRenderHtml(error, requestOrUrl, forgeReq);
    } catch (renderError) {
      // Fail-safe emergency fallback if an error occurs inside the renderer itself
      return this.renderEmergencyFallbackHtml(error, renderError);
    }
  }

  /**
   * Internal render method with full diagnostic extraction.
   */
  private static doRenderHtml(
    error: unknown,
    requestOrUrl?: unknown,
    forgeReq?: unknown,
  ): string {
    const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
    const name = err.name || 'Error';
    const rawMessage = err.message || 'An unexpected error occurred';
    const message = this.redactSecrets(rawMessage);
    const rawStack = err.stack || '';

    // Determine status code if available
    const statusCode = typeof (err as any).statusCode === 'number' ? (err as any).statusCode : 500;

    // 1. Extract structured compiler/build/syntax diagnostics if available
    const diagnostics = this.extractDiagnostics(err);

    // 2. Parse raw stack frames (to preserve real filesystem paths for snippet loading)
    const frames = this.parseStack(rawStack);

    // 3. Locate the primary error frame (prefer first application frame, else first available frame)
    let primaryFrame =
      frames.find((f) => f.isApp && f.file && f.line > 0) ||
      frames.find((f) => !f.isVendor && f.file && f.line > 0) ||
      frames.find((f) => f.file && f.line > 0);

    let primarySnippet: CodeSnippet | null = null;

    // If no stack frame was found, synthesize primary frame from the first diagnostic with location
    const primaryDiag = diagnostics.find((d) => d.location && d.location.file && d.location.line > 0);
    if (!primaryFrame && primaryDiag?.location) {
      primaryFrame = {
        raw: `${primaryDiag.name} at ${primaryDiag.location.file}:${primaryDiag.location.line}:${primaryDiag.location.column}`,
        functionName: '<compiler/syntax>',
        file: primaryDiag.location.file,
        displayPath: primaryDiag.location.displayPath,
        line: primaryDiag.location.line,
        column: primaryDiag.location.column,
        isApp: true,
        isFramework: false,
        isVendor: false,
        snippet: primaryDiag.snippet,
      };
      primarySnippet = primaryDiag.snippet ?? null;
    } else if (primaryFrame) {
      primarySnippet = this.getCodeSnippet(primaryFrame.file, primaryFrame.line, primaryFrame.column);
    }

    // Attach snippets to frames for interactive stack trace exploration
    for (const frame of frames) {
      if (frame.file && frame.line > 0 && !frame.isVendor) {
        frame.snippet = this.getCodeSnippet(frame.file, frame.line, frame.column);
      }
    }

    // 4. Extract cause chain
    const causes = this.extractCauses(err);

    // 5. Extract safe request context
    const requestDetails = this.extractRequestDetails(requestOrUrl, forgeReq);

    // 6. Extract environment context with authoritative appDebug
    const appDebug = env.boolean('APP_DEBUG', false);
    const environment: EnvironmentDetails = {
      runtime: typeof Bun !== 'undefined' ? `Bun ${Bun.version}` : `Node ${process.version}`,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      appDebug,
      timezone: this.getTimezoneName(),
    };

    return this.generateHtmlTemplate({
      name,
      message,
      statusCode,
      primaryFrame,
      primarySnippet,
      frames,
      causes,
      request: requestDetails,
      environment,
      diagnostics,
    });
  }

  /**
   * Render a simple, clean production HTML error page when APP_DEBUG=false.
   * Contains zero stack traces, source code, filesystem paths, or credentials.
   */
  static renderProductionHtml(
    statusCode = 500,
    message = 'Something went wrong',
  ): string {
    const is404 = statusCode === 404;
    const is503 = statusCode === 503;

    const title = is404
      ? '404 | Page Not Found'
      : is503
        ? '503 | Service Temporarily Unavailable'
        : `${statusCode} | Internal Server Error`;

    const heading = is404
      ? 'Page Not Found'
      : is503
        ? 'Service Temporarily Unavailable'
        : 'Something went wrong';

    const description = is404
      ? 'The page you are looking for does not exist or has been moved.'
      : is503
        ? 'The server is temporarily unable to service your request due to maintenance or connection limits. Please try again shortly.'
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
    <div class="status-code">${this.escapeHtml(String(statusCode))}</div>
    <h1 class="error-heading">${this.escapeHtml(heading)}</h1>
    <p class="error-desc">${this.escapeHtml(description)}</p>
    <a href="/" class="home-btn">Return Home</a>
  </div>
</body>
</html>`;
  }

  // ─── Diagnostic & Compiler Error Extraction ───

  /**
   * Derive a clean relative path for display if the file is inside the workspace.
   */
  static getDisplayPath(filePath: string): string {
    if (!filePath) return '';
    const cwd = process.cwd();
    let clean = filePath;
    if (clean.startsWith('file://')) {
      clean = clean.slice(7);
    }
    return clean.startsWith(cwd) ? clean.slice(cwd.length + 1) : clean;
  }

  /**
   * Normalize and extract compiler, build, and syntax error diagnostics.
   * Handles Bun BuildMessage, Bun AggregateError, Vite/Rollup/Oxc errors, and generic errors.
   */
  static extractDiagnostics(error: unknown): NormalizedDiagnostic[] {
    if (!error) return [];
    const list: NormalizedDiagnostic[] = [];
    const err = error as any;

    // Check if error is AggregateError or has child errors array
    const childErrors: any[] = Array.isArray(err.errors) && err.errors.length > 0
      ? err.errors
      : [err];

    // Check if parent message mentions file (e.g. `2 errors building "/path/to/file.ts"`)
    const parentFileMatch = typeof err.message === 'string'
      ? err.message.match(/(?:errors?\s+building|in|at)\s+["']?([^"'\s\n]+\.[a-zA-Z0-9]+)["']?/i)
      : null;
    const fallbackFile = parentFileMatch ? parentFileMatch[1] : undefined;

    for (const item of childErrors) {
      if (!item) continue;
      const name = item.name || (item.constructor ? item.constructor.name : 'Error');
      const rawMsg = item.message || String(item);
      const message = this.redactSecrets(rawMsg);

      let file: string | undefined =
        item.position?.file ||
        item.loc?.file ||
        item.file ||
        (typeof item.id === 'string' && !item.id.includes('\0') ? item.id : undefined) ||
        fallbackFile;

      let line: number | undefined =
        item.position?.line ??
        item.loc?.line ??
        (typeof item.line === 'number' && item.line > 0 ? item.line : undefined);

      let column: number | undefined =
        item.position?.column ??
        item.loc?.column ??
        (typeof item.column === 'number' && item.column > 0 ? item.column : undefined);

      let lineText: string | undefined = item.position?.lineText || item.frame;

      // Match in message if file or line is missing
      if (!file || line === undefined) {
        const match = rawMsg.match(/([^\s:()]+):(\d+):(\d+)/);
        if (match) {
          file = file || match[1];
          line = line ?? parseInt(match[2], 10);
          column = column ?? parseInt(match[3], 10);
        }
      }

      if (file && file.startsWith('file://')) {
        file = file.slice(7);
      }

      let location: DiagnosticLocation | undefined;
      let snippet: CodeSnippet | null = null;

      if (file && line !== undefined && line > 0) {
        location = {
          file,
          displayPath: this.getDisplayPath(file),
          line,
          column: column && column > 0 ? column : 1,
          lineText,
        };
        snippet = this.getCodeSnippet(file, line, location.column);
      } else if (file && lineText) {
        location = {
          file,
          displayPath: this.getDisplayPath(file),
          line: 1,
          column: column && column > 0 ? column : 1,
          lineText,
        };
      }

      list.push({
        name,
        message,
        location,
        snippet,
        stack: item.stack ? this.redactSecrets(item.stack) : undefined,
      });
    }

    return list;
  }

  /**
   * Helper to render code snippet box HTML.
   */
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

  // ─── Stack Trace Parsing ───

  /**
   * Parse a raw stack trace string into structured, categorized frames.
   */
  static parseStack(rawStack: string): StackFrame[] {
    if (!rawStack) return [];

    const lines = rawStack.split('\n');
    const frames: StackFrame[] = [];
    const cwd = process.cwd();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || (!line.startsWith('at ') && !line.includes('@'))) continue;

      // Match common Bun / V8 / Node formats:
      // at fn (/path/file.ts:10:5)
      // at /path/file.ts:10:5
      // at async fn (/path/file.ts:10:5)
      // fn@/path/file.ts:10:5
      const v8Match =
        line.match(/^at\s+(?:async\s+)?(?:(.+?)\s+\((.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+))$/) ||
        line.match(/^at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/);

      const jscMatch = !v8Match ? line.match(/^(?:(.*?)@)?(.+?):(\d+):(\d+)$/) : null;

      let fnName = '<anonymous>';
      let filePath = '';
      let lineNum = 0;
      let colNum = 0;

      if (v8Match) {
        if (v8Match[2]) {
          fnName = v8Match[1] || '<anonymous>';
          filePath = v8Match[2];
          lineNum = parseInt(v8Match[3], 10) || 0;
          colNum = parseInt(v8Match[4], 10) || 0;
        } else if (v8Match[5]) {
          fnName = '<anonymous>';
          filePath = v8Match[5];
          lineNum = parseInt(v8Match[6], 10) || 0;
          colNum = parseInt(v8Match[7], 10) || 0;
        }
      } else if (jscMatch) {
        fnName = jscMatch[1] || '<anonymous>';
        filePath = jscMatch[2];
        lineNum = parseInt(jscMatch[3], 10) || 0;
        colNum = parseInt(jscMatch[4], 10) || 0;
      } else {
        // Fallback for native or unparsed lines
        frames.push({
          raw: line,
          functionName: line.replace(/^at\s+/, ''),
          file: '',
          displayPath: '',
          line: 0,
          column: 0,
          isApp: false,
          isFramework: false,
          isVendor: true,
        });
        continue;
      }

      // Clean file path (strip file:// prefix if present)
      if (filePath.startsWith('file://')) {
        filePath = filePath.slice(7);
      }

      const isVendor =
        filePath.includes('node_modules') ||
        filePath.includes('bun:') ||
        filePath.includes('node:') ||
        filePath.includes('(native)');

      const isFramework =
        !isVendor &&
        (filePath.includes('/packages/forge/') ||
          filePath.includes('packages/forge') ||
          filePath.includes('@forge/'));

      const isApp = !isVendor && !isFramework && filePath.length > 0;

      const displayPath = filePath.startsWith(cwd)
        ? filePath.slice(cwd.length + 1)
        : filePath;

      frames.push({
        raw: line,
        functionName: fnName.trim(),
        file: filePath,
        displayPath,
        line: lineNum,
        column: colNum,
        isApp,
        isFramework,
        isVendor,
      });
    }

    return frames;
  }

  // ─── Source Code Snippet Extraction ───

  /**
   * Safely load source code surrounding an error line.
   * Guarantees:
   * - Never crashes on unreadable, missing, or binary files.
   * - Prevents path traversal and never reads sensitive .env files.
   */
  static getCodeSnippet(
    filePath: string,
    errorLine: number,
    errorCol = 0,
    contextLines = 5,
  ): CodeSnippet | null {
    if (!filePath || errorLine <= 0) return null;

    try {
      const resolved = resolve(filePath);

      // Security check: Block access to .env and secret configuration files
      const baseName = resolved.split(/[\/\\]/).pop() || '';
      if (baseName === '.env' || baseName.startsWith('.env.') || baseName.endsWith('.pem')) {
        return null;
      }

      if (!existsSync(resolved)) {
        return null;
      }

      const content = readFileSync(resolved, 'utf-8');
      const lines = content.split('\n');

      const start = Math.max(0, errorLine - 1 - contextLines);
      const end = Math.min(lines.length, errorLine + contextLines);

      const snippetLines: Array<{ lineNum: number; code: string; isErrorLine: boolean }> = [];

      for (let i = start; i < end; i++) {
        const lineNum = i + 1;
        snippetLines.push({
          lineNum,
          code: lines[i] ?? '',
          isErrorLine: lineNum === errorLine,
        });
      }

      const cwd = process.cwd();
      const displayPath = resolved.startsWith(cwd)
        ? resolved.slice(cwd.length + 1)
        : resolved;

      return {
        file: resolved,
        displayPath,
        line: errorLine,
        column: errorCol,
        lines: snippetLines,
      };
    } catch {
      return null;
    }
  }

  // ─── Exception Cause Extraction ───

  /**
   * Extract nested cause errors (e.g. err.cause) safely without circular loop hazards.
   */
  static extractCauses(error: Error, maxDepth = 5): ExceptionCause[] {
    const causes: ExceptionCause[] = [];
    const seen = new Set<unknown>([error]);

    let current: any = error;
    let depth = 0;

    while (current && current.cause && depth < maxDepth) {
      current = current.cause;
      if (seen.has(current)) break; // Circular reference detected
      seen.add(current);
      depth++;

      const causeName = current?.name || 'Error';
      const causeMsg = current?.message || String(current);
      const causeStack = current?.stack ? current.stack.split('\n').map((l: string) => l.trim()) : [];

      causes.push({
        name: causeName,
        message: this.redactSecrets(causeMsg),
        stackLines: causeStack,
      });
    }

    return causes;
  }

  // ─── Request Context & Sanitization ───

  /**
   * Extract and sanitize request details for safe developer inspection.
   */
  static extractRequestDetails(requestOrUrl?: unknown, forgeReq?: unknown): RequestDetails {
    let method = 'GET';
    let url = '/';
    let path = '/';
    let contentType = 'text/html';
    let queryParams: Record<string, string | string[]> = {};
    let routeParams: Record<string, string> = {};
    let rawHeaders: Record<string, string> = {};
    let rawBody: unknown = undefined;

    try {
      // 1. Check if forgeReq is available
      if (forgeReq && typeof forgeReq === 'object') {
        const fReq = forgeReq as any;
        method = fReq.method ?? method;
        path = fReq.path ?? path;
        url = fReq.fullUrl ?? path;
        routeParams = fReq.params ? { ...fReq.params } : {};
        queryParams = fReq.query ? { ...fReq.query } : {};
        rawHeaders = fReq.headers ? { ...fReq.headers } : {};
        rawBody = typeof fReq.body === 'function' ? fReq.body() : fReq._body;
      }

      // 2. Check if requestOrUrl is a globalThis.Request
      if (requestOrUrl && typeof requestOrUrl === 'object' && 'headers' in (requestOrUrl as any)) {
        const gReq = requestOrUrl as globalThis.Request;
        method = gReq.method || method;
        url = gReq.url || url;
        try {
          const parsed = new URL(url, 'http://localhost');
          path = parsed.pathname;
          if (Object.keys(queryParams).length === 0) {
            parsed.searchParams.forEach((v, k) => {
              queryParams[k] = v;
            });
          }
        } catch {}

        if (Object.keys(rawHeaders).length === 0 && gReq.headers) {
          gReq.headers.forEach((v, k) => {
            rawHeaders[k] = v;
          });
        }
      } else if (typeof requestOrUrl === 'string') {
        url = requestOrUrl;
        try {
          path = new URL(url, 'http://localhost').pathname;
        } catch {
          path = url;
        }
      }

      contentType = rawHeaders['content-type'] ?? '';
    } catch {
      // Fallback cleanly if parsing fails
    }

    return {
      method,
      url: this.redactSecrets(url),
      path: this.redactSecrets(path),
      queryParams: this.sanitizeObject(queryParams),
      routeParams: this.sanitizeObject(routeParams),
      headers: this.sanitizeHeaders(rawHeaders),
      body: this.sanitizeBody(rawBody),
      contentType,
      timestamp: this.formatTimestamp(),
    };
  }

  /**
   * Sanitize request headers by redacting sensitive authentication, cookie, and key headers.
   */
  static sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    const sensitiveHeaderPattern =
      /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|token|access-token|refresh-token|x-csrf-token|x-xsrf-token|csrf-token|secret|password|auth)$/i;

    for (const [key, val] of Object.entries(headers)) {
      if (sensitiveHeaderPattern.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.redactSecrets(String(val));
      }
    }

    return sanitized;
  }

  /**
   * Sanitize request body, recursively redacting credential and password fields.
   */
  static sanitizeBody(body: unknown, depth = 0, seen = new WeakSet()): unknown {
    if (body === undefined || body === null) return undefined;
    if (depth > 6) return '[Truncated]';

    if (typeof body === 'string') {
      return this.redactSecrets(body);
    }

    if (typeof body === 'number' || typeof body === 'boolean') {
      return body;
    }

    if (typeof body === 'object') {
      if (seen.has(body as object)) return '[Circular]';
      seen.add(body as object);

      if (Array.isArray(body)) {
        return body.map((item) => this.sanitizeBody(item, depth + 1, seen));
      }

      // Check for buffer/stream/binary objects
      if (
        (body as any).constructor?.name === 'Buffer' ||
        (body as any).constructor?.name === 'Uint8Array' ||
        (body as any).constructor?.name === 'ReadableStream'
      ) {
        return '[Binary Data]';
      }

      const sanitized: Record<string, unknown> = {};
      const sensitiveKeyPattern =
        /^(password|password_confirmation|secret|token|access_token|refresh_token|api_key|authorization|credit_card|card_number|cvv|key|auth|credential)$/i;

      for (const [key, val] of Object.entries(body)) {
        if (sensitiveKeyPattern.test(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeBody(val, depth + 1, seen);
        }
      }

      return sanitized;
    }

    return String(body);
  }

  private static sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        res[k] = this.redactSecrets(v);
      } else if (Array.isArray(v)) {
        res[k] = v.map((item) => (typeof item === 'string' ? this.redactSecrets(item) : item));
      } else {
        res[k] = v;
      }
    }
    return res;
  }

  // ─── Secret Redaction ───

  /**
   * Scan text and redact process environment secret values.
   */
  static redactSecrets(text: string): string {
    if (!text) return text;
    let result = text;

    const safeWhitelist = new Set([
      'true', 'false', 'development', 'production', 'test', '3000', '3306',
      'localhost', '127.0.0.1', 'sqlite', 'mysql', 'ForgeTS', 'en', 'UTC'
    ]);

    for (const [key, val] of Object.entries(process.env)) {
      if (!val || typeof val !== 'string' || val.trim().length < 4) continue;
      const trimmedVal = val.trim();
      if (safeWhitelist.has(trimmedVal)) continue;

      const isSystemVar =
        /^(HOME|PWD|PATH|SHELL|USER|LOGNAME|TERM|SHLVL|_|OLDPWD|EDITOR|VISUAL|BROWSER|LANG|COLORTERM|TZ)$/i.test(key) ||
        key.startsWith('XDG_') ||
        key.startsWith('BUN_');

      if (isSystemVar) continue;

      const isSecretKey =
        /SECRET|PASS|KEY|TOKEN|DB|AUTH|CREDENTIAL|PRIVATE|CERT/i.test(key);

      if (isSecretKey && trimmedVal.length >= 4) {
        if (result.includes(trimmedVal)) {
          result = result.replaceAll(trimmedVal, '[REDACTED]');
        }
      }
    }

    return result;
  }

  // ─── HTML Template Generator ───

  private static generateHtmlTemplate(data: {
    name: string;
    message: string;
    statusCode: number;
    primaryFrame?: StackFrame;
    primarySnippet?: CodeSnippet | null;
    frames: StackFrame[];
    causes: ExceptionCause[];
    request: RequestDetails;
    environment: EnvironmentDetails;
    diagnostics?: NormalizedDiagnostic[];
  }): string {
    const { name, message, statusCode, primaryFrame, primarySnippet, frames, causes, request, environment, diagnostics } = data;

    // Build Code Snippet HTML
    const snippetHtml = this.renderSnippetHtml(primarySnippet);

    // Build Stack Trace Frames HTML
    let framesHtml = '';
    frames.forEach((frame, idx) => {
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

    // Build Causes HTML
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
                  <span class="cause-type">${this.escapeHtml(cause.name)}</span>
                </div>
                <div class="cause-message">${this.escapeHtml(cause.message)}</div>
                ${
                  cause.stackLines.length > 0
                    ? `<div class="cause-stack">${this.escapeHtml(cause.stackLines.slice(0, 5).join('\n'))}</div>`
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

    // Build Request Tables
    const hasQueryParams = Object.keys(request.queryParams).length > 0;
    const hasRouteParams = Object.keys(request.routeParams).length > 0;
    const hasBody = request.body !== undefined && request.body !== null;
    const hasHeaders = Object.keys(request.headers).length > 0;

    const queryTable = hasQueryParams ? this.renderKeyValueTable(request.queryParams) : '<p class="empty-hint">No query parameters</p>';
    const routeTable = hasRouteParams ? this.renderKeyValueTable(request.routeParams) : '<p class="empty-hint">No route parameters</p>';
    const headersTable = hasHeaders ? this.renderKeyValueTable(request.headers) : '<p class="empty-hint">No headers provided</p>';

    let bodyDisplay = '<p class="empty-hint">Empty body</p>';
    if (hasBody) {
      bodyDisplay = `<pre class="json-box">${this.escapeHtml(JSON.stringify(request.body, null, 2))}</pre>`;
    }

    const appFrameCount = frames.filter((f) => f.isApp).length;
    const totalFrameCount = frames.length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(name)}: ${this.escapeHtml(message)} — ForgeTS Debug</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(15, 23, 42, 0.85);
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
    .multi-error-bar {
      background: var(--card-bg);
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 0.75rem;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .multi-error-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .multi-error-badge {
      background: rgba(239, 68, 68, 0.25);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.5);
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .multi-error-sub {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    .diagnostic-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .diag-btn {
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 0.45rem 0.8rem;
      border-radius: 0.5rem;
      font-size: 0.82rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.15s ease;
    }
    .diag-btn:hover {
      border-color: #ef4444;
      color: #ffffff;
    }
    .diag-btn.active {
      background: rgba(239, 68, 68, 0.15);
      border-color: #ef4444;
      color: #ffffff;
      font-weight: 600;
    }
    .diag-idx {
      background: rgba(255, 255, 255, 0.1);
      padding: 0.1rem 0.35rem;
      border-radius: 0.25rem;
      font-size: 0.7rem;
    }
    .diag-loc {
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
    }
    .diagnostic-panel.hidden {
      display: none !important;
    }
    .error-type {
      color: #f87171;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.95rem;
      font-weight: 700;
      margin-bottom: 0.6rem;
      letter-spacing: 0.02em;
    }
    .error-message {
      font-size: 1.85rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
      margin-bottom: 1.25rem;
      word-break: break-word;
    }
    .error-location {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'JetBrains Mono', monospace;
      color: #cbd5e1;
      font-size: 0.85rem;
      background: rgba(0, 0, 0, 0.4);
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border-left: 3px solid #ef4444;
      word-break: break-all;
    }
    .snippet-box {
      margin-top: 1.5rem;
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
    }
    .snippet-header {
      background: rgba(255, 255, 255, 0.03);
      padding: 0.7rem 1.2rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      color: #94a3b8;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .snippet-path { color: #f8fafc; font-weight: 600; }
    .snippet-pos { color: #f87171; }
    .snippet-body {
      padding: 1rem 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.88rem;
      line-height: 1.65;
      overflow-x: auto;
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
    .code-line.caret-line {
      background: rgba(239, 68, 68, 0.08);
      border-left: 3px solid transparent;
    }
    .caret-marker {
      color: #f87171;
      font-weight: 800;
    }
    .line-num {
      color: #475569;
      width: 4rem;
      user-select: none;
      flex-shrink: 0;
    }
    .line-code {
      color: #e2e8f0;
      white-space: pre;
    }

    /* Tabs Layout */
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
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
    }
    .tab-btn:hover { color: #f8fafc; }
    .tab-btn.active {
      color: #818cf8;
      border-bottom-color: #818cf8;
    }
    .tab-count {
      background: rgba(255, 255, 255, 0.08);
      padding: 0.1rem 0.4rem;
      border-radius: 9999px;
      font-size: 0.75rem;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }

    /* Stack Trace List */
    .stack-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .stack-frame-item {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.6rem;
      padding: 0.8rem 1rem;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
    }
    .stack-frame-item:hover {
      border-color: rgba(255, 255, 255, 0.2);
      background: rgba(30, 41, 59, 0.9);
    }
    .stack-frame-item.app-frame {
      border-left: 3px solid #818cf8;
      background: rgba(15, 23, 42, 0.95);
    }
    .frame-main {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .frame-badge {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 0.25rem;
      letter-spacing: 0.05em;
    }
    .badge-app { background: rgba(99, 102, 241, 0.25); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.4); }
    .badge-framework { background: rgba(168, 85, 247, 0.2); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.3); }
    .badge-vendor { background: rgba(148, 163, 184, 0.1); color: #64748b; }
    .frame-fn { color: #f8fafc; font-weight: 600; }
    .frame-file { color: #94a3b8; font-size: 0.78rem; word-break: break-all; }
    .frame-snippet {
      margin-top: 0.75rem;
      border-top: 1px solid var(--card-border);
      padding-top: 0.75rem;
    }

    /* Causes Section */
    .causes-section {
      margin-bottom: 2rem;
    }
    .cause-card {
      background: rgba(239, 68, 68, 0.05);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 0.75rem;
      padding: 1.25rem;
      margin-bottom: 0.75rem;
    }
    .cause-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.4rem;
    }
    .cause-arrow { color: #fca5a5; font-size: 0.85rem; font-weight: 600; }
    .cause-type { color: #ef4444; font-family: 'JetBrains Mono', monospace; font-weight: 700; }
    .cause-message { color: #f8fafc; font-size: 1.05rem; font-weight: 600; margin-bottom: 0.5rem; }
    .cause-stack { font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: #94a3b8; white-space: pre-wrap; }

    /* Tables & Preformatted Boxes */
    .data-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .section-title {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .key-val-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
    }
    .key-val-table tr {
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .key-val-table tr:last-child { border-bottom: none; }
    .key-val-table td {
      padding: 0.6rem 0.8rem;
      vertical-align: top;
    }
    .key-col {
      color: #94a3b8;
      width: 250px;
      font-weight: 500;
    }
    .val-col {
      color: #f1f5f9;
      word-break: break-all;
    }
    .json-box {
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.5rem;
      padding: 1rem;
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
    }
    .empty-hint {
      color: #64748b;
      font-size: 0.85rem;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge-bar">
      <div class="brand"><span>Forge</span>TS Debug Engine</div>
      <div class="badge-group">
        <span class="status-pill">${statusCode} ${this.getStatusText(statusCode)}</span>
        <span class="env-pill">APP_DEBUG = ${environment.appDebug ? 'TRUE' : 'FALSE'}</span>
      </div>
    </div>

    ${
      diagnostics && diagnostics.length > 1
        ? `
    <div class="multi-error-bar">
      <div class="multi-error-header">
        <span class="multi-error-badge">${diagnostics.length} Build Errors</span>
        <span class="multi-error-sub">Multiple compilation/syntax errors were reported. Select an error to inspect:</span>
      </div>
      <div class="diagnostic-nav">
        ${diagnostics
          .map(
            (d, i) => `
          <button class="diag-btn ${i === 0 ? 'active' : ''}" onclick="selectDiagnostic(${i})">
            <span class="diag-idx">#${i + 1}</span>
            <span class="diag-name">${this.escapeHtml(d.name)}</span>
            <span class="diag-loc">${d.location ? this.escapeHtml(d.location.displayPath) + ':' + d.location.line : ''}</span>
          </button>
        `,
          )
          .join('')}
      </div>
    </div>

    <div class="diagnostics-container">
      ${diagnostics
        .map(
          (d, i) => `
        <div id="diag-panel-${i}" class="hero-card diagnostic-panel ${i === 0 ? 'active' : 'hidden'}">
          <div class="error-type">${this.escapeHtml(d.name)}</div>
          <div class="error-message">${this.escapeHtml(d.message)}</div>
          ${
            d.location
              ? `<div class="error-location">${this.escapeHtml(d.location.displayPath)}:${d.location.line}:${d.location.column}</div>`
              : ''
          }
          ${this.renderSnippetHtml(d.snippet)}
        </div>
      `,
        )
        .join('')}
    </div>
    `
        : `
    <div class="hero-card">
      <div class="error-type">${this.escapeHtml(name)}</div>
      <div class="error-message">${this.escapeHtml(message)}</div>
      ${
        primaryFrame && primaryFrame.file
          ? `<div class="error-location">${this.escapeHtml(primaryFrame.displayPath)}:${primaryFrame.line}:${primaryFrame.column}</div>`
          : ''
      }
      ${snippetHtml}
    </div>
    `
    }

    ${causesHtml}

    <nav class="tabs-nav">
      <button class="tab-btn active" onclick="switchTab('tab-stack')">
        Stack Trace <span class="tab-count">${appFrameCount} app / ${totalFrameCount}</span>
      </button>
      <button class="tab-btn" onclick="switchTab('tab-request')">
        Request &amp; Body
      </button>
      <button class="tab-btn" onclick="switchTab('tab-headers')">
        Headers
      </button>
      <button class="tab-btn" onclick="switchTab('tab-env')">
        Environment
      </button>
    </nav>

    <!-- TAB 1: Stack Trace -->
    <div id="tab-stack" class="tab-content active">
      <div class="section-title">Stack Trace (${totalFrameCount} frames)</div>
      <div class="stack-list">
        ${framesHtml}
      </div>
    </div>

    <!-- TAB 2: Request & Body -->
    <div id="tab-request" class="tab-content">
      <div class="data-card">
        <div class="section-title">Request Overview</div>
        <table class="key-val-table">
          <tr><td class="key-col">Method</td><td class="val-col"><strong>${this.escapeHtml(request.method)}</strong></td></tr>
          <tr><td class="key-col">URL</td><td class="val-col">${this.escapeHtml(request.url)}</td></tr>
          <tr><td class="key-col">Path</td><td class="val-col">${this.escapeHtml(request.path)}</td></tr>
          <tr><td class="key-col">Content-Type</td><td class="val-col">${this.escapeHtml(request.contentType || 'none')}</td></tr>
          <tr><td class="key-col">Timestamp</td><td class="val-col">${this.escapeHtml(request.timestamp)}</td></tr>
        </table>
      </div>

      <div class="data-card">
        <div class="section-title">Route Parameters</div>
        ${routeTable}
      </div>

      <div class="data-card">
        <div class="section-title">Query Parameters</div>
        ${queryTable}
      </div>

      <div class="data-card">
        <div class="section-title">Request Body (Sanitized)</div>
        ${bodyDisplay}
      </div>
    </div>

    <!-- TAB 3: Headers -->
    <div id="tab-headers" class="tab-content">
      <div class="data-card">
        <div class="section-title">Request Headers (${Object.keys(request.headers).length})</div>
        ${headersTable}
      </div>
    </div>

    <!-- TAB 4: Environment -->
    <div id="tab-env" class="tab-content">
      <div class="data-card">
        <div class="section-title">Application &amp; Runtime Environment</div>
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

  private static renderKeyValueTable(data: Record<string, any>): string {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return '<p class="empty-hint">None</p>';
    }

    let rows = '';
    for (const [key, val] of Object.entries(data)) {
      const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
      rows += `<tr><td class="key-col">${this.escapeHtml(key)}</td><td class="val-col">${this.escapeHtml(valStr)}</td></tr>`;
    }

    return `<table class="key-val-table">${rows}</table>`;
  }

  private static renderEmergencyFallbackHtml(originalError: unknown, renderError: unknown): string {
    const origMsg = this.escapeHtml(String((originalError as any)?.message ?? originalError));
    const renderMsg = this.escapeHtml(String((renderError as any)?.message ?? renderError));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ForgeTS Error Handler Fallback</title>
  <style>
    body { background: #090d16; color: #f8fafc; font-family: system-ui, sans-serif; padding: 2rem; }
    .card { background: #0f172a; border: 1px solid #ef4444; border-radius: 8px; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { color: #f87171; font-size: 1.5rem; margin-bottom: 1rem; }
    pre { background: #020617; padding: 1rem; border-radius: 4px; overflow-x: auto; color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>ForgeTS Error Handler Fallback</h1>
    <p>An error occurred, and the debug display engine encountered an issue while formatting it.</p>
    <h3>Original Error:</h3>
    <pre>${origMsg}</pre>
    <h3>Renderer Error:</h3>
    <pre>${renderMsg}</pre>
  </div>
</body>
</html>`;
  }

  private static getStatusText(code: number): string {
    switch (code) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 405: return 'Method Not Allowed';
      case 419: return 'Page Expired';
      case 422: return 'Unprocessable Content';
      case 429: return 'Too Many Requests';
      case 500: return 'Internal Server Error';
      case 503: return 'Service Unavailable';
      default: return 'Error';
    }
  }

  private static getTimezoneName(): string {
    try {
      const { getConfigManager } = require('../config/ConfigManager.js');
      const cfg = getConfigManager();
      if (cfg) {
        return cfg.get('app.timezone', 'UTC');
      }
    } catch {}
    return process.env.APP_TIMEZONE ?? process.env.TZ ?? 'UTC';
  }

  private static formatTimestamp(): string {
    const tz = this.getTimezoneName();
    const ianaTz = tz;

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

  static escapeHtml(str: unknown): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
