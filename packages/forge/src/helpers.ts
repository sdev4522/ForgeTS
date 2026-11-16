// packages/forge/src/helpers.ts
// ─────────────────────────────────────────────────────────────────────
// Global helpers — the shortest way to write a route handler.
//
//   router.get('/', () => view('welcome', { name: 'Forge' }));
//   router.get('/users/:id', async (req) => (await User.find(req.params.id)) ?? abort(404));
//   router.post('/login', () => redirect('/dashboard'));
//
// Helpers that need the current request (view, request, back) read it
// from an AsyncLocalStorage context the framework sets per request, so
// they are safe under concurrency and need no arguments passed around.
// ─────────────────────────────────────────────────────────────────────

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from './http/Request.js';
import { ForgeResponse } from './http/Response.js';
import { HttpError } from './errors/ForgeError.js';

export interface RequestContext {
  request: Request;
  /** Creates a response wired to the application's view / SSR engines. */
  makeResponse: () => ForgeResponse;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** @internal — run a request inside its context. Called by the Application. */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

function currentContext(helper: string): RequestContext {
  const context = storage.getStore();
  if (!context) {
    throw new Error(
      `[ForgeTS] ${helper}() was called outside of a request. ` +
        `It only works inside route handlers, controllers and middleware.`,
    );
  }
  return context;
}

/** The current request. */
export function request(): Request {
  return currentContext('request').request;
}

/**
 * A fresh response builder, for when you need headers or cookies:
 * `return response().header('X-Foo', 'bar').json({ ok: true })`.
 */
export function response(): ForgeResponse {
  const context = storage.getStore();
  return context ? context.makeResponse() : new ForgeResponse();
}

/**
 * Render a page: a React page in resources/js/pages or an HTML view in resources/views.
 * Chain `.meta({ title, description })` for SEO tags.
 */
export function view(
  name: string,
  data: Record<string, unknown> = {},
  status?: number,
): ReturnType<ForgeResponse['view']> {
  return currentContext('view').makeResponse().view(name, data, status);
}

/** JSON response. (Returning a plain object or array from a handler does the same.) */
export function json(data: unknown, status = 200): ForgeResponse {
  return response().json(data, status);
}

/** 201 Created with a JSON body. */
export function created(data: unknown): ForgeResponse {
  return response().created(data);
}

/** 204 No Content. */
export function noContent(): ForgeResponse {
  return response().noContent();
}

/** Plain-text response. */
export function text(content: string, status = 200): ForgeResponse {
  return response().text(content, status);
}

/** HTML response from a string. */
export function html(content: string, status = 200): ForgeResponse {
  return response().html(content, status);
}

/** Redirect to a URL or path (302 by default). */
export function redirect(url: string, status = 302): ForgeResponse {
  return response().redirect(url, status);
}

/**
 * Redirect back to the page the request came from.
 * Only same-site referrers are followed; anything else goes to `fallback`.
 */
export function back(fallback = '/'): ForgeResponse {
  const req = currentContext('back').request;
  const referer = req.header('referer');
  let target = fallback;
  if (referer) {
    try {
      const from = new URL(referer);
      const here = new URL(req.fullUrl);
      if (from.host === here.host) {
        target = from.pathname + from.search;
      }
    } catch {
      // Malformed referer: use the fallback
    }
  }
  return response().redirect(target);
}

/**
 * Stop the request with an HTTP error.
 * Typed as `never`, so it works in expressions: `const user = (await User.find(id)) ?? abort(404)`.
 */
export function abort(status: number, message?: string): never {
  const defaults: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    419: 'Page Expired',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };
  throw new HttpError(status, message ?? defaults[status] ?? 'Error');
}

/** abort() when the condition is truthy. */
export function abortIf(condition: unknown, status: number, message?: string): void {
  if (condition) abort(status, message);
}

/** abort() unless the condition is truthy. */
export function abortUnless(condition: unknown, status: number, message?: string): asserts condition {
  if (!condition) abort(status, message);
}
