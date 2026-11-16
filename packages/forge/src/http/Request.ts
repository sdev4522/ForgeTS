// packages/forge/src/http/Request.ts
// ─────────────────────────────────────────────────────────────────────
// Unified HTTP Request wrapper.
// Wraps the underlying Fetch-API Request (adapted from Node's IncomingMessage)
// without leaking them. All user code interacts with this class only.
//
// PERFORMANCE: Properties are lazily computed. URL parsing, query string
// parsing, and body reading only happen when accessed.
// ─────────────────────────────────────────────────────────────────────

import type { ZodSchema, ZodError } from 'zod';
import { Validator } from './Validator.js';
import { ValidationError } from '../errors/ForgeError.js';
import { getConfigManager } from '../config/ConfigManager.js';
import type { RegisteredRoute } from '../routing/Router.js';

/**
 * Validation failure raised from a Zod schema.
 * Extends the framework ValidationError so it renders as HTTP 422
 * with the same `errors` payload as pipe-rule validation.
 */
export class ValidationException extends ValidationError {
  constructor(zodError: ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of zodError.issues) {
      const path = issue.path.join('.') || '_root';
      (errors[path] ??= []).push(issue.message);
    }
    super(errors, 'Validation failed');
  }
}

/** Per-request connection and routing metadata supplied by the framework. */
export interface RequestMeta {
  remoteAddress?: string;
  route?: RegisteredRoute;
}

/**
 * Parse a Cookie header into a name → value map.
 * Malformed percent-escapes are kept verbatim instead of throwing.
 */
export function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = Object.create(null);
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    let val = pair.slice(idx + 1).trim();
    if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

export class Request {
  /** Route parameters (e.g., { id: '42' } for /users/:id) */
  readonly params: Readonly<Record<string, string>>;

  /** HTTP method */
  readonly method: string;

  // ─── Lazy-computed caches ───
  private _url: URL | null = null;
  private _query: Record<string, string | string[]> | null = null;
  private _headers: Record<string, string> | null = null;
  private _body: unknown = undefined;
  private _bodyParsed = false;
  private _rawRequest: globalThis.Request;
  private _cookies: Record<string, string> | null = null;
  private _meta: RequestMeta;

  /**
   * @internal — Only the framework creates Request instances.
   * User code never calls this constructor.
   */
  constructor(raw: globalThis.Request, params: Record<string, string> = {}, meta: RequestMeta = {}) {
    this._rawRequest = raw;
    this.params = Object.freeze(params);
    this.method = raw.method;
    this._meta = meta;
  }

  /** The matched route definition, if any. */
  get route(): RegisteredRoute | undefined {
    return this._meta.route;
  }

  /** Route group type: 'web' (session/CSRF) or 'api' (stateless). */
  get routeType(): 'web' | 'api' | undefined {
    return this._meta.route?.type;
  }

  /** Get a route parameter by name. */
  param(name: string): string | undefined {
    return this.params[name];
  }

  // ─── URL & Path ───

  /** The parsed URL object (lazy). */
  private get url(): URL {
    if (!this._url) {
      this._url = new URL(this._rawRequest.url);
    }
    return this._url;
  }

  /** The request pathname (e.g., '/users/42'). */
  get path(): string {
    return this.url.pathname;
  }

  /** The full request URL string. */
  get fullUrl(): string {
    return this._rawRequest.url;
  }

  // ─── Query Parameters ───

  /** Parsed query string parameters (lazy). */
  get query(): Readonly<Record<string, string | string[]>> {
    if (!this._query) {
      // Null-prototype map: keys like `__proto__` / `toString` are plain data
      const query: Record<string, string | string[]> = Object.create(null);
      this._query = query;
      for (const [key, value] of this.url.searchParams.entries()) {
        const existing = query[key];
        if (existing !== undefined) {
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            this._query[key] = [existing, value];
          }
        } else {
          this._query[key] = value;
        }
      }
    }
    return this._query;
  }

  // ─── Headers ───

  /** All request headers (lowercased keys, lazy). */
  get headers(): Readonly<Record<string, string>> {
    if (!this._headers) {
      this._headers = {};
      this._rawRequest.headers.forEach((value, key) => {
        this._headers![key] = value;
      });
    }
    return this._headers;
  }

  /** Get a specific header value. */
  header(name: string): string | undefined {
    return this._rawRequest.headers.get(name.toLowerCase()) ?? undefined;
  }

  // ─── Cookies ───

  /** Parsed request cookies (lazy). Malformed values never throw. */
  get cookies(): Readonly<Record<string, string>> {
    if (!this._cookies) {
      this._cookies = parseCookieHeader(this._rawRequest.headers.get('cookie') ?? '');
    }
    return this._cookies;
  }

  /** Get a single cookie value by name. */
  cookie(name: string): string | undefined {
    return this.cookies[name];
  }

  // ─── Body ───

  /**
   * Get the parsed request body with type safety.
   * Body is pre-parsed by the body parser middleware or read lazily.
   */
  body<T = unknown>(): T {
    return this._body as T;
  }

  /**
   * @internal — Set the parsed body. Called by body-parser middleware.
   */
  _setBody(body: unknown): void {
    this._body = body;
    this._bodyParsed = true;
  }

  /**
   * Read and parse the raw body as JSON.
   * Use this if no body-parser middleware is installed.
   */
  async json<T = unknown>(): Promise<T> {
    if (!this._bodyParsed) {
      this._body = await this._rawRequest.json();
      this._bodyParsed = true;
    }
    return this._body as T;
  }

  /**
   * Read the raw body as text.
   */
  async text(): Promise<string> {
    return this._rawRequest.text();
  }

  // ─── Input ───

  /**
   * All input: query string merged with the parsed body (body wins on conflict).
   */
  all(): Record<string, any> {
    const body = this._body;
    const bodyInput =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, any>)
        : {};
    return { ...this.query, ...bodyInput };
  }

  /**
   * One input value from the body or query string, with an optional default.
   * Supports dot notation for nested values: `req.input('address.city')`.
   */
  input<T = any>(key: string, defaultValue?: T): T {
    let current: any = this.all();
    for (const part of key.split('.')) {
      if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) {
        return defaultValue as T;
      }
      current = current[part];
    }
    return (current === undefined ? defaultValue : current) as T;
  }

  /** Only the listed input keys (missing keys are omitted). */
  only(...keys: Array<string | string[]>): Record<string, any> {
    const all = this.all();
    const out: Record<string, any> = {};
    for (const key of keys.flat()) {
      if (Object.hasOwn(all, key)) out[key] = all[key];
    }
    return out;
  }

  /** All input except the listed keys. */
  except(...keys: Array<string | string[]>): Record<string, any> {
    const skip = new Set(keys.flat());
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.all())) {
      if (!skip.has(key)) out[key] = value;
    }
    return out;
  }

  /** True when the input key is present (even if empty). */
  has(key: string): boolean {
    return this.input<any>(key) !== undefined;
  }

  /** True when the input key is present and not empty. */
  filled(key: string): boolean {
    const value = this.input<any>(key);
    return value !== undefined && value !== null && value !== '';
  }

  /** Input as a boolean: true for true, 1, "1", "true", "on", "yes". */
  boolean(key: string, defaultValue = false): boolean {
    const value = this.input<any>(key);
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'on', 'yes'].includes(String(value).trim().toLowerCase());
  }

  /** Input as an integer, or the default when missing / not a whole number. */
  integer(key: string, defaultValue = 0): number {
    const value = this.input<any>(key);
    if (typeof value === 'number') return Number.isInteger(value) ? value : defaultValue;
    if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return defaultValue;
    return Number(value.trim());
  }

  /** An uploaded file from a multipart form, or null. */
  file(key: string): File | null {
    const value = this.input<any>(key);
    const candidate = Array.isArray(value) ? value[0] : value;
    return typeof File !== 'undefined' && candidate instanceof File ? candidate : null;
  }

  // ─── Validation ───

  /**
   * Validate request input (body + query string) against pipe-separated rules
   * (or a Zod schema). Throws `ValidationError` (422) if validation fails.
   * Returns ONLY the validated fields.
   *
   * @example
   * ```ts
   * const data = await req.validate({
   *   email: 'required|email',
   *   password: 'required|min:8|confirmed',
   *   role: 'in:admin,editor',
   *   age: 'numeric|min:18',
   * }, {
   *   'email.required': 'We need your email address.',
   * });
   * ```
   */
  async validate<T = Record<string, any>>(
    rules: Record<string, string | string[]> | ZodSchema<T>,
    messages: Record<string, string> = {},
  ): Promise<T> {
    if (!this._bodyParsed && this.isJson()) {
      try {
        await this.json();
      } catch {
        this._body = {};
      }
    }
    const input = this.all();

    if (typeof rules === 'object' && rules !== null && !('safeParse' in rules)) {
      return Validator.validate<T>(input, rules as Record<string, string | string[]>, messages);
    }

    // Zod schema
    const schema = rules as ZodSchema<T>;
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new ValidationException(result.error);
    }
    return result.data;
  }

  // ─── Content Negotiation ───

  /**
   * Check if the client prefers a JSON response.
   * True when the first acceptable media type is JSON (API clients, fetch with
   * an explicit JSON Accept header). Browser navigations, whose Accept header
   * starts with text/html and ends in a catch-all wildcard, return false.
   */
  wantsJson(): boolean {
    const accept = this.header('accept') ?? '';
    const first = accept.split(',')[0]?.trim().toLowerCase() ?? '';
    return first.includes('/json') || first.includes('+json');
  }

  /** True for XHR / fetch requests that want JSON rather than an HTML page. */
  expectsJson(): boolean {
    const accept = this.header('accept') ?? '';
    if (this.wantsJson()) return true;
    if (this.header('x-requested-with')?.toLowerCase() === 'xmlhttprequest') return true;
    return !accept.includes('text/html');
  }

  /** True when the request arrived over HTTPS (directly or via a trusted proxy). */
  isSecure(): boolean {
    if (this.url.protocol === 'https:') return true;
    if (this.trustsProxy()) {
      return this.header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase() === 'https';
    }
    return false;
  }

  /** Check if the request has a JSON content type. */
  isJson(): boolean {
    const ct = this.header('content-type') ?? '';
    return ct.includes('application/json');
  }

  // ─── Convenience ───

  /** Get the bearer token from the Authorization header, if present. */
  bearerToken(): string | null {
    const auth = this.header('authorization');
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }

  /**
   * Get the client IP address.
   *
   * Uses the real socket address. Forwarding headers (X-Forwarded-For /
   * X-Real-IP) are client-controlled and are only honoured when the app is
   * configured to sit behind a reverse proxy (`app.trustProxy = true`).
   */
  ip(): string {
    if (this.trustsProxy()) {
      const forwarded = this.header('x-forwarded-for')?.split(',')[0]?.trim();
      if (forwarded) return forwarded;
      const realIp = this.header('x-real-ip')?.trim();
      if (realIp) return realIp;
    }
    return this._meta.remoteAddress ?? '127.0.0.1';
  }

  private trustsProxy(): boolean {
    try {
      return getConfigManager().get<boolean>('app.trustProxy', false) === true;
    } catch {
      return false;
    }
  }
}
