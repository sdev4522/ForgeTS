# ForgeTS Framework — Architectural Analysis & Report (v0.1.0)

> **ForgeTS** is a batteries-included, TypeScript-first web framework running on Bun. It brings Laravel's developer experience (DX) and structure to the JavaScript/TypeScript ecosystem with maximum runtime speed.

---

## 1. High-Level Architecture Overview

ForgeTS is built on a modular, decoupled architecture where **framework engine internals** are separated cleanly from **application code**.

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
                                                    │ Active Record│   │ ViewEngine   │
                                                    │ Model (ORM)  │   │ (.html)      │
                                                    └──────┬───────┘   └──────┬───────┘
                                                           │                  │
                                                           └──────────┬───────┘
                                                                      │
                                                                      ▼
                                                         ┌───────────────────────┐
                                                         │ HTTP Response (JSON/  │
                                                         │ HTML/Redirect)        │
                                                         └───────────────────────┘
```

---

## 2. Core Subsystems & Working Methods

### 2.1 Routing & Decorator System (`packages/forge/src/routing/`)
- **TC39 Stage 3 Decorator Compliant**: Uses Bun 1.3+ native metadata context (`ClassDecoratorContext` & `ClassMethodDecoratorContext`) with zero reliance on legacy `reflect-metadata` or `experimentalDecorators`.
- **Radix Trie Route Resolution**: High-speed route matching supporting dynamic parameters (`/todos/:id`), HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`), and controller prefixes (`@Controller('/todos')`).
- **Middleware Pipeline**: Onion-architecture middleware execution supporting route-level and global middleware (`executePipeline()`).

### 2.2 Dependency Injection Container (`packages/forge/src/container/`)
- **Singleton & Transient Scopes**: Manages service lifecycle and class instances.
- **Automatic Constructor Resolution**: Recursively resolves class dependencies using `@Deps()` / `@Injectable()` decorators or explicit `.deps()` bindings.

### 2.3 Active Record ORM & Multi-Driver Database Layer (`packages/forge/src/database/`)
- **Eloquent / Lucid-inspired Model**: Abstract `Model` base class with Proxy-backed attribute access (`model._attributes`).
- **Multi-Driver Engine**:
  - **MySQL / MariaDB**: Powered by `mysql2` connection pool & Kysely `MysqlDialect`.
  - **MongoDB**: Native NoSQL document driver wrapping official `mongodb` client, sharing identical Active Record CRUD API.
  - *Note: SQLite driver was superseded and cleanly removed per ADR-003 in favor of MySQL and MongoDB.*
- **Fluent QueryBuilder**: Chainable queries (`Model.where()`, `Model.find()`, `Model.all()`, `Model.create()`, `model.save()`, `model.delete()`).
- **Auto Timestamps & Schema Migrator**: Automatically manages `created_at` / `updated_at` and runs idempotent Kysely table migrations.

### 2.4 HTML View Engine (`packages/forge/src/view/`)
- **Template Renderer**: Interpolates variables and partials in `.html` files loaded from `resources/views/`.
- **Syntax**:
  - `{{ variable }}` — HTML-escaped substitution (XSS safe).
  - `{{{ variable }}}` — Unescaped raw HTML substitution.
  - `{{@ partialName }}` — Template partial includes.

### 2.5 Unified HTTP Request & Response (`packages/forge/src/http/`)
- **Request Wrapper**: Lazily parses query parameters, headers, route params, JSON bodies, and `application/x-www-form-urlencoded` HTML form submissions.
- **ForgeResponse**: Chainable fluent response helper supporting `res.json()`, `res.view()`, `res.html()`, `res.redirect()`, `res.status()`, and custom exception error handling.

---

## 3. Directory & File Structure

```
my-framework/
├── packages/
│   └── forge/                       # Framework Core Engine (@forge/core)
│       └── src/
│           ├── core/                # Application, Provider, Exception classes
│           ├── routing/             # Router, RouteResolver, Decorators (@Controller, @Get etc.)
│           ├── container/           # DI Container & @Injectable decorators
│           ├── database/            # Active Record Model, QueryBuilder, Connection Manager
│           ├── http/                # Request, ForgeResponse, Pipeline, Middleware
│           ├── view/                # ViewEngine template renderer
│           └── config/              # ConfigManager & env loader
│
├── app/                             # Application Domain Layer
│   ├── controllers/                 # HTTP Controllers (e.g. TodoController.ts, WelcomeController.ts)
│   ├── models/                      # Active Record Models (e.g. Todo.ts)
│   ├── services/                    # Application Services (e.g. LoggerService.ts)
│   └── middleware/                  # HTTP Middleware classes
│
├── routes/                          # Route Definitions
│   ├── web.ts                       # HTML Web Routes
│   └── api.ts                       # JSON API Routes
│
├── resources/
│   └── views/                       # Server-Rendered HTML Templates
│       ├── welcome.html             # Framework Welcome Page
│       └── todos/
│           └── index.html           # Todo Application UI Template
│
├── database/
│   └── migrations/                  # Database Schema Migrations
│       └── 2026_07_29_000001_create_todos_table.ts
│
├── config/                          # Application Configuration
│   ├── app.ts                       # App Name, Port, Env config
│   └── database.ts                  # Database connection settings (MySQL / SQLite / Postgres)
│
├── public/                          # Static Web Assets (CSS, Images, Favicons)
├── storage/                         # Runtime logs, uploads, and cached artifacts
├── bootstrap/
│   └── app.ts                       # Application Wiring & Bootstrap
└── bin/
    ├── serve.ts                     # HTTP Server Launcher (bun run dev / forge serve)
    └── forge.ts                     # Framework CLI Tool
```

---

## 4. Current Features Summary

| Category | Feature | Status |
|---|---|---|
| **Runtime** | Bun 1.3+ Native HTTP Server (`Bun.serve()`) | Fully Implemented |
| **Routing** | Radix Trie, Params (`:id`), Verbs, Static Assets (`public/`) | Fully Implemented |
| **Decorators** | TC39 Stage 3 (`@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`) | Fully Implemented |
| **DI Container** | Recursive Constructor Injection & Singleton Lifecycle | Fully Implemented |
| **ORM** | Active Record (`Model.find()`, `Model.all()`, `Model.create()`, `.save()`) | Fully Implemented |
| **Database** | Multi-Driver Support: **MySQL** (relational) & **MongoDB** (document) | Fully Implemented |
| **View Engine** | Server-Side HTML Template Rendering (`res.view()`) & React SSR | Fully Implemented |
| **Form Handling** | `application/x-www-form-urlencoded` Form Submissions | Fully Implemented |
| **Error Handling** | Global Error Handler & Debug Trace Renderer (`APP_DEBUG`) | Fully Implemented |
| **Security** | CSRF middleware, rate limiting, and process secret redaction | Fully Implemented |
| **Events** | Deterministic synchronous and asynchronous event dispatching | Fully Implemented |
| **Dogfood App** | Full Todo App (HTML UI & React SSR) and Notes CRUD on MySQL | Verified & Live |

---

## 5. Execution Flow Example: `POST /todos/create`

1. **Client Action**: Browser submits HTML form at `/todos/create` with `title=Buy+groceries`.
2. **Server Listen**: `Bun.serve()` receives `globalThis.Request`.
3. **Route Match**: `RouteResolver` matches `POST /todos/create` to `TodoController.createForm`.
4. **Body Parsing**: `Application` detects `x-www-form-urlencoded` and parses body into `req.body()`.
5. **Controller Resolution**: `Container` resolves `TodoController` instance.
6. **ORM Save**: `Todo.create({ title, completed: 0, created_at })` runs Kysely `INSERT` query via `mysql2` pool on MySQL database `forgets`.
7. **Response**: `res.redirect('/todos/ui')` returns `302 Found` to browser.
