// packages/forge/src/errors/ForgeError.ts
// ─────────────────────────────────────────────────────────────────────
// First-class framework exception hierarchy.
// Provides predictable HTTP status codes, machine-readable error codes,
// structured details, and native ES2022 Error.cause chaining.
// ─────────────────────────────────────────────────────────────────────

export interface ForgeErrorOptions {
  cause?: unknown;
  code?: string;
  details?: unknown;
  statusCode?: number;
  /** Extra HTTP response headers to send with the error (e.g. Allow, Retry-After). */
  headers?: Record<string, string>;
}

/**
 * Base framework error class.
 * All framework-specific errors inherit from this class.
 */
export class ForgeError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly headers?: Record<string, string>;
  override readonly cause?: unknown;

  constructor(
    statusCodeOrMessage: number | string,
    messageOrOptions?: string | ForgeErrorOptions | unknown,
    maybeOptions?: ForgeErrorOptions,
  ) {
    let message: string;
    let opts: ForgeErrorOptions = {};

    if (typeof statusCodeOrMessage === 'number') {
      opts.statusCode = statusCodeOrMessage;
      message = typeof messageOrOptions === 'string' ? messageOrOptions : 'Error';
      if (maybeOptions && typeof maybeOptions === 'object') {
        opts = { ...opts, ...maybeOptions };
      }
    } else {
      message = statusCodeOrMessage;
      if (messageOrOptions && typeof messageOrOptions === 'object') {
        if ('statusCode' in messageOrOptions || 'code' in messageOrOptions || 'details' in messageOrOptions || 'cause' in messageOrOptions || 'headers' in messageOrOptions) {
          opts = messageOrOptions as ForgeErrorOptions;
        } else {
          opts = { cause: messageOrOptions };
        }
      } else if (messageOrOptions !== undefined) {
        opts = { cause: messageOrOptions };
      }
    }

    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = this.constructor.name;
    this.statusCode = opts.statusCode ?? 500;
    this.code = opts.code ?? 'ERR_FORGE_INTERNAL';
    this.details = opts.details;
    this.headers = opts.headers;
    if (opts.cause !== undefined) {
      this.cause = opts.cause;
    }

    // Ensure clean prototype chain in all JS runtimes
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── HTTP Exceptions ───

export class HttpError extends ForgeError {
  constructor(statusCode: number, message: string, options?: ForgeErrorOptions) {
    super(message, {
      statusCode,
      code: options?.code ?? `ERR_HTTP_${statusCode}`,
      details: options?.details,
      cause: options?.cause,
      headers: options?.headers,
    });
  }
}

/** Backwards-compatible alias for HttpError */
export const HttpException = HttpError;
export type HttpException = HttpError;

export class BadRequestException extends HttpError {
  constructor(message: string = 'Bad Request', options?: ForgeErrorOptions) {
    super(400, message, { code: 'ERR_BAD_REQUEST', ...options });
  }
}

export class UnauthorizedException extends HttpError {
  constructor(message: string = 'Unauthorized', options?: ForgeErrorOptions) {
    super(401, message, { code: 'ERR_UNAUTHORIZED', ...options });
  }
}

export class ForbiddenException extends HttpError {
  constructor(message: string = 'Forbidden', options?: ForgeErrorOptions) {
    super(403, message, { code: 'ERR_FORBIDDEN', ...options });
  }
}

export class NotFoundException extends HttpError {
  constructor(message: string = 'Not Found', options?: ForgeErrorOptions) {
    super(404, message, { code: 'ERR_NOT_FOUND', ...options });
  }
}

export class MethodNotAllowedException extends HttpError {
  constructor(message: string = 'Method Not Allowed', options?: ForgeErrorOptions) {
    super(405, message, { code: 'ERR_METHOD_NOT_ALLOWED', ...options });
  }
}

export class UnprocessableEntityException extends HttpError {
  public readonly errors?: unknown;

  constructor(message: string = 'Unprocessable Entity', errorsOrOptions?: unknown) {
    let details: unknown = undefined;
    let opts: ForgeErrorOptions | undefined = undefined;

    if (errorsOrOptions && typeof errorsOrOptions === 'object' && ('cause' in errorsOrOptions || 'code' in errorsOrOptions)) {
      opts = errorsOrOptions as ForgeErrorOptions;
      details = opts.details;
    } else {
      details = errorsOrOptions;
    }

    super(422, message, {
      code: 'ERR_UNPROCESSABLE_ENTITY',
      details,
      ...opts,
    });

    this.errors = details;
  }
}

export class ServiceUnavailableException extends HttpError {
  constructor(message: string = 'Service Unavailable', options?: ForgeErrorOptions) {
    super(503, message, { code: 'ERR_SERVICE_UNAVAILABLE', ...options });
  }
}

export class InternalServerErrorException extends HttpError {
  constructor(message: string = 'Internal Server Error', options?: ForgeErrorOptions) {
    super(500, message, { code: 'ERR_INTERNAL_SERVER_ERROR', ...options });
  }
}

// ─── Validation Error ───

export class ValidationError extends ForgeError {
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>, message: string = 'The given data was invalid.', options?: ForgeErrorOptions) {
    super(message, {
      statusCode: 422,
      code: 'ERR_VALIDATION_FAILED',
      details: errors,
      ...options,
    });
    this.errors = errors;
  }
}

export const ValidationException = ValidationError;
export type ValidationException = ValidationError;

// ─── Routing Exceptions ───

export class RoutingError extends ForgeError {
  constructor(message: string, options?: ForgeErrorOptions) {
    super(message, {
      statusCode: options?.statusCode ?? 404,
      code: options?.code ?? 'ERR_ROUTING',
      ...options,
    });
  }
}

export class RouteNotFoundException extends RoutingError {
  constructor(message: string = 'Route Not Found', options?: ForgeErrorOptions) {
    super(message, {
      statusCode: 404,
      code: 'ERR_ROUTE_NOT_FOUND',
      ...options,
    });
  }
}

export class MethodNotAllowedError extends RoutingError {
  constructor(message: string = 'Method Not Allowed', options?: ForgeErrorOptions) {
    super(message, {
      statusCode: 405,
      code: 'ERR_METHOD_NOT_ALLOWED',
      ...options,
    });
  }
}

// ─── Container Exceptions ───

export class ContainerError extends ForgeError {
  constructor(message: string, options?: ForgeErrorOptions) {
    super(message, {
      statusCode: options?.statusCode ?? 500,
      code: options?.code ?? 'ERR_CONTAINER',
      ...options,
    });
  }
}

export class BindingResolutionException extends ContainerError {
  constructor(token: unknown, message?: string, options?: ForgeErrorOptions) {
    const tokenStr = typeof token === 'function' ? token.name : String(token);
    super(
      message ??
        `[ForgeTS] No binding found for: ${tokenStr}. ` +
          `Register it in a provider using container.bind() or container.singleton().`,
      {
        code: 'ERR_CONTAINER_RESOLUTION',
        details: { token: tokenStr },
        ...options,
      },
    );
  }
}

export class CircularDependencyException extends ContainerError {
  constructor(token: unknown, path: unknown[], options?: ForgeErrorOptions) {
    const tokenStr = typeof token === 'function' ? token.name : String(token);
    const pathStr = path.map((t) => (typeof t === 'function' ? t.name : String(t))).join(' -> ');
    super(`[ForgeTS] Circular dependency detected resolving: ${tokenStr} (${pathStr})`, {
      code: 'ERR_CONTAINER_CIRCULAR',
      details: { token: tokenStr, path },
      ...options,
    });
  }
}

// ─── Database Exceptions ───

export class DatabaseError extends ForgeError {
  constructor(message: string, options?: ForgeErrorOptions) {
    super(message, {
      statusCode: options?.statusCode ?? 500,
      code: options?.code ?? 'ERR_DATABASE',
      ...options,
    });
  }
}

export class DatabaseConnectionException extends DatabaseError {
  constructor(message: string = 'Database connection failed', options?: ForgeErrorOptions) {
    super(message, {
      statusCode: 503,
      code: 'ERR_DATABASE_CONNECTION',
      ...options,
    });
  }
}

export class QueryException extends DatabaseError {
  public readonly sql?: string;
  public readonly parameters?: unknown[];

  constructor(
    sql: string,
    parameters: unknown[] | ForgeErrorOptions = [],
    cause?: unknown,
    options?: ForgeErrorOptions,
  ) {
    let params: unknown[] = [];
    let errCause: unknown = cause;
    let opts: ForgeErrorOptions = options ?? {};

    if (parameters && !Array.isArray(parameters) && typeof parameters === 'object') {
      if ('cause' in (parameters as any)) {
        errCause = (parameters as any).cause;
      }
      opts = parameters as ForgeErrorOptions;
    } else if (Array.isArray(parameters)) {
      params = parameters;
    }

    const origMsg = errCause instanceof Error ? errCause.message : String(errCause ?? 'Query execution failed');
    super(`[ForgeTS Database Query Error] ${sql} - ${origMsg}`, {
      statusCode: 500,
      code: 'ERR_DATABASE_QUERY',
      cause: errCause,
      details: { sql, parameters: params },
      ...opts,
    });
    this.sql = sql;
    this.parameters = params;
  }
}

export class ModelNotFoundException extends DatabaseError {
  public readonly model: string;
  public readonly ids?: unknown[];

  constructor(model: string, ids?: unknown | unknown[], options?: ForgeErrorOptions) {
    const idList = ids !== undefined ? (Array.isArray(ids) ? ids : [ids]) : [];
    const idText = idList.length > 0 ? ` with ID [${idList.join(', ')}]` : '';
    super(`No query results found for model [${model}]${idText}`, {
      statusCode: 404,
      code: 'ERR_MODEL_NOT_FOUND',
      details: { model, ids: idList },
      ...options,
    });
    this.model = model;
    this.ids = idList;
  }
}

// ─── View Exceptions ───

export class ViewError extends ForgeError {
  constructor(message: string, options?: ForgeErrorOptions) {
    super(message, {
      statusCode: options?.statusCode ?? 500,
      code: options?.code ?? 'ERR_VIEW',
      ...options,
    });
  }
}

export class ViewNotFoundException extends ViewError {
  public readonly template: string;

  constructor(template: string, searchedPath?: string, options?: ForgeErrorOptions) {
    const pathText = searchedPath ? ` Looked in: ${searchedPath}.` : '';
    super(`[ForgeTS] View template not found: '${template}'.${pathText}`, {
      code: 'ERR_VIEW_NOT_FOUND',
      details: { template, searchedPath },
      ...options,
    });
    this.template = template;
  }
}

export class ViewRenderException extends ViewError {
  constructor(template: string, cause?: unknown, options?: ForgeErrorOptions) {
    const msg = cause instanceof Error ? cause.message : String(cause ?? 'Rendering failed');
    super(`[ForgeTS] Error rendering view '${template}': ${msg}`, {
      code: 'ERR_VIEW_RENDER',
      cause,
      details: { template },
      ...options,
    });
  }
}

// ─── Configuration Exceptions ───

export class ConfigurationError extends ForgeError {
  constructor(message: string, options?: ForgeErrorOptions) {
    super(message, {
      statusCode: 500,
      code: 'ERR_CONFIG_INVALID',
      ...options,
    });
  }
}

export const ConfigurationException = ConfigurationError;
export type ConfigurationException = ConfigurationError;

// ─── Auth Exceptions ───

export class AuthenticationError extends HttpError {
  constructor(message: string = 'Unauthenticated', options?: ForgeErrorOptions) {
    super(401, message, { code: 'ERR_AUTHENTICATION', ...options });
  }
}

export class AuthorizationError extends HttpError {
  constructor(message: string = 'Unauthorized action', options?: ForgeErrorOptions) {
    super(403, message, { code: 'ERR_AUTHORIZATION', ...options });
  }
}
