// packages/forge/src/http/Request.ts
// ─────────────────────────────────────────────────────────────────────
// Unified HTTP Request wrapper.
// Wraps the underlying runtime primitives (Bun Request, Node IncomingMessage)
// without leaking them. All user code interacts with this class only.
//
// PERFORMANCE: Properties are lazily computed. URL parsing, query string
// parsing, and body reading only happen when accessed.
// ─────────────────────────────────────────────────────────────────────

import type { ZodSchema, ZodError } from 'zod';

export class ValidationException extends Error {
  public readonly errors: Record<string, string[]>;

  constructor(zodError: ZodError) {
    super('Validation failed');
    this.name = 'ValidationException';
    this.errors = {};

    for (const issue of zodError.issues) {
      const path = issue.path.join('.') || '_root';
      if (!this.errors[path]) {
        this.errors[path] = [];
      }
      this.errors[path].push(issue.message);
    }
  }
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

  /**
   * @internal — Only the framework creates Request instances.
   * User code never calls this constructor.
   */
  constructor(raw: globalThis.Request, params: Record<string, string> = {}) {
    this._rawRequest = raw;
    this.params = Object.freeze(params);
    this.method = raw.method;
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
      this._query = {};
      for (const [key, value] of this.url.searchParams.entries()) {
        const existing = this._query[key];
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

  // ─── Validation ───

  /**
   * Validate the request body against a Zod schema.
   * Throws `ValidationException` if validation fails.
   *
   * @example
   * ```ts
   * const data = req.validate(CreateUserSchema);
   * // data is fully typed
   * ```
   */
  validate<T>(schema: ZodSchema<T>): T {
    const result = schema.safeParse(this._body);
    if (!result.success) {
      throw new ValidationException(result.error);
    }
    return result.data;
  }

  // ─── Content Negotiation ───

  /** Check if the client accepts JSON responses. */
  wantsJson(): boolean {
    const accept = this.header('accept') ?? '';
    return accept.includes('application/json') || accept.includes('*/*');
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

  /** Get the client IP address. */
  ip(): string {
    return (
      this.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      this.header('x-real-ip') ??
      '127.0.0.1'
    );
  }
}
