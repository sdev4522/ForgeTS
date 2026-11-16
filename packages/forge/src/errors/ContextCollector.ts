// packages/forge/src/errors/ContextCollector.ts
// ─────────────────────────────────────────────────────────────────────
// Collects contextual request, route, and environment metadata
// for correlation and debugging. Generates unique Error IDs.
// ─────────────────────────────────────────────────────────────────────

import { Redactor } from './Redactor.js';
import { env } from '../config/env.js';
import { getConfigManager } from '../config/ConfigManager.js';
import type { Request } from '../http/Request.js';
import type { ResolvedRoute } from '../routing/RouteResolver.js';

export interface RequestContext {
  id: string;
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

export interface RouteContext {
  pattern: string | null;
  controller: string | null;
  action: string | null;
  params: Record<string, string>;
  middleware: string[];
}

export interface EnvironmentContext {
  runtime: string;
  nodeEnv: string;
  appDebug: boolean;
  timezone: string;
}

export interface ErrorContext {
  errorId: string;
  request: RequestContext;
  route: RouteContext;
  environment: EnvironmentContext;
}

export class ContextCollector {
  /**
   * Generate a unique, compact error identifier for server/client log correlation.
   * Format: err_<12-hex-chars> (e.g. err_9f8a1b2c3d4e)
   */
  static generateErrorId(): string {
    try {
      const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      return `err_${raw}`;
    } catch {
      return `err_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    }
  }

  /**
   * Collect only what a production (non-debug) error response needs:
   * an error ID plus method/path. No header, body, or environment inspection.
   */
  static collectMinimal(rawRequest?: globalThis.Request, forgeReq?: Request): ErrorContext {
    const errorId = this.generateErrorId();
    let method = 'GET';
    let url = '/';
    let path = '/';

    try {
      if (rawRequest && typeof rawRequest === 'object' && 'headers' in rawRequest) {
        method = rawRequest.method || method;
        url = rawRequest.url || url;
        path = new URL(url, 'http://localhost').pathname;
      } else if (forgeReq && typeof forgeReq === 'object') {
        method = forgeReq.method ?? method;
        path = forgeReq.path ?? path;
        url = forgeReq.fullUrl ?? path;
      }
    } catch {
      // Non-fatal if request parsing fails
    }

    return {
      errorId,
      request: {
        id: errorId,
        method,
        url: path,
        path,
        queryParams: {},
        routeParams: {},
        headers: {},
        body: undefined,
        contentType: '',
        timestamp: '',
      },
      route: { pattern: null, controller: null, action: null, params: {}, middleware: [] },
      environment: {
        runtime: `Node.js ${process.version}`,
        nodeEnv: process.env.NODE_ENV ?? 'development',
        appDebug: false,
        timezone: 'UTC',
      },
    };
  }

  /**
   * Collect comprehensive, sanitized context for an error.
   */
  static collect(
    rawRequest?: globalThis.Request,
    forgeReq?: Request,
    routeInfo?: ResolvedRoute | { pattern?: string | null; controller?: string | null; action?: string | null; params?: Record<string, string>; middleware?: string[] } | null,
    explicitErrorId?: string,
  ): ErrorContext {
    const errorId = explicitErrorId ?? this.generateErrorId();

    // 1. Request details
    let method = 'GET';
    let url = '/';
    let path = '/';
    let contentType = 'text/html';
    let queryParams: Record<string, string | string[]> = {};
    let routeParams: Record<string, string> = {};
    let rawHeaders: Record<string, string> = {};
    let rawBody: unknown = undefined;

    try {
      if (forgeReq && typeof forgeReq === 'object') {
        method = forgeReq.method ?? method;
        path = forgeReq.path ?? path;
        url = forgeReq.fullUrl ?? path;
        routeParams = forgeReq.params ? { ...forgeReq.params } : {};
        queryParams = forgeReq.query ? { ...forgeReq.query } : {};
        rawHeaders = forgeReq.headers ? { ...forgeReq.headers } : {};
        rawBody = typeof forgeReq.body === 'function' ? forgeReq.body() : (forgeReq as any)._body;
      }

      if (rawRequest && typeof rawRequest === 'object' && 'headers' in rawRequest) {
        method = rawRequest.method || method;
        url = rawRequest.url || url;
        try {
          const parsed = new URL(url, 'http://localhost');
          path = parsed.pathname;
          if (Object.keys(queryParams).length === 0) {
            parsed.searchParams.forEach((v, k) => {
              queryParams[k] = v;
            });
          }
        } catch {}

        if (Object.keys(rawHeaders).length === 0 && rawRequest.headers) {
          rawRequest.headers.forEach((v, k) => {
            rawHeaders[k] = v;
          });
        }
      }

      contentType = rawHeaders['content-type'] ?? '';
    } catch {
      // Non-fatal if request parsing fails
    }

    // Merge route params from routeInfo if not already populated
    if (routeInfo?.params) {
      routeParams = { ...routeParams, ...routeInfo.params };
    }

    const requestContext: RequestContext = {
      id: errorId,
      method,
      url: Redactor.redactString(url),
      path: Redactor.redactString(path),
      queryParams: Redactor.sanitizeData(queryParams) as Record<string, string | string[]>,
      routeParams: Redactor.sanitizeData(routeParams) as Record<string, string>,
      headers: Redactor.sanitizeHeaders(rawHeaders),
      body: Redactor.sanitizeData(rawBody),
      contentType,
      timestamp: this.formatTimestamp(),
    };

    // 2. Route details
    const route = routeInfo && 'route' in routeInfo ? routeInfo.route : undefined;
    const routeContext: RouteContext = {
      pattern: route ? route.fullPath : ((routeInfo as any)?.pattern ?? null),
      controller: route ? route.controllerClass.name : ((routeInfo as any)?.controller ?? null),
      action: route ? String(route.handlerName) : ((routeInfo as any)?.action ?? null),
      params: routeParams,
      middleware: route
        ? route.middleware.map((m: any) => m.name || (m.constructor ? m.constructor.name : 'Middleware'))
        : ((routeInfo as any)?.middleware ?? []),
    };

    // 3. Environment details
    const appDebug = env.boolean('APP_DEBUG', false);
    const environmentContext: EnvironmentContext = {
      runtime: `Node.js ${process.version}`,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      appDebug,
      timezone: this.getTimezoneName(),
    };

    return {
      errorId,
      request: requestContext,
      route: routeContext,
      environment: environmentContext,
    };
  }

  private static getTimezoneName(): string {
    try {
      const cfg = getConfigManager();
      if (cfg) {
        return cfg.get('app.timezone', 'UTC');
      }
    } catch {}
    return process.env.APP_TIMEZONE ?? process.env.TZ ?? 'UTC';
  }

  private static formatTimestamp(): string {
    const tz = this.getTimezoneName();
    try {
      const timeStr = new Date().toLocaleTimeString('en-US', {
        timeZone: tz,
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
}
