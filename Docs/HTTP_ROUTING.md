# HTTP, Controllers, Routing & Security in ForgeTS

> Comprehensive guide to HTTP request handling, response building, routing, TC39 Stage 3 decorators, validation, CSRF, and rate limiting in ForgeTS.

---

## 1. Overview

ForgeTS runs directly on `Bun.serve()` with an in-memory radix trie route resolver. It does not use intermediate server abstractions (like Express or Koa).

Each incoming request is wrapped in a lightweight `Request` instance, routed through an onion-style middleware pipeline, executed by the designated controller action, and returned via `ForgeResponse`.

---

## 2. Controllers & Routing Decorators

ForgeTS uses ECMAScript standard **TC39 Stage 3 Decorators**. Decorator metadata is stored cleanly in `context.metadata` with zero global prototype pollution.

### Controller Definition
```typescript
// app/controllers/UserController.ts
import { Controller, Get, Post, Put, Delete, Middleware } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { User } from '@/models/User.js';

@Controller('/users')
export class UserController {
  /** GET /users — List all records */
  @Get('/')
  async index(req: Request, res: ForgeResponse) {
    const users = await User.all();
    if (req.wantsJson()) {
      return res.json(users);
    }
    return res.view('user', { userData: users });
  }

  /** GET /users/:id — Show single record */
  @Get('/:id')
  async show(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) return res.notFound('User not found');
    return res.json(user);
  }

  /** POST /users — Create record */
  @Post('/')
  async store(req: Request, res: ForgeResponse) {
    const data = await req.validate({
      name: 'required|string|min:2',
      email: 'required|email',
      password: 'required|string|min:8',
    });

    const user = await User.create(data);
    return res.created(user);
  }

  /** PUT /users/:id — Update record */
  @Put('/:id')
  async update(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) return res.notFound('User not found');

    const data = await req.validate({
      name: 'string|min:2',
      email: 'email',
    });

    await user.update(data);
    return res.json(user);
  }

  /** DELETE /users/:id — Destroy record */
  @Delete('/:id')
  async destroy(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) return res.notFound('User not found');

    await user.delete();
    return res.noContent();
  }
}
```

### Supported Method Decorators
- `@Get(path = '')`
- `@Post(path = '')`
- `@Put(path = '')`
- `@Patch(path = '')`
- `@Delete(path = '')`
- `@Head(path = '')`
- `@Options(path = '')`

---

## 3. Route Registration (`routes/web.ts` and `routes/api.ts`)

Controllers are registered on `Router` instances and mounted in `bootstrap/app.ts`:

```typescript
// routes/web.ts
import { Router, CsrfMiddleware } from '@forge/core';
import { WelcomeController } from '@/controllers/WelcomeController.js';
import { UserController } from '@/controllers/UserController.js';

const router = new Router();

// Apply CSRF protection to web routes
router.middleware(CsrfMiddleware);

router.controller(WelcomeController);
router.controller(UserController);

export default router;
```

```typescript
// routes/api.ts
import { Router } from '@forge/core';
import { UserController } from '@/controllers/UserController.js';

const router = new Router();

// API routes are stateless and exempt from CSRF
router.controller(UserController);

export default router;
```

### Route Groups
```typescript
router.group({ prefix: '/admin', middleware: [AuthMiddleware] }, () => {
  router.controller(AdminDashboardController);
  router.controller(AdminUsersController);
});
```

---

## 4. The Request Object

The `Request` instance provides typed, lazily computed access to incoming request data:

| Property / Method | Return Type | Description |
|---|---|---|
| `req.method` | `string` | HTTP verb (`'GET'`, `'POST'`, etc.) |
| `req.path` | `string` | Request pathname (e.g. `'/users/42'`) |
| `req.fullUrl` | `string` | Complete raw URL |
| `req.params` | `Record<string, string>` | Route parameters (e.g. `{ id: '42' }`) |
| `req.param(name)` | `string \| undefined` | Retrieve a specific route parameter |
| `req.query` | `Record<string, string \| string[]>` | Parsed query string parameters |
| `req.headers` | `Record<string, string>` | Lowercased header map |
| `req.header(name)` | `string \| undefined` | Case-insensitive header lookup |
| `req.body<T>()` | `T` | Pre-parsed body object (JSON or form-urlencoded) |
| `req.json<T>()` | `Promise<T>` | Read raw body as JSON |
| `req.text()` | `Promise<string>` | Read raw body as plain string |
| `req.wantsJson()` | `boolean` | `true` if `Accept` includes `application/json` |
| `req.isJson()` | `boolean` | `true` if `Content-Type` is `application/json` |
| `req.ip()` | `string` | Client IP address (with proxy header inspection) |
| `req.bearerToken()` | `string \| null` | Bearer token from `Authorization` header |

---

## 5. Input Validation

Call `req.validate(rules)` inside controller handlers. ForgeTS validates input using pipe-separated rule strings or Zod schemas, returning only the validated fields:

```typescript
const data = await req.validate({
  title: 'required|string|min:3|max:100',
  email: 'required|email',
  age: 'numeric|min:18',
  subscribe: 'boolean',
});
```

### Supported Validation Rules
- `required`: Field must be present and not empty string/null/undefined.
- `string`: Value must be of type string.
- `numeric`: Value must be a valid number or numeric string.
- `boolean`: Value must be boolean or boolean-coercible (`true`, `false`, `1`, `0`).
- `email`: Value must match standard email address format.
- `min:N`: Minimum numeric value, string character length, or array count.
- `max:N`: Maximum numeric value, string character length, or array count.

### Validation Errors
On failure, `req.validate()` throws `ValidationError` with HTTP 422 Unprocessable Entity and structured error messages:
```json
{
  "message": "The given data was invalid.",
  "statusCode": 422,
  "errors": {
    "email": ["The email field is required."],
    "password": ["The password must be at least 8 characters."]
  }
}
```

---

## 6. ForgeResponse Building

`ForgeResponse` provides a fluent, chainable API:

### Status Codes and Headers
```typescript
res.status(200);
res.header('X-Custom-Header', 'Value');
```

Status codes are automatically normalized via `normalizeHttpStatus()`, preventing runtime errors from invalid or out-of-range codes.

### Response Payloads
```typescript
// JSON response
return res.json({ success: true });

// Shortcut responses
return res.created(newUser);                  // 201 Created
return res.noContent();                       // 204 No Content
return res.notFound('User not found');        // 404 Not Found
return res.badRequest('Invalid payload');     // 400 Bad Request
return res.unauthorized('Login required');    // 401 Unauthorized
return res.forbidden('Access denied');        // 403 Forbidden
return res.unprocessable('Invalid data');     // 422 Unprocessable Entity
return res.serverError('Server error');       // 500 Internal Server Error

// Plain text and raw HTML
return res.text('Plain text');
return res.html('<h1>Custom HTML</h1>');

// View & React SSR rendering
return res.view('welcome', { appName: 'ForgeTS' });

// Redirects
return res.redirect('/login');                // 302 Temporary Redirect
return res.permanentRedirect('/new-path');     // 301 Permanent Redirect
```

### Cookies
```typescript
// Set cookie
res.cookie('theme', 'dark', {
  maxAge: 86400,
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
});

// Clear cookie
res.clearCookie('theme');
```

---

## 7. Security: CSRF & Rate Limiting

### CSRF Protection (`CsrfMiddleware`)
`CsrfMiddleware` implements secure session token verification:
- Generates a cryptographically secure 32-byte session token stored in the `forge_session` cookie (`HttpOnly`, `SameSite=Lax`).
- Automatically injects `csrf_token` and `csrf_field` into all view templates and React page props.
- On state-modifying HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`), checks `_token` in request body, query parameter, or `X-CSRF-TOKEN` / `X-XSRF-TOKEN` headers.
- If tokens do not match, immediately returns **HTTP 419 Page Expired**.
- Stateless API routes starting with `/api/` are automatically exempt.

### Sliding-Window Rate Limiting (`@RateLimit`)
Rate limit any controller or individual handler using `@RateLimit(maxAttempts, windowSeconds)`:

```typescript
@RateLimit(5, 60) // Max 5 requests per 60 seconds per IP
@Post('/login')
async login(req: Request, res: ForgeResponse) {
  // Authentication logic
}
```

When the limit is exceeded, the framework returns **HTTP 429 Too Many Requests** with `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining: 0` headers.
