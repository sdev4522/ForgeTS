# ForgeTS Error Infrastructure & Diagnostics Subsystem

ForgeTS features a dedicated, production-grade error handling subsystem designed for high-precision debugging in development and zero-leak security in production.

---

## 1. Architectural Philosophy

The ForgeTS error subsystem is built around four decoupled, single-responsibility phases:

```
Raw Error / Thrown Primitive
            |
            v
     ErrorNormalizer
(Type, Status, Stack, Diagnostics, Causes)
            |
            v
     ContextCollector
(Request, Route, Environment, Error ID)
            |
            v
    ContentNegotiator
 (HTML Browser vs JSON API)
            |
            v
      Renderers
+-- HtmlErrorRenderer (Debug / Production)
+-- JsonErrorRenderer (Debug / Production)
+-- FallbackRenderer (Failure-of-Failure Safe)
```

1. **Zero Secret Leaks**: Production responses never expose stack traces, filesystem paths, database credentials, environment variables, authorization headers, or internal configuration.
2. **Deterministic Correlation**: Every failure is assigned an immutable Error ID (`err_<12-hex>`), returned in the `X-Error-Id` HTTP header and displayed in both server logs and error responses.
3. **Failure-of-Failure Resilience**: The error renderer itself will never crash the server. Malicious errors with throwing getters, circular structures, or corrupted stacks fall back cleanly to minimal safe responses.
4. **Rich Ignition Developer Experience**: In development (`APP_DEBUG=true`), developers receive an interactive dark-mode debugging interface with categorized stack frames (App vs Framework vs Vendor), active code snippets with caret indicators, route parameters, request headers, nested causes, and compiler diagnostics.

---

## 2. Error Lifecycle

When an unhandled exception or rejection occurs within the HTTP pipeline, middleware chain, controller, or view engine:

1. **Interception**: `Application.handleError()` catches the error at the root of `handleRequest()`.
2. **Normalization**: `ErrorNormalizer.normalize(error)` converts any thrown value (Error instance, custom exception, primitive string, Bun `BuildMessage`, or `AggregateError`) into a normalized `NormalizedError` object.
3. **Secret Redaction**: `Redactor.redactString()` scans the error message and stack trace against active environment secrets, database connection URIs, sensitive query parameters (`?token=...`, `?key=...`), and Bearer tokens.
4. **Context Collection**: `ContextCollector.collect()` captures:
   - Request metadata: HTTP method, URL, pathname, query parameters, content type, and sanitized headers.
   - Route metadata: matched pattern, controller name, action method, route parameters, and applied middleware list.
   - Environment metadata: runtime version (Bun/Node), `NODE_ENV`, `APP_DEBUG`, and application timezone.
   - Unique correlation ID: `err_<12-hex>`.
5. **Content Negotiation**: `ContentNegotiator.prefersHtml()` checks whether the client requested an API endpoint (`/api/*` or `Accept: application/json`) or a browser page (`Accept: text/html`).
6. **Rendering**:
   - In Development (`APP_DEBUG=true`): Renders rich HTML debug page or structured debug JSON.
   - In Production (`APP_DEBUG=false`): Renders minimal, zero-leak production HTML or production JSON with Error ID correlation.
7. **Logging**: Server console logs `[ForgeTS Error err_<id>] [<statusCode>] <type>: <message>` with stack trace for operator analysis.

---

## 3. Framework Exception Hierarchy

All framework-specific errors inherit from `ForgeError`, extending the native JavaScript `Error`:

```
ForgeError (Base class with statusCode, code, details, cause)
|
+-- HttpError / HttpException (HTTP status-aware exceptions)
|   |-- BadRequestException (400)
|   |-- UnauthorizedException (401)
|   |-- ForbiddenException (403)
|   |-- NotFoundException (404)
|   |-- MethodNotAllowedException (405)
|   |-- UnprocessableEntityException (422)
|   |-- InternalServerErrorException (500)
|   +-- ServiceUnavailableException (503)
|
+-- ValidationError (422 - Form & Request validation failures)
|
+-- RoutingError
|   |-- RouteNotFoundException (404)
|   +-- MethodNotAllowedError (405)
|
+-- ContainerError
|   |-- BindingResolutionException (500 - Unresolvable token or interface)
|   +-- CircularDependencyException (500 - Circular injection loop)
|
+-- DatabaseError
|   |-- DatabaseConnectionException (503 - Outage or network drop)
|   |-- QueryException (500 - SQL execution error)
|   +-- ModelNotFoundException (404 - Thrown by Model.firstOrFail())
|
+-- ViewError
|   |-- ViewNotFoundException (500 - Missing template or React page)
|   +-- ViewRenderException (500 - Template compilation error)
|
+-- ConfigurationError
|   +-- ConfigurationException (500 - Missing required configuration key)
|
+-- AuthenticationError (401)
+-- AuthorizationError (403)
```

### Usage Example

```typescript
import { NotFoundException, ModelNotFoundException, DatabaseConnectionException } from '@forge/core';

// Thrown in controller or service
if (!user) {
  throw new NotFoundException('User not found');
}

// Chained exception with cause
try {
  await db.connect();
} catch (error) {
  throw new DatabaseConnectionException('Unable to establish MySQL connection', {
    cause: error,
  });
}
```

---

## 4. Secret Redaction Engine (`Redactor`)

The `Redactor` guarantees zero mutation of original error and request objects:

- **Environment Secrets**: Scans active `process.env` keys matching `SECRET`, `PASS`, `KEY`, `TOKEN`, `DB`, `AUTH`, `CREDENTIAL`, `PRIVATE`, `SIGNING`, `DATABASE` with values >= 4 characters and masks occurrences with `[REDACTED]`.
- **Database Connection URIs**: Automatically strips passwords from database URIs:
  `mysql://root:secret@127.0.0.1:3306/db` -> `mysql://root:[REDACTED]@127.0.0.1:3306/db`
- **Query Parameters**: Masks sensitive query parameters:
  `?token=sensitive_jwt&key=private_key` -> `?token=[REDACTED]&key=[REDACTED]`
- **Bearer Tokens**: Automatically redacts bearer token strings while preserving grammatical phrases like `"Missing bearer token"`.
- **Request Headers**: Redacts `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `X-CSRF-Token`, and `Proxy-Authorization`.
- **Circular Safety**: Uses `WeakSet` tracking to prevent recursive stack overflows on circular object graphs.

---

## 5. Development JSON Error Contract

For API requests in development mode (`APP_DEBUG=true`), ForgeTS provides structured JSON:

```json
{
  "statusCode": 400,
  "error": "Malformed query parameter",
  "message": "Malformed query parameter",
  "name": "BadRequestException",
  "errorDetail": {
    "type": "BadRequestException",
    "code": "ERR_BAD_REQUEST",
    "message": "Malformed query parameter",
    "status": 400,
    "details": {
      "field": "filter",
      "expected": "active|inactive"
    }
  },
  "request": {
    "id": "err_7c8d9e0f1a2b",
    "method": "GET",
    "path": "/api/users"
  },
  "route": {
    "pattern": "/api/users",
    "controller": "UserController",
    "action": "index",
    "params": {},
    "middleware": ["AuthMiddleware"]
  },
  "trace": {
    "id": "err_7c8d9e0f1a2b",
    "file": "app/controllers/UserController.ts",
    "line": 42,
    "column": 11,
    "stack": [
      "at UserController.index (app/controllers/UserController.ts:42:11)",
      "at executePipeline (packages/forge/src/http/Pipeline.ts:57:10)"
    ]
  },
  "causes": [],
  "stack": [
    "at UserController.index (app/controllers/UserController.ts:42:11)",
    "at executePipeline (packages/forge/src/http/Pipeline.ts:57:10)"
  ]
}
```

---

## 6. Production Responses (`APP_DEBUG=false`)

In production, ForgeTS delivers clean, leak-free responses correlated with server logs via the Error ID:

### Production HTTP Header
```
HTTP/1.1 500 Internal Server Error
Content-Type: application/json; charset=utf-8
X-Error-Id: err_7c8d9e0f1a2b
```

### Production JSON (HTTP 500)
```json
{
  "message": "Internal Server Error"
}
```

### Production JSON (Client Error 404)
```json
{
  "error": "Not Found",
  "message": "Not Found",
  "statusCode": 404
}
```

### Production HTML (Browser Navigation)
Displays a minimalist dark-mode page:
- HTTP Status Code: `500`
- User Message: `"Something went wrong."`
- Error ID: `"Error ID: err_7c8d9e0f1a2b"`

---

## 7. Emergency Debug Server

If a top-level compilation or syntax error occurs during application bootstrap before the router starts, `bin/serve.ts` automatically boots the Emergency Debug Server on the configured port. Browser requests receive the full dark-mode HTML debug interface, and API clients receive structured JSON diagnostics.

---

## 8. Testing Strategy

The error infrastructure is validated through 23 comprehensive scenarios in `tests/unit/ErrorInfrastructure.test.ts`:

1. Basic native JavaScript Error normalization
2. TypeError class preservation and status normalization
3. Custom `ForgeError` subclasses with code and details
4. Multi-level cause chain extraction and cycle detection
5. Missing or undefined stack trace safety
6. Corrupted and malformed stack trace parser resilience
7. Local source snippet loading with active line highlight and column caret
8. Inaccessible / missing source file safety
9. HTML development debug page rendering (Ignition interface)
10. JSON development response contract and route context
11. HTML production response zero-leak verification
12. JSON production response zero-leak verification
13. Secret redaction of process.env, connection URIs, query parameters, and tokens
14. Database connection failure (503) and `ModelNotFoundException` (404)
15. Validation errors (422) with field-level constraint preservation
16. Route not found (404) and method not allowed (405)
17. DI container `BindingResolutionException` (500)
18. View engine `ViewNotFoundException` (500)
19. Fallback renderer resilience on malicious throwing getters
20. Large stack trace handling (180+ frames)
21. Circular reference handling in context and causes
22. Sensitive request header masking
23. Content negotiation between HTML browser requests and JSON API requests
