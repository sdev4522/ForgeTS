// packages/forge/src/http/Response.ts
// ─────────────────────────────────────────────────────────────────────
// Unified HTTP Response builder.
// Chainable, immutable-style API. Returns a Bun-native Response at the end.
//
// PERFORMANCE: No intermediate buffering. We build the final Response
// object directly. Headers are stored in a plain object until finalized.
// ─────────────────────────────────────────────────────────────────────

import type { ViewEngine } from '../view/ViewEngine.js';
import type { ReactEngine } from '../ssr/ReactEngine.js';

export interface CookieOptions {
  maxAge?: number;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Validate whether a given value is a valid HTTP status code according to the Web / Fetch specification.
 * Valid statuses are 101 or within the range [200, 599].
 */
export function isValidHttpStatus(status: unknown): status is number {
  return (
    typeof status === 'number' &&
    Number.isInteger(status) &&
    (status === 101 || (status >= 200 && status <= 599))
  );
}

/**
 * Normalizes any arbitrary status value into a guaranteed valid HTTP status code.
 * Rejects 0, NaN, null, undefined, negative numbers, non-numeric strings, and out-of-range values.
 * Guaranteed to return a valid HTTP status in [200, 599] or 101.
 */
export function normalizeHttpStatus(status: unknown, defaultStatus: number = 200): number {
  const fallback = isValidHttpStatus(defaultStatus) ? defaultStatus : 200;

  if (typeof status === 'number') {
    return isValidHttpStatus(status) ? status : fallback;
  }

  if (typeof status === 'string') {
    const trimmed = status.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = parseInt(trimmed, 10);
      return isValidHttpStatus(parsed) ? parsed : fallback;
    }
  }

  return fallback;
}

export class ForgeResponse {
  private _status: number = 200;
  private _headers: Record<string, string> = {};
  private _body: BodyInit | null = null;
  private _cookies: string[] = [];
  private _viewEngine: ViewEngine | null;
  private _reactEngine: ReactEngine | null;

  constructor(viewEngine?: ViewEngine, reactEngine?: ReactEngine) {
    this._viewEngine = viewEngine ?? null;
    this._reactEngine = reactEngine ?? null;
  }

  // ─── Status ───

  /** Set the HTTP status code. Chainable. */
  status(code: number): this {
    this._status = normalizeHttpStatus(code, 200);
    return this;
  }

  // ─── Headers ───

  /** Set a response header. Chainable. */
  header(name: string, value: string): this {
    this._headers[name.toLowerCase()] = value;
    return this;
  }

  // ─── Body Methods ───

  /** Send a JSON response. */
  json(data: unknown, status?: number): this {
    if (status !== undefined) this._status = normalizeHttpStatus(status, this._status);
    this._headers['content-type'] = 'application/json; charset=utf-8';
    this._body = JSON.stringify(data);
    return this;
  }

  /** Send a plain text response. */
  text(content: string, status?: number): this {
    if (status !== undefined) this._status = normalizeHttpStatus(status, this._status);
    this._headers['content-type'] = 'text/plain; charset=utf-8';
    this._body = content;
    return this;
  }

  /** Send an HTML response. */
  html(content: string, status?: number): this {
    if (status !== undefined) this._status = normalizeHttpStatus(status, this._status);
    this._headers['content-type'] = 'text/html; charset=utf-8';
    this._body = content;
    return this;
  }

  /**
   * Render a view template with data and send as HTML response.
   * Templates live in `resources/views/`.
   *
   * @param template Template name (e.g., 'welcome' → resources/views/welcome.html)
   * @param data Data to interpolate into the template
   *
   * @example
   * ```ts
   * return res.view('welcome', { title: 'Hello', uptime: '5m' });
   * ```
   */
  /**
   * Render a view template or React SSR page.
   *
   * @param template Template name (e.g., 'welcome' → resources/js/pages/welcome.tsx)
   * @param data Data to interpolate into the template or pass as props to React component
   *
   * @example
   * ```ts
   * return res.view('welcome', { appName: 'My App' }).meta({
   *   title: 'Welcome to ForgeTS',
   *   description: 'My application landing page',
   * });
   * ```
   */
  view(
    template: string,
    data: Record<string, unknown> = {},
    status?: number,
  ): Promise<this> & { meta: (metadata: Record<string, string>) => Promise<this> } {
    const promise = (async () => {
      if (!this._viewEngine) {
        throw new Error(
          '[ForgeTS] ViewEngine not available. ' +
            'This typically means res.view() was called on a manually-constructed ForgeResponse. ' +
            'Use the response object passed to your controller method.',
        );
      }

      const token = (data['_csrfToken'] || data['csrf_token'] || (this as any)._csrfToken || '') as string;
      const csrfField = token
        ? `<input type="hidden" name="_token" value="${token}">`
        : '';

      const viewData = {
        csrf_token: token,
        csrf_field: csrfField,
        ...data,
      };

      if (this._reactEngine && this._reactEngine.hasPage(template)) {
        const html = await this._reactEngine.renderPage(template, viewData);
        return this.html(html, status);
      }

      const rendered = this._viewEngine.render(template, viewData);
      return this.html(rendered, status);
    })();

    (promise as any).meta = (metadata: Record<string, string>) => {
      return promise.then((res) => res.meta(metadata));
    };

    return promise as any;
  }

  /**
   * Set per-route SEO head metadata (title, description, og:tags, etc.).
   */
  meta(metadata: Record<string, string>): this {
    if (typeof this._body === 'string') {
      let body = this._body;

      if (metadata.title) {
        body = body.replace(/<title>.*?<\/title>/i, `<title>${metadata.title}</title>`);
      }

      if (metadata.description) {
        if (/<meta\s+name="description"/i.test(body)) {
          body = body.replace(
            /<meta\s+name="description"[^>]*>/i,
            `<meta name="description" content="${metadata.description}">`,
          );
        } else {
          body = body.replace(
            '</head>',
            `  <meta name="description" content="${metadata.description}">\n</head>`,
          );
        }
      }

      for (const [key, value] of Object.entries(metadata)) {
        if (key === 'title' || key === 'description') continue;
        const metaTag = `<meta name="${key}" content="${value}">`;
        if (!body.includes(metaTag)) {
          body = body.replace('</head>', `  ${metaTag}\n</head>`);
        }
      }

      this._body = body;
    }
    return this;
  }

  // ─── Shortcut Status Responses ───

  /** 201 Created with JSON body. */
  created(data: unknown): this {
    this._status = 201;
    return this.json(data);
  }

  /** 204 No Content. */
  noContent(): this {
    this._status = 204;
    this._body = null;
    return this;
  }

  /** 404 Not Found. */
  notFound(message: string = 'Not Found'): this {
    this._status = 404;
    return this.json({ error: message, statusCode: 404 });
  }

  /** 400 Bad Request. */
  badRequest(message: string = 'Bad Request'): this {
    this._status = 400;
    return this.json({ error: message, statusCode: 400 });
  }

  /** 401 Unauthorized. */
  unauthorized(message: string = 'Unauthorized'): this {
    this._status = 401;
    return this.json({ error: message, statusCode: 401 });
  }

  /** 403 Forbidden. */
  forbidden(message: string = 'Forbidden'): this {
    this._status = 403;
    return this.json({ error: message, statusCode: 403 });
  }

  /** 422 Unprocessable Entity. */
  unprocessable(message: string = 'The given data was invalid.', errors?: unknown): this {
    this._status = 422;
    return this.json({
      message,
      statusCode: 422,
      ...(errors ? { errors } : {}),
    });
  }

  /** 500 Internal Server Error. */
  serverError(message: string = 'Internal Server Error'): this {
    this._status = 500;
    return this.json({ error: message, statusCode: 500 });
  }

  // ─── Redirects ───

  /** Redirect to a URL. Default status 302 (temporary). */
  redirect(url: string, status: number = 302): this {
    const validRedirectStatus =
      typeof status === 'number' && Number.isInteger(status) && status >= 300 && status <= 399
        ? status
        : 302;
    this._status = validRedirectStatus;
    this._headers['location'] = url;
    this._body = null;
    return this;
  }

  /** Permanent redirect (301). */
  permanentRedirect(url: string): this {
    return this.redirect(url, 301);
  }

  // ─── Cookies ───

  /** Set a cookie. */
  cookie(name: string, value: string, options: CookieOptions = {}): this {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
    if (options.domain) cookie += `; Domain=${options.domain}`;
    if (options.path) cookie += `; Path=${options.path}`;
    if (options.httpOnly) cookie += '; HttpOnly';
    if (options.secure) cookie += '; Secure';
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    this._cookies.push(cookie);
    return this;
  }

  /** Clear a cookie. */
  clearCookie(name: string, options: CookieOptions = {}): this {
    return this.cookie(name, '', { ...options, maxAge: 0 });
  }

  // ─── Finalize ───

  /**
   * Convert to a native Web API Response object.
   * This is called internally by the framework to send the response.
   * Guaranteed to always return a valid HTTP status (101 or 200..599).
   * @internal
   */
  toNativeResponse(): globalThis.Response {
    const headers = new Headers(this._headers);

    // Append Set-Cookie headers
    for (const cookie of this._cookies) {
      headers.append('set-cookie', cookie);
    }

    const defaultStatus = this._headers['location'] ? 302 : 200;
    const finalStatus = normalizeHttpStatus(this._status, defaultStatus);

    return new globalThis.Response(this._body, {
      status: finalStatus,
      headers,
    });
  }

  // ─── Static Factory ───

  /** Create a quick JSON response (shorthand for new ForgeResponse().json(data)). */
  static json(data: unknown, status: number = 200): ForgeResponse {
    return new ForgeResponse().json(data, status);
  }

  /** Create a quick text response. */
  static text(content: string, status: number = 200): ForgeResponse {
    return new ForgeResponse().text(content, status);
  }
}
