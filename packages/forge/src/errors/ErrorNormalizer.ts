// packages/forge/src/errors/ErrorNormalizer.ts
// ─────────────────────────────────────────────────────────────────────
// Transforms raw JavaScript errors, primitives, or custom exceptions
// into a standardized, deterministic NormalizedError representation.
// ─────────────────────────────────────────────────────────────────────

import { ForgeError, ValidationError } from './ForgeError.js';
import { Redactor } from './Redactor.js';
import { SourceFrameReader, type StackFrame, type CodeSnippet } from './SourceFrameReader.js';
import { isValidHttpStatus, normalizeHttpStatus } from '../http/Response.js';

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

export interface NormalizedCause {
  type: string;
  code?: string;
  message: string;
  stackLines: string[];
  details?: unknown;
}

export interface NormalizedError {
  raw?: unknown;
  rawStack?: string;
  type: string;
  code: string;
  message: string;
  statusCode: number;
  stack: string;
  stackFrames: StackFrame[];
  primaryFrame?: StackFrame;
  primarySnippet?: CodeSnippet | null;
  causes: NormalizedCause[];
  diagnostics: NormalizedDiagnostic[];
  details?: unknown;
}

export interface NormalizeOptions {
  /**
   * Collect developer diagnostics: parsed stack frames, source snippets, cause
   * chain, and compiler diagnostics. Disable outside debug mode, where none of
   * it is rendered, to keep error responses cheap (no stack parsing, no file I/O).
   * Defaults to true.
   */
  diagnostics?: boolean;
}

const KNOWN_DATABASE_PORTS = new Set([3306, 33060, 27017, 5432]);

export class ErrorNormalizer {
  /**
   * Safely normalize any error or thrown value into a NormalizedError.
   * Guaranteed to NEVER throw an exception itself.
   */
  static normalize(error: unknown, options: NormalizeOptions = {}): NormalizedError {
    try {
      return this.doNormalize(error, options.diagnostics !== false);
    } catch (normalizationError) {
      // Fail-safe fallback if error object has hostile throwing getters
      let safeMsg = 'An unexpected error occurred';
      try {
        if (error && typeof error === 'object' && 'message' in error) {
          safeMsg = String((error as any).message);
        } else if (error !== null && error !== undefined) {
          safeMsg = String(error);
        }
      } catch {
        safeMsg = 'An unreadable error occurred';
      }

      return {
        type: 'Error',
        code: 'ERR_INTERNAL_SERVER_ERROR',
        message: Redactor.redactString(safeMsg),
        statusCode: 500,
        rawStack: '',
        stack: '',
        stackFrames: [],
        causes: [],
        diagnostics: [],
      };
    }
  }

  private static doNormalize(error: unknown, withDiagnostics: boolean): NormalizedError {
    // 1. Convert primitive or hostile throws to Error
    let err: Error;
    if (error instanceof Error) {
      err = error;
    } else if (typeof error === 'string') {
      err = new Error(error);
    } else if (error && typeof error === 'object') {
      const msg = typeof (error as any).message === 'string' ? (error as any).message : JSON.stringify(error);
      err = new Error(msg);
      if (typeof (error as any).name === 'string') {
        err.name = (error as any).name;
      }
      if (typeof (error as any).stack === 'string') {
        err.stack = (error as any).stack;
      }
    } else {
      err = new Error(String(error ?? 'Unknown error'));
    }

    // 2. Safe property reads (defensive against throwing getters)
    let type = 'Error';
    try {
      type = err.name || (err.constructor ? err.constructor.name : 'Error');
    } catch {
      type = 'Error';
    }

    let rawMessage = 'An unexpected error occurred';
    try {
      rawMessage = err.message || 'An unexpected error occurred';
    } catch {
      rawMessage = '[Unreadable message]';
    }
    let message = Redactor.redactString(rawMessage);

    let rawStack = '';
    try {
      rawStack = err.stack || '';
    } catch {
      rawStack = '';
    }

    // 3. Status code & error code resolution
    let statusCode = 500;
    let code = 'ERR_INTERNAL_SERVER_ERROR';

    if (error instanceof ForgeError) {
      statusCode = normalizeHttpStatus(error.statusCode, 500);
      code = error.code || `ERR_HTTP_${statusCode}`;
    } else if (error instanceof ValidationError) {
      statusCode = 422;
      code = 'ERR_VALIDATION_FAILED';
    } else {
      // Check database connection failures.
      // Generic socket errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND) are only treated
      // as a database outage when they demonstrably come from a database driver —
      // a failed call to some third-party HTTP API must not be reported as one.
      const errCode = (error as any)?.code;
      const errName = (error as any)?.name;
      const isSocketFailure =
        errCode === 'ECONNREFUSED' || errCode === 'ETIMEDOUT' || errCode === 'ENOTFOUND';
      const isDbConnectionFailure =
        errCode === 'ER_ACCESS_DENIED_ERROR' ||
        errCode === 'PROTOCOL_CONNECTION_LOST' ||
        errName === 'MongoNetworkError' ||
        errName === 'MongoServerSelectionError' ||
        rawMessage.includes('MongoConnectionFailure') ||
        rawMessage.includes('[ForgeTS Mongo Connection Failure]') ||
        rawMessage.includes('[ForgeTS Database Error]') ||
        (isSocketFailure && this.looksLikeDatabaseError(error, rawStack));

      if (isDbConnectionFailure) {
        statusCode = 503;
        code = 'ERR_DATABASE_CONNECTION';
        type = 'DatabaseConnectionException';
        const redactedMessage = message;
        message = `Service Unavailable: Database connection failed (${redactedMessage})`;
      } else {
        const rawStatus = (error as any)?.statusCode ?? (error as any)?.status;
        if (rawStatus !== undefined && isValidHttpStatus(rawStatus)) {
          statusCode = rawStatus;
        }
        code = this.deriveCode(statusCode, type, (error as any)?.code);
      }
    }

    // 8. Extract details if available (e.g. validation errors, query info)
    const rawDetails = (error as any)?.details ?? (error as any)?.errors ?? undefined;
    const details = rawDetails ? Redactor.sanitizeData(rawDetails) : undefined;

    if (!withDiagnostics) {
      return {
        raw: error,
        type,
        code,
        message,
        statusCode,
        rawStack,
        stack: Redactor.redactString(rawStack),
        stackFrames: [],
        causes: [],
        diagnostics: [],
        details,
      };
    }

    // 4. Extract compiler and build diagnostics (BuildMessage, AggregateError, Vite)
    const diagnostics = this.extractDiagnostics(err);

    // 5. Parse stack frames
    const stackFrames = SourceFrameReader.parseStack(rawStack);

    // 6. Determine primary frame & snippet
    let primaryFrame =
      stackFrames.find((f) => f.isApp && f.file && f.line > 0) ||
      stackFrames.find((f) => !f.isVendor && f.file && f.line > 0) ||
      stackFrames.find((f) => f.file && f.line > 0);

    let primarySnippet: CodeSnippet | null = null;

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
      };
    }

    if (primaryFrame && primaryFrame.file && primaryFrame.line > 0) {
      primarySnippet = SourceFrameReader.getCodeSnippet(
        primaryFrame.file,
        primaryFrame.line,
        primaryFrame.column,
      );
    }

    // Attach snippets to application & framework frames for interactive inspection
    for (const frame of stackFrames) {
      if (frame.file && frame.line > 0 && !frame.isVendor) {
        frame.snippet = SourceFrameReader.getCodeSnippet(frame.file, frame.line, frame.column);
      }
    }

    // 7. Extract nested cause chain safely
    const causes = this.extractCauses(err);

    return {
      raw: error,
      type,
      code,
      message,
      statusCode,
      rawStack,
      stack: Redactor.redactString(rawStack),
      stackFrames,
      primaryFrame,
      primarySnippet,
      causes,
      diagnostics,
      details,
    };
  }

  /**
   * Decide whether a socket-level failure originated from a database driver.
   */
  private static looksLikeDatabaseError(error: unknown, rawStack: string): boolean {
    const e = error as any;
    if (e?.fatal === true || e?.sqlState !== undefined || e?.sqlMessage !== undefined) return true;
    const port = Number(e?.port);
    if (Number.isInteger(port) && KNOWN_DATABASE_PORTS.has(port)) return true;
    return /mysql2?|mongodb|kysely|[\\/]pg[\\/]/i.test(rawStack);
  }

  private static deriveCode(statusCode: number, typeName: string, explicitCode?: string): string {
    if (explicitCode && typeof explicitCode === 'string' && explicitCode.startsWith('ERR_')) {
      return explicitCode;
    }

    switch (statusCode) {
      case 400: return 'ERR_BAD_REQUEST';
      case 401: return 'ERR_UNAUTHORIZED';
      case 403: return 'ERR_FORBIDDEN';
      case 404: return 'ERR_NOT_FOUND';
      case 405: return 'ERR_METHOD_NOT_ALLOWED';
      case 419: return 'ERR_PAGE_EXPIRED';
      case 422: return 'ERR_VALIDATION_FAILED';
      case 429: return 'ERR_TOO_MANY_REQUESTS';
      case 503: return 'ERR_SERVICE_UNAVAILABLE';
      case 500:
      default:
        if (typeName && typeName !== 'Error') {
          const snake = typeName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
          return `ERR_${snake}`;
        }
        return 'ERR_INTERNAL_SERVER_ERROR';
    }
  }

  /**
   * Safely extract nested causes (err.cause) with depth limiting and circular protection.
   */
  static extractCauses(error: unknown, maxDepth = 10): NormalizedCause[] {
    const causes: NormalizedCause[] = [];
    const seen = new Set<unknown>();

    let current: any = error;
    let depth = 0;

    while (current && depth < maxDepth) {
      // Detect circular reference before reading
      if (seen.has(current)) break;
      seen.add(current);

      let nextCause: unknown = undefined;
      try {
        nextCause = current.cause;
      } catch {
        break;
      }

      if (nextCause === undefined || nextCause === null) break;
      if (seen.has(nextCause)) break;

      current = nextCause;
      depth++;

      let causeType = 'Error';
      let causeMsg = '';
      let causeStack: string[] = [];
      let details: unknown = undefined;
      let code: string | undefined = undefined;

      try {
        if (current instanceof Error) {
          causeType = current.name || (current.constructor ? current.constructor.name : 'Error');
          causeMsg = current.message || '';
          causeStack = current.stack ? current.stack.split('\n').map((l) => l.trim()) : [];
          details = (current as any).details;
          code = (current as any).code;
        } else if (typeof current === 'object') {
          causeType = (current as any).name || (current as any).type || 'Error';
          causeMsg = typeof (current as any).message === 'string' ? (current as any).message : JSON.stringify(current);
          code = (current as any).code;
          details = (current as any).details;
        } else {
          causeType = typeof current;
          causeMsg = String(current);
        }
      } catch {
        causeType = 'Error';
        causeMsg = '[Unreadable Cause]';
      }

      causes.push({
        type: causeType,
        code,
        message: Redactor.redactString(causeMsg),
        stackLines: causeStack.map((s) => Redactor.redactString(s)),
        details: details ? Redactor.sanitizeData(details) : undefined,
      });
    }

    return causes;
  }

  /**
   * Normalize and extract compiler, build, and syntax error diagnostics.
   * Handles Bun BuildMessage, Bun AggregateError, Vite/Rollup/Oxc errors, and generic errors.
   */
  static extractDiagnostics(error: unknown): NormalizedDiagnostic[] {
    if (!error) return [];
    const list: NormalizedDiagnostic[] = [];
    const err = error as any;

    try {
      const childErrors: any[] = Array.isArray(err.errors) && err.errors.length > 0
        ? err.errors
        : [err];

      const parentFileMatch = typeof err.message === 'string'
        ? err.message.match(/(?:errors?\s+building|in|at)\s+["']?([^"'\s\n]+\.[a-zA-Z0-9]+)["']?/i)
        : null;
      const fallbackFile = parentFileMatch ? parentFileMatch[1] : undefined;

      for (const item of childErrors) {
        if (!item) continue;
        const name = item.name || (item.constructor ? item.constructor.name : 'Error');
        const rawMsg = item.message || String(item);
        const message = Redactor.redactString(rawMsg);

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
            displayPath: SourceFrameReader.getDisplayPath(file),
            line,
            column: column && column > 0 ? column : 1,
            lineText,
          };
          snippet = SourceFrameReader.getCodeSnippet(file, line, location.column);
        } else if (file && lineText) {
          location = {
            file,
            displayPath: SourceFrameReader.getDisplayPath(file),
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
          stack: item.stack ? Redactor.redactString(item.stack) : undefined,
        });
      }
    } catch {
      // Non-fatal if diagnostics parsing fails
    }

    return list;
  }
}
