// packages/forge/src/errors/renderers/JsonErrorRenderer.ts
// ─────────────────────────────────────────────────────────────────────
// Structured JSON error renderer for API requests.
// Guarantees deterministic format in development and secure zero-leak
// payloads in production with error ID correlation.
// ─────────────────────────────────────────────────────────────────────

import type { NormalizedError } from '../ErrorNormalizer.js';
import type { ErrorContext } from '../ContextCollector.js';
import { FallbackRenderer } from './FallbackRenderer.js';

export interface DevJsonErrorResponse {
  message: string;
  name: string;
  statusCode: number;
  error: string;
  errorDetail: {
    type: string;
    code: string;
    message: string;
    status: number;
    details?: unknown;
  };
  request: {
    id: string;
    method: string;
    path: string;
  };
  route: {
    pattern: string | null;
    controller: string | null;
    action: string | null;
    params: Record<string, string>;
    middleware: string[];
  };
  trace: {
    id: string;
    file: string | null;
    line: number | null;
    column: number | null;
    stack: string[];
  };
  causes: Array<{
    type: string;
    code?: string;
    message: string;
    stackLines: string[];
  }>;
  diagnostics?: Array<{
    name: string;
    message: string;
    file?: string;
    line?: number;
    column?: number;
  }>;
  stack: string[];
  errors?: unknown;
}

export type ProdJsonErrorResponse = Record<string, unknown>;

export class JsonErrorRenderer {
  /**
   * Render structured development JSON response payload.
   */
  static renderDebug(error: NormalizedError, context: ErrorContext): DevJsonErrorResponse {
    const stackLines = error.stack ? error.stack.split('\n').map((l) => l.trim()) : [];

    const primaryFile = error.primaryFrame ? error.primaryFrame.displayPath : null;
    const primaryLine = error.primaryFrame ? error.primaryFrame.line : null;
    const primaryColumn = error.primaryFrame ? error.primaryFrame.column : null;

    const response: DevJsonErrorResponse = {
      message: error.message,
      name: error.type,
      statusCode: error.statusCode,
      error: error.message,
      errorDetail: {
        type: error.type,
        code: error.code,
        message: error.message,
        status: error.statusCode,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      request: {
        id: context.errorId,
        method: context.request.method,
        path: context.request.path,
      },
      route: {
        pattern: context.route.pattern,
        controller: context.route.controller,
        action: context.route.action,
        params: context.route.params,
        middleware: context.route.middleware,
      },
      trace: {
        id: context.errorId,
        file: primaryFile,
        line: primaryLine,
        column: primaryColumn,
        stack: stackLines,
      },
      causes: error.causes.map((c) => ({
        type: c.type,
        code: c.code,
        message: c.message,
        stackLines: c.stackLines,
      })),
      stack: stackLines,
    };

    if (error.diagnostics && error.diagnostics.length > 0) {
      response.diagnostics = error.diagnostics.map((d) => ({
        name: d.name,
        message: d.message,
        file: d.location?.displayPath,
        line: d.location?.line,
        column: d.location?.column,
      }));
    }

    if (error.details !== undefined) {
      response.errors = error.details;
    }

    return response;
  }

  /**
   * Render secure, zero-leak production JSON response payload.
   */
  static renderProduction(error: NormalizedError, _context: ErrorContext): ProdJsonErrorResponse {
    if (error.statusCode === 500) {
      return { message: 'Internal Server Error' };
    }

    const isClientError = error.statusCode >= 400 && error.statusCode < 500;
    const isServiceUnavailable = error.statusCode === 503;

    let publicMessage = 'An error occurred';

    if (isClientError) {
      publicMessage = error.message;
    } else if (isServiceUnavailable) {
      publicMessage = error.message.includes('Database')
        ? 'Service Unavailable: Database connection failed.'
        : 'Service Unavailable';
    }

    const response: Record<string, unknown> = {
      error: publicMessage,
      message: publicMessage,
      statusCode: error.statusCode,
    };

    if (error.statusCode === 422 && error.details !== undefined) {
      response.errors = error.details;
    }

    return response;
  }
}
