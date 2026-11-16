// packages/forge/src/http/ErrorDisplayEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Developer Exception & Error Display Engine (Ignition style).
// Public facade that delegates to the modular @forge/core error subsystem
// (ErrorNormalizer, Redactor, SourceFrameReader, ContextCollector, HtmlErrorRenderer).
// ─────────────────────────────────────────────────────────────────────

import {
  ErrorNormalizer,
  type NormalizedDiagnostic,
  type DiagnosticLocation,
} from '../errors/ErrorNormalizer.js';
import {
  SourceFrameReader,
  type StackFrame,
  type CodeSnippet,
} from '../errors/SourceFrameReader.js';
import {
  ContextCollector,
  type RequestContext,
  type EnvironmentContext,
} from '../errors/ContextCollector.js';
import { Redactor } from '../errors/Redactor.js';
import { HtmlErrorRenderer } from '../errors/renderers/HtmlErrorRenderer.js';
import { JsonErrorRenderer } from '../errors/renderers/JsonErrorRenderer.js';
import { FallbackRenderer } from '../errors/renderers/FallbackRenderer.js';
import type { Request } from './Request.js';

export type {
  DiagnosticLocation,
  NormalizedDiagnostic,
  StackFrame,
  CodeSnippet,
};

export type ExceptionCause = {
  name: string;
  message: string;
  stackLines: string[];
};

export type RequestDetails = RequestContext;
export type EnvironmentDetails = EnvironmentContext;

export class ErrorDisplayEngine {
  /**
   * Coerce the loosely-typed (request | url, forgeRequest) arguments accepted by
   * the public render methods into sanitized error context.
   */
  private static collectContext(requestOrUrl?: unknown, forgeReq?: unknown) {
    let rawReq: globalThis.Request | undefined;
    let fReq: Request | undefined;

    if (requestOrUrl && typeof requestOrUrl === 'object' && 'headers' in (requestOrUrl as any)) {
      rawReq = requestOrUrl as globalThis.Request;
    } else if (typeof requestOrUrl === 'string') {
      try {
        rawReq = new globalThis.Request(new URL(requestOrUrl, 'http://localhost'));
      } catch {}
    }

    if (forgeReq && typeof forgeReq === 'object' && 'headers' in (forgeReq as any)) {
      fReq = forgeReq as Request;
    }

    return ContextCollector.collect(rawReq, fReq);
  }

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
      const normalized = ErrorNormalizer.normalize(error);
      const context = this.collectContext(requestOrUrl, forgeReq);
      return HtmlErrorRenderer.renderDebug(normalized, context);
    } catch (renderError) {
      return FallbackRenderer.renderHtml(error, renderError);
    }
  }

  /**
   * Render a simple, clean production HTML error page when APP_DEBUG=false.
   * Contains zero stack traces, source code, filesystem paths, or credentials.
   */
  static renderProductionHtml(
    statusCode = 500,
    message = 'Something went wrong',
    errorId?: string,
  ): string {
    return HtmlErrorRenderer.renderProduction(statusCode, message, errorId);
  }

  /**
   * Render structured JSON error payload for API requests when APP_DEBUG=true.
   */
  static renderJson(error: unknown, requestOrUrl?: unknown, forgeReq?: unknown): unknown {
    try {
      const normalized = ErrorNormalizer.normalize(error);
      const context = this.collectContext(requestOrUrl, forgeReq);
      return JsonErrorRenderer.renderDebug(normalized, context);
    } catch {
      let message = 'Internal Server Error';
      try {
        message = Redactor.redactString(error instanceof Error ? error.message : String(error));
      } catch {}
      return { error: 'Internal Server Error', message };
    }
  }

  /**
   * Derive a clean relative path for display if the file is inside the workspace.
   */
  static getDisplayPath(filePath: string): string {
    return SourceFrameReader.getDisplayPath(filePath);
  }

  /**
   * Parse a raw stack trace string into structured, categorized frames.
   */
  static parseStack(rawStack: string): StackFrame[] {
    return SourceFrameReader.parseStack(rawStack);
  }

  /**
   * Safely load source code surrounding an error line.
   */
  static getCodeSnippet(
    filePath: string,
    errorLine: number,
    errorCol = 0,
    contextLines = 5,
  ): CodeSnippet | null {
    return SourceFrameReader.getCodeSnippet(filePath, errorLine, errorCol, contextLines);
  }

  /**
   * Scan text and redact process environment secret values and database connection passwords.
   */
  static redactSecrets(text: string): string {
    return Redactor.redactString(text);
  }

  /**
   * Extract nested cause errors safely without circular loop hazards.
   */
  static extractCauses(error: unknown, maxDepth = 5): ExceptionCause[] {
    const causes = ErrorNormalizer.extractCauses(error, maxDepth);
    return causes.map((c) => ({
      name: c.type,
      message: c.message,
      stackLines: c.stackLines,
    }));
  }

  /**
   * Extract and sanitize request details for safe developer inspection.
   */
  static extractRequestDetails(requestOrUrl?: unknown, forgeReq?: unknown): RequestDetails {
    return this.collectContext(requestOrUrl, forgeReq).request;
  }

  /**
   * Sanitize request headers by redacting sensitive authentication, cookie, and key headers.
   */
  static sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    return Redactor.sanitizeHeaders(headers);
  }

  /**
   * Sanitize request body, recursively redacting credential and password fields.
   */
  static sanitizeBody(body: unknown, depth = 0, seen = new WeakSet()): unknown {
    return Redactor.sanitizeData(body, depth, seen);
  }

  /**
   * Normalize and extract compiler, build, and syntax error diagnostics.
   */
  static extractDiagnostics(error: unknown): NormalizedDiagnostic[] {
    return ErrorNormalizer.extractDiagnostics(error);
  }

  /**
   * Safe HTML escaping.
   */
  static escapeHtml(str: unknown): string {
    return FallbackRenderer.escapeHtml(str);
  }
}
