# ForgeTS Framework — Architectural Analysis & Report (v0.6.0)

> **ForgeTS** is a batteries-included, TypeScript-first web framework running on Bun. It brings Laravel's developer experience (DX) and structure to the JavaScript/TypeScript ecosystem with maximum runtime speed.

---

## 1. High-Level Architecture Overview

ForgeTS is built on a modular, decoupled architecture where **framework engine internals** (`packages/forge/src/`) are strictly separated from **application code** (`app/`, `routes/`, `resources/`, `config/`).

```
                           ┌────────────────────────────────────────┐
                           │          Client HTTP Request           │
                           └───────────────────┬────────────────────┘
                                               │
                                               ▼
                           ┌────────────────────────────────────────┐
                           │          Bun.serve() Native            │
                           └───────────────────┬────────────────────┘
                                               │
                                               ▼
                           ┌────────────────────────────────────────┐
                           │        Radix Trie Route Resolver       │
                           └───────────────────┬────────────────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         │ Static File?               Controller Route?│
                         ▼                                           ▼
             ┌───────────────────────┐                   ┌───────────────────────┐
             │ Public Asset (public/)│                   │ Middleware Pipeline   │
             │ or Vite HMR Client    │                   │ (CSRF, RateLimit, ...)│
             └───────────────────────┘                   └───────────┬───────────┘
                                                                     │
                                                                     ▼
                                                         ┌───────────────────────┐
                                                         │ DI Container Resolve  │
                                                         └───────────┬───────────┘
                                                                     │
                                                                     ▼
                                                         ┌───────────────────────┐
                                                         │ Controller Handler    │
                                                         └─────┬───────────┬─────┘
                                                               │           │
                                                               ▼           ▼
                                                    ┌──────────────┐   ┌──────────────┐
                                                    │ Active Record│   │ ForgeResponse│
                                                    │ Model (ORM)  │   │ .view()/.json│
                                                    └──────┬───────┘   └──────┬───────┘
                                                           │                  │
                                                           ▼                  ▼
                                                    ┌───────────────────────────────┐
                                                    │      serializeViewData()      │
                                                    │  (Recursively unwraps models) │
                                                    └──────────────┬────────────────┘
                                                                   │
                                                ┌──────────────────┴──────────────────┐
                                                ▼                                     ▼
                                    ┌───────────────────────┐             ┌───────────────────────┐
                                    │ ViewEngine (.html)    │             │ ReactEngine (SSR)     │
                                    │ {{ var }} template    │             │ React 19 + Hydration  │
                                    └───────────┬───────────┘             └───────────┬───────────┘
                                                │                                     │
                                                └──────────────────┬──────────────────┘
                                                                   │
                                                                   ▼
                                                    ┌───────────────────────────────┐
                                                    │ HTTP Response (HTML / JSON)   │
                                                    └───────────────────────────────┘
```

---

## 2. Core Subsystems & Working Methods

### 2.1 Routing & Decorator System (`packages/forge/src/routing/`)
- **TC39 Stage 3 Decorator Compliant**: Uses Bun 1.3+ native metadata context (`ClassDecoratorContext` and `ClassMethodDecoratorContext`) with zero reliance on legacy `reflect-metadata` or `experimentalDecorators`.
- **Radix Trie Route Resolution**: High-speed route matching supporting dynamic parameters (`/users/:id`), HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`), and controller prefixes (`@Controller('/users')`).
- **Middleware Pipeline**: Onion-architecture middleware execution supporting route-level and global middleware (`executePipeline()`).

### 2.2 Dependency Injection Container (`packages/forge/src/container/`)
- **Singleton & Transient Lifetimes**: Manages service lifecycle and class instances with O(1) map resolution.
- **Dependency Resolution**: Injects instances into controllers or resolves them explicitly via `container.resolve(Service)`.

### 2.3 Active Record ORM & Multi-Driver Database Layer (`packages/forge/src/database/`)
- **Model Base Class & Virtual Attributes**: Abstract `Model` base class featuring an ES6 Proxy wrapper. Reads and writes to attributes (e.g. `user.name`) map transparently to `this._attributes`.
- **Proxy Traps for Reflection**: The proxy implements `ownKeys`, `has`, and `getOwnPropertyDescriptor`. Operations like `Object.keys(model)` and `{ ...model }` reflect model attributes directly without exposing internal active-record state.
- **Mass-Assignment Protection**: Configurable allow-list (`fillable`) and deny-list (`guarded`), defaulting to safe automatic guarding of `id`, `created_at`, `updated_at`, `deleted_at`.
- **Multi-Driver Engine**:
  - **MySQL / MariaDB**: Powered by `mysql2` connection pool & Kysely `MysqlDialect`.
  - **MongoDB**: Native NoSQL document driver wrapping official `mongodb` client, sharing identical Active Record CRUD API.
- **Fluent QueryBuilder**: Chainable queries (`Model.where()`, `Model.whereBetween()`, `Model.orderBy()`, `Model.limit()`, `Model.offset()`, `Model.with()`, `Model.find()`, `Model.findOrFail()`, `Model.all()`, `Model.create()`, `model.save()`, `model.delete()`).
- **Automatic Timestamps & Serialization**: Manages `created_at` / `updated_at` with driver-aware timezone formatting.

### 2.4 HTTP Layer & Serialization Boundary (`packages/forge/src/http/`)
- **Request Wrapper**: Lazily parses query parameters, headers, route params, JSON bodies, and `application/x-www-form-urlencoded` HTML form submissions.
- **ForgeResponse**: Chainable fluent response helper supporting `res.json()`, `res.view()`, `res.html()`, `res.redirect()`, `res.status()`, `res.cookie()`, and shortcut helpers (`res.created()`, `res.noContent()`, `res.notFound()`).
- **Status Normalization**: `normalizeHttpStatus()` guarantees all status codes comply with the Web / Fetch specification, preventing runtime server panics from invalid or unassigned codes.
- **View Data Serializer (`serializeViewData`)**: A dedicated serialization boundary between controllers and views. Recursively unwraps Active Record `Model` instances via `.toJSON()` before passing props to `ReactEngine` or `ViewEngine`. Prevents internal instance methods and `_attributes` from leaking into React SSR markup and client hydration payloads.

### 2.5 Dual View Engines (`packages/forge/src/view/` and `packages/forge/src/ssr/`)
- **Server HTML View Engine (`ViewEngine`)**: Interpolates variables and partials in `.html` files loaded from `resources/views/` (`{{ variable }}`, `{{{ variable }}}`, `{{@ partialName }}`).
- **React 19 Server-Side Rendering (`ReactEngine`)**:
  - Automatically resolves components from `resources/js/pages/*.tsx`.
  - Development mode: Powered by Vite in middleware mode (`vite.ssrLoadModule()`) with React Fast Refresh.
  - Production mode: Precompiled server bundle (`dist/server/entry-server.js`) with client asset manifest lookups and targeted `<link rel="modulepreload">` chunk tags.
  - Hydration handshake: Serializes safe props into `<script type="application/json" id="__FORGETS_DATA__">` for deterministic client hydration via `resources/js/entry-client.tsx`.

### 2.6 Development Supervisor (`bin/dev.ts`)
Distinguishes three reload domains:
1. **Backend Application**: Watched and debounced with automatic child process restart (`Bun.spawn`).
2. **Frontend React Pages**: Handled natively by Vite HMR without backend restart.
3. **Framework Engine**: Automatically watched during framework development for rapid iteration.

### 2.7 Security & Diagnostics
- **CSRF Protection (`CsrfMiddleware`)**: Session-based verification with `forge_session` cookie; validates `_token` on write methods and rejects mismatches with HTTP 419.
- **Sliding-Window Rate Limiting (`RateLimiter`, `@RateLimit`)**: Memory-based IP rate limiter with HTTP 429 and `Retry-After` header.
- **Password Hashing (`Hash`, `hash`)**: Native SIMD Argon2id password hashing via `Bun.password`.
- **ErrorDisplayEngine**: Ignition-style interactive HTML stack traces with code snippets and automatic process secret redaction (`APP_DEBUG=true`).

---

## 3. Directory & File Structure

```
ForgeTS/
├── packages/
│   └── forge/                       # Framework Core Engine (@forge/core, @forge/database)
│       └── src/
│           ├── core/                # Application, Provider, time utilities
│           ├── routing/             # Router, RouteResolver, decorators (@Controller, @Get etc.)
│           ├── container/           # DI Container & @Injectable decorator
│           ├── database/            # Active Record Model, QueryBuilder, Connection, Drivers
│           ├── http/                # Request, ForgeResponse, Pipeline, Middleware, serializer
│           ├── ssr/                 # ReactEngine, ViteDevServer
│           ├── view/                # ViewEngine template renderer
│           ├── config/              # ConfigManager, env loader, bootstrapEnv
│           ├── events/              # EventDispatcher
│           └── security/            # Native Argon2id Hash helper
│
├── app/                             # Application Domain Layer
│   ├── controllers/                 # HTTP Controllers (WelcomeController, UserController)
│   ├── models/                      # Active Record Models (User)
│   ├── services/                    # Application Services (@Injectable classes)
│   └── middleware/                  # HTTP Middleware classes
│
├── routes/                          # Route Definitions
│   ├── web.ts                       # HTML / Session Web Routes (with CsrfMiddleware)
│   └── api.ts                       # Stateless JSON API Routes
│
├── resources/
│   ├── js/                          # React SSR
│   │   ├── pages/                   # React SSR Pages (welcome.tsx, user.tsx)
│   │   ├── types/                   # Shared frontend PageProps interfaces
│   │   ├── entry-client.tsx         # Client Hydration Entrypoint
│   │   └── entry-server.tsx         # SSR Production Build Entrypoint
│   └── views/                       # Server HTML Shells
│       └── app.html                 # Master React SSR Shell Document
│
├── database/
│   └── migrations/                  # Database Schema Migrations
│
├── config/                          # Application Configuration
│   ├── app.ts                       # App Name, Port, Env config
│   └── database.ts                  # Database connection settings (MySQL / Mongo)
│
├── public/                          # Static Web Assets (CSS, Images, Favicons)
├── storage/                         # Runtime logs, uploads, and cached artifacts
├── bootstrap/
│   ├── app.ts                       # Application Wiring & Bootstrap
│   └── env.ts                       # Early Environment Bootstrapper
└── bin/
    ├── dev.ts                       # Development Supervisor with Auto-Restart
    ├── serve.ts                     # Standalone HTTP Server Launcher
    └── forge.ts                     # Framework CLI Tool
```

---

## 4. Execution Flow Example: `GET /users` (React SSR)

1. **Client Request**: Browser requests `GET /users`.
2. **Server Listen**: `Bun.serve()` receives `globalThis.Request`.
3. **Route Match**: Radix Trie `RouteResolver` matches path to `UserController.index`.
4. **Middleware Pipeline**: `CsrfMiddleware` verifies or issues the session cookie `forge_session` and attaches `_csrfToken` to the request.
5. **Controller Execution**: `UserController.index(req, res)` executes:
   ```typescript
   const users = await User.all();
   return res.view('user', { userData: users });
   ```
6. **Data Sanitization Boundary**: `ForgeResponse.view()` receives `{ userData: users }`.
   - `serializeViewData()` unwraps the array of `User` instances by executing each model's `.toJSON()` method.
   - Attaches `csrf_token` and `csrf_field`.
7. **SSR Render**: `ReactEngine.renderPage('user', viewData)`:
   - Development: Compiles and executes `resources/js/pages/user.tsx` via `vite.ssrLoadModule()`.
   - Production: Executes precompiled SSR module and looks up asset hashes in `manifest.json`.
   - Renders markup string via `ReactDOMServer.renderToString(<UserPage {...safeProps} />)`.
8. **Shell Assembly**: Injects rendered HTML, page title, and escaped JSON payload into `resources/views/app.html`.
9. **Transmission**: `ForgeResponse.toNativeResponse()` returns `200 OK` with `Content-Type: text/html`.
10. **Client Hydration**: Browser receives HTML, downloads `entry-client.tsx`, reads `__FORGETS_DATA__`, and hydrates the DOM tree without mismatch warnings.
