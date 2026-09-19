# PROJECT.md — ForgeTS Overview & Architecture Decisions

**Every AI session working on this codebase must read this file first, in full, before
touching any code. Also read RULES.md — that governs HOW you work; this file governs
WHAT you're building.**

---

## 1. What ForgeTS Is

ForgeTS is a batteries-included, TypeScript-first backend web framework running on Bun.
The pitch: **Laravel's developer experience, brought to the JS/TS ecosystem.**

**The problem it solves:** JS backend development is fragmented — developers assemble Express +
a separate ORM + a separate validation lib + a separate DI system + a separate CLI
generator, all with different conventions. Laravel (PHP) proves that a unified,
opinionated, "batteries-included" framework dramatically improves developer velocity.
ForgeTS aims to be that for TypeScript.

**Target user:** JS/TS developers (often coming from Next.js/Express) who want Rails/
Laravel-style structure and conventions, without leaving the JS ecosystem or learning PHP.

---

## 2. Architecture Decisions (Frozen — Verified as of v0.1 close)

| Decision | Choice | Why |
|---|---|---|
| Runtime | Bun | Speed, built-in SQLite, native TS execution |
| Decorators | **TC39 Stage 3** (NOT legacy `experimentalDecorators`) | Bun 1.3+ uses Stage 3 by default; framework uses `ctx.metadata` internally |
| DI metadata | Custom metadata via TC39 `context.metadata` | Legacy `reflect-metadata` approach is incompatible with Stage 3 decorators |
| SQL query layer | Kysely | Type-safe, mature, avoids building custom query builder SQL generators |
| Database drivers | MySQL (`mysql2`) and MongoDB (`mongodb` 6.12.0) | MySQL for relational SQL database storage; MongoDB for NoSQL document stores (SQLite driver superseded and cleanly removed). Both drivers fully integrated with a 100% unified Active Record API surface. |
| ORM pattern | Active Record (`User.find()`, `user.save()`), wrapping Kysely | Familiar to Laravel/Rails developers |
| View layer | Built-in server HTML View Engine (`resources/views/`, `{{ }}`/`{{{ }}}`/`{{@ }}` syntax) + React SSR planned (v0.3) | Simple HTML templates out-of-the-box via `res.view()`; React SSR is additive in v0.3, not a replacement |
| File naming | PascalCase with type-implied context: `TodoController.ts`, `Todo.ts` | Matches Laravel-familiar conventions for the target audience |
| Folder naming | plural: `controllers/`, `models/`, `services/`, `middleware/` | |
| Import aliases | `@forge/core`, `@forge/database`, `@/controllers/*`, `@/models/*`, `@/services/*`, `@/middleware/*`, `@/config/*`, `@/routes/*`, `@/components/*`, `@/pages/*`, `@/lib/*`, `@/types`, `@app/*`, `@config/*`, `@database/*`, `@routes/*`, `@resources/*` | Framework internals import via `@forge/*`; app code uses stable semantic aliases across TypeScript, Bun, Vite, and SSR |

---

## 3. Canonical Folder Structure (Single Source of Truth — verified, no duplicates)

```
my-framework/
  packages/
    forge/src/         <- FRAMEWORK CORE ENGINE ONLY (@forge/core, @forge/database).
                           Zero app-specific logic. Publishable as standalone npm
                           package(s) in the eventual two-repo split.
      core/             <- Application, Provider, Exception classes
      routing/          <- Router, RouteResolver, decorators (@Controller, @Get, etc.)
      container/        <- DI Container & @Injectable decorators
      database/         <- Active Record Model, QueryBuilder, Connection Manager
      http/             <- Request, ForgeResponse, Pipeline, Middleware
      view/             <- ViewEngine template renderer
      config/           <- ConfigManager & env loader
  app/                  <- APPLICATION LAYER — real developer-facing conventions.
                           Minimal, professional framework starter.
                           Zero demo business domains. Seeds the starter-skeleton
                           repo (`forgets/starter`, mirroring Laravel's laravel/laravel)
                           with a single WelcomeController landing page.
    controllers/
      WelcomeController.ts
    models/
    services/
    middleware/
  routes/               <- Route definitions (web.ts, api.ts)
  resources/
    js/
      pages/             <- React SSR pages (welcome.tsx)
      entry-client.tsx   <- Framework-managed client hydration entrypoint
      entry-server.tsx   <- Framework-managed SSR build entrypoint
    views/
      app.html           <- React SSR master shell document
  database/
    migrations/          <- Database schema migrations (empty starter)
  config/                <- Configuration files (app.ts, database.ts)
  bootstrap/             <- App bootstrap (app.ts)
  bin/                   <- CLI & Server entry points (dev.ts, serve.ts, forge.ts)
```

**Note on history:** an earlier `src/core/` directory (created during an intermediate
rebuild attempt) was audited, confirmed to have zero live imports anywhere in the
active codebase, and deleted along with `tsconfig.src.json` and legacy `src:dev`/
`src:serve` scripts. `packages/forge/src/` has always been — and remains — the only
active runtime framework engine. All app-layer imports now use the `@forge/core` /
`@forge/database` aliases rather than relative paths.

**Note on `app/` naming:** an earlier decision renamed this to `src/example/` to avoid
confusion with a "real app." That decision was explicitly superseded by direct
instruction to build the default application using the framework's actual real-world
conventions, to prove the DX works the way a real developer would experience it.
`app/` is intentional and permanent — not a leftover.

**Note on Starter Cleanup (v0.4 Pass):** All demonstration business domains (`Todo`,
`Note`, `LogEntry`, `User`, `DocsController`, `HealthController`, and demo migrations/pages)
have been cleanly removed from the default application. ForgeTS now starts as a minimal,
professional starter skeleton with exactly one default welcome experience (`WelcomeController`
rendering `resources/js/pages/welcome.tsx` inside the `app.html` shell).

---

## 4. Roadmap Status

- **v0.1 — Core Engine & Application Skeleton** — **COMPLETED & VERIFIED**
  - Router + TC39 Stage 3 Decorators — [Completed]
  - DI Container — [Completed]
  - Request / Response wrappers + Form Body Parser — [Completed]
  - Global Error Handler + Debug Display Engine (`APP_DEBUG`) — [Completed]
  - DatabaseDriver interface + SQLDriver (Kysely + **SQLite and MySQL, both verified
    end-to-end with identical CRUD behavior**) — [Completed]
  - Active Record Model base class (`Model`) — [Completed]
  - Server-Side HTML View Engine (`res.view()`) — [Completed]
  - CLI Scaffolding (`forge serve`, `make:controller`, `make:model`, `make:migration`,
    `make:service`, `make:middleware`, `routes:list`) — [Completed]
  - Dogfood Application (Todo App, HTML UI + JSON API, verified on both SQLite and
    MySQL) — [Completed, superseded by v0.4 starter cleanup]
  - Single-source architecture cleanup (orphaned `src/core/` removed, aliases
    standardized) — [Completed]

- **v0.2 — Security & Stability** — **COMPLETED & VERIFIED**
  - Task 0: Global Error Handler Verification — [Completed] Verified `APP_DEBUG=true` JSON/HTML and `APP_DEBUG=false` production response.
  - Task 1: Input Validation Layer — [Completed] Implemented pipe-separated rules (`required`, `email`, `min:N`, `max:N`, `numeric`, `string`, `boolean`), `req.validate()`, `ValidationError` 422 JSON formatting.
  - Task 2: Mass-Assignment Protection — [Completed] Implemented `fillable`/`guarded` in `Model`, safe default Option A (guarding `id`, `created_at`, `updated_at`, `deleted_at`), verified unauthorized field stripping.
  - Task 3: CSRF Protection — [Completed] Implemented `CsrfMiddleware`, `forge_session` cookie, automatic `csrf_field`/`csrf_token` view injection, HTTP 419 rejection on mismatch.
  - Task 4: Rate Limiting Middleware — [Completed] Implemented `RateLimiter` sliding-window engine, `@RateLimit(maxAttempts, windowSeconds)` decorator, HTTP 429 response with `Retry-After` header.
  - Task 5: Password Hashing Helper — [Completed] Implemented `Hash` class & `hash` helper using SIMD-accelerated native Argon2id (`Bun.password`), verified round-trip `make()` and `verify()` success/failure.
  - Task 6: Secrets Redaction — [Completed] Implemented `ErrorDisplayEngine.redactSecrets()` scanning `.env` values, verified `[REDACTED]` replacement for process secrets in debug error outputs.

- **v0.3 — React + Vite SSR** — **COMPLETED & VERIFIED**
  - Security & Access Control Regression Suite — [Completed] Created `tests/integration/SecurityAccessControl.test.ts` (`bun run test:security`), verified 404 responses for `/packages/forge/src/view/ViewEngine.ts`, `/config/database.ts`, `/.env`, and `/package.json`, and 200 OK for `/`.
  - Task 1: Vite Dev Server Integration (Middleware Mode) — [Completed] Created `vite.config.ts`, `ViteDevServer.ts`, integrated Vite middleware mode.
  - Task 2: Page Resolution + SSR Render Pipeline — [Completed] Implemented `ReactEngine.ts`, updated `res.view()` to resolve `resources/js/pages/*.tsx` first, verified server-rendered HTML payload via `curl`.
  - Task 3: Client-Side Hydration — [Completed] Implemented `resources/js/entry-client.tsx`, serialized `{ page, props }` in `__FORGETS_DATA__` script tag, verified hydration in Chrome browser with zero console hydration warnings.
  - Task 4: Production Build Pipeline — [Completed] Created `resources/js/entry-server.tsx`, configured Vite client manifest & SSR bundle builds (`bun run build`), verified production bundle size reduction (`entry-client-*.js` ~384 KB / 116 KB gzip vs 964 KB dev bundle), updated production server path to load compiled SSR bundle (`dist/server/entry-server.js`) & manifest assets (`dist/client/manifest.json`) without Vite dev server, verified `NODE_ENV=production` execution.
  - Task 5: SEO Meta Tags — [Completed] Implemented chainable `res.view().meta({ title, description })` API on `ForgeResponse`, injected `<title>` and `<meta name="description">` tags into `<head>` of SSR shell document, verified raw crawlable HTML via `curl`.

- **v0.4 — SSR Polish & DX** — **COMPLETED & VERIFIED**
  - Task 1: HTML Error Page for Browser-Rendered Routes — [Completed] Enhanced `Application.handleError()` request type detection to distinguish HTML browser navigation (`Accept: text/html`) from API requests (`Accept: application/json` or `/api/*`), integrated `ErrorDisplayEngine.renderHtml()` for debug mode (`APP_DEBUG=true`) with secrets redaction & code snippets, and `ErrorDisplayEngine.renderProductionHtml()` for production mode (`APP_DEBUG=false`), preserved JSON error format unchanged.
  - Task 2: Client Hydration Mismatch Guidance — [Completed] Added dev-mode console interceptor wrapper around `hydrateRoot` in `resources/js/entry-client.tsx`, re-logging clearer `[ForgeTS Hydration Warning]` framework guidance alongside React's original warning, disabled in production.
  - Task 3: Single-Shot Full CRUD Scaffolder (`forge make:page <name> --crud`) — [Completed] Added `forge make:page <PageName> [--crud]` command to `bin/forge.ts`, scaffolding Model, Migration, Controller, 4 React Pages (`index`, `create`, `edit`, `show`), and web route registration with overwrite safety warnings.
  - Task 4: Per-Page Code Splitting — [Completed] Configured dynamic `import()` page component resolution in `resources/js/entry-client.tsx`, verified Vite client build output produces separate page chunks (`dist/client/assets/*.js`), added targeted `<link rel="modulepreload">` injection in `ReactEngine.ts` for production page rendering.
  - Task 5: Starter Application Architecture Cleanup — [Completed] Purged dogfooding demo domains (`Todo`, `Note`, `LogEntry`, `User`, `DocsController`, `HealthController`, and demo pages/migrations) from the default application. Established a single default welcome experience (`WelcomeController` rendering `resources/js/pages/welcome.tsx` inside `resources/views/app.html`).

- **Database Architecture Refactor (Removing SQLite, Adding MongoDB, Fail-fast Resilience & Unified Active Record API)** — **COMPLETED & VERIFIED**
  - Task 1: Clean Removal of SQLite Driver — [Completed] Removed `bun:sqlite` engine, `ForgeBunSqliteDialect`, `BunConnection`, `BunDriver`, removed `kysely-bun-sqlite` dependency, updated `.env.example` and `config/database.ts` (MySQL default).
  - Task 2: Native MongoDB Driver & Unified Active Record API — [Completed] Created `DatabaseDriver` interface & `MongoDriver` implementation wrapping official `mongodb` package (`^6.12.0`), added unified Active Record API surface (`.find()`, `.where()`, `.create()`, `.save()`, `.delete()`) across both MySQL and MongoDB models.
  - Task 3: Boot-Time Fail-Fast Check & Request-Time 503 Handling — [Completed] Implemented `verifyDatabaseConnectionOnBoot()` in `Connection.ts` and `Application.start()` (logs redacted connection details and exits with code 1 if DB is unreachable); updated `Application.handleError()` to catch mid-request database outages and return HTTP **503 Service Unavailable** (verified with live test outputs).
  - Task 4: Load Testing & Connection Pool Backpressure — [Completed] Tested MySQL and MongoDB endpoints under 10, 100, 500, 1000 concurrent connections via `autocannon` (peak 30,977 Req/sec, 0% error rate, zero process crashes under 1000 connections).
  - Task 5: Database DateTime/Timestamp Generic Serialization — [Completed] Established generic serialization contract between ORM Models, QueryBuilder, and database drivers (`packages/forge/src/database/serializer.ts`). MySQL DATETIME columns receive explicit `YYYY-MM-DD HH:mm:ss[.sss]` representations in the configured timezone (`app.timezone`, default UTC with pool `timezone: 'Z'`), while MongoDB preserves native Date objects. Handles automatic `created_at`/`updated_at` timestamps, explicit Date objects, ISO-8601 strings, `where` queries, `null` values, and throws explicit `TypeError` on invalid Date objects. API responses cleanly serialize hydrated Date objects to standard ISO-8601 strings via `Date.prototype.toJSON()`.

- **v0.5 — Batteries Included** (queues, storage, mail, cache, events) — NOT STARTED

---

## 5. Explicit Non-Goals (Don't Build These Unless Asked)

- SQL-style JOINs ($lookup aggregations) across MongoDB models (Mongo models focus on document CRUD & aggregations; relations remain out of scope for v0.4)
- Streaming SSR, RSC (v0.5+ only)
- Queue systems, mailers, cache layers, file storage (v0.5 only)
- Any new architecture pattern not listed in Section 2 — ask before introducing one
- Any new top-level directory or monorepo package not listed in Section 3 — ask first

---

## 6. Process Notes (Lessons From v0.1 — Apply Going Forward)

- **Dependency additions must be flagged explicitly before running the install
  command** (RULES.md Rule 4). During v0.1, `mysql2` was added without this callout —
  not a major issue, but the pattern should not repeat in v0.2+.
- **Architecture changes (new folders, renames, restructures) need one explicit
  decision point, not incremental drift across prompts.** The `packages/` vs `src/`
  dual-layout situation happened incrementally rather than as a single confirmed
  decision — it was caught and cleaned up via audit, but catching it earlier would
  have saved rework.
- **When a prior explicit decision is being overridden by a new instruction (like the
  `example/` → `app/` reversal), say so explicitly in the response** ("this supersedes
  the earlier rename decision") rather than silently doing it — makes the history
  traceable without needing a full audit later.
- **Strict Prohibition on Emojis (RULES.md Rule 8)**: As part of repository
  professionalization, all emoji decorations have been removed and prohibited from
  future technical documentation, source code, comments, and CLI outputs. Plain text
  conventions and standard badges must be used.
- **Portability & Environment Genericity (RULES.md Rule 9)**: Machine-specific paths,
  developer usernames, local timezones, and uncontrolled localhost addresses must never
  be embedded in framework source, configurations, or unit test assertions. Generic
  framework tests must use neutral fixtures, dynamic path derivation, and synthetic
  domains (`http://example.test`).
- **Prohibition on Default Application Demo Domains (RULES.md Rule 10)**: The default
  application must remain minimal, clean, and production-oriented. Never add fake
  business domains (Todo, Note, User, Log, Docs) to `app/`, `routes/`, or
  `database/migrations/`. Tests must use isolated fixtures, and the welcome page must
  remain a single, clean landing page.
- **Rule: The default application is not a demo application**: The starter ships with
  exactly one controller (`WelcomeController`), one web route (`GET /`), and the React
  SSR landing shell (`resources/views/app.html` + `resources/js/pages/welcome.tsx`).
- **Rule: Supported database drivers are not automatically required database services**:
  The framework provides built-in drivers for MySQL and MongoDB, but only the active
  connection selected by `database.default` (`DB_CONNECTION`) is verified during boot.
  Configuring `DB_CONNECTION=none` cleanly bypasses boot verification for applications
  operating without a database.
- **Authoritative APP_DEBUG Lifecycle**: Early environment bootstrapping (`bootstrapEnv`)
  populates `process.env` before static configuration modules evaluate. Safe parsing
  (`env.boolean`) enforces explicit falsy values (`false`, `0`, `no`, `off`) and
  defaults to `false` for secure production setups. `APP_DEBUG=true` enables the rich
  HTML error page; `APP_DEBUG=false` serves clean, zero-leak production 500 error pages.
- **Compiler & Build Diagnostics Engine**: Bun compiler messages (`BuildMessage`) and
  `AggregateError` failures are normalized into structured diagnostics. Line numbers,
  columns, and source context snippets with pointer carets are extracted and rendered
  with interactive multi-error inspection tabs.
- **Framework-Managed SSR Plumbing**: `resources/js/entry-client.tsx` and
  `resources/js/entry-server.tsx` serve as Vite build and hydration infrastructure.
  Application developers write pages under `resources/js/pages/` without modifying
  the SSR entrypoints.

---

## 7. Session Startup Checklist for AI Agents

Before starting any task in a new session:
1. Read this file (PROJECT.md) fully.
2. Read RULES.md fully.
3. Confirm which roadmap version/task you're being asked to work on (Section 4).
4. If the task conflicts with anything in Section 2, 3, or 5, stop and ask before
   proceeding — do not silently resolve the conflict yourself.

---

## 7.5 Development Runtime & Hot Reload Architecture

ForgeTS development runtime (`bun run dev` / `forge dev`) distinguishes three reload domains:
1. **Backend / Application Changes** (`app/**/*.ts`, `routes/**/*.ts`, `config/**/*.ts`, `bootstrap/**/*.ts`, `.env`):
   - Managed by the native development supervisor (`bin/dev.ts`).
   - Watches backend directories via `node:fs.watch({ recursive: true })` and debounces rapid saves (150ms).
   - Automatically stops the child process cleanly (`SIGTERM` calling `app.stop()` to free server ports and file handles) and respawns a clean process with `Bun.spawn`.
   - Ensures TC39 Stage 3 decorator metadata, the route radix trie, and DI singletons are cleanly re-evaluated from scratch without stale module caching.
2. **Frontend React Changes** (`resources/js/pages/**/*.tsx`, components, styles):
   - Managed natively by Vite HMR and Vite SSR middleware mode.
   - Vite pushes WebSocket HMR updates directly to the browser and invalidates SSR modules on the fly via `vite.ssrLoadModule()`.
   - Excluded from backend supervisor restarts to maximize developer velocity.
3. **Framework Core Changes** (`packages/forge/src/**/*.ts`):
   - Watched by the supervisor, enabling rapid framework dogfooding and core engineering with instant process respawn.

---

## 8. Production Readiness Baseline (Updated Post-Database Refactor)

### Performance & Throughput Baseline
- **Cold-Start Time (Process boot → HTTP ready)**: **422.37 ms** (average of 3 production runs).
- **Memory Footprint & GC Stability**: Heap plateaus cleanly at ~26–27 MB under sustained load; zero unbounded memory leaks detected.

#### MySQL Database Engine (`Todo` SQL Model)
- **Peak Read Throughput (`GET /todos`)**: **20,731 Req/sec** (c=10) / **14,663 Req/sec** (c=1000, p50: 58 ms, p99: 239 ms).
- **Peak Write Throughput (`POST /todos`)**: **16,144 Req/sec** (c=10) / **12,234 Req/sec** (c=1000, p50: 76 ms, p99: 293 ms).
- **Pool Stability & Error Rate**: **0.0% Error Rate**, **0 Crashes** under 1,000 concurrent connections.

#### MongoDB Document Engine (`LogEntry` NoSQL Model)
- **Peak Read Throughput (`GET /logs`)**: **30,977 Req/sec** (c=10) / **23,092 Req/sec** (c=1000, p50: 40 ms, p99: 74 ms).
- **Peak Write Throughput (`POST /logs`)**: **19,204 Req/sec** (c=10) / **12,194 Req/sec** (c=1000, p50: 77 ms, p99: 324 ms).
- **Pool Stability & Error Rate**: **0.0% Error Rate**, **0 Crashes** under 1,000 concurrent connections.

### Client Asset & Bundle Baseline
- **Client Entry Bundle (`entry-client.js`)**: **3.50 KB** raw / **1.33 KB** gzip.
- **Total Client Assets (All 12 page chunks + CSS)**: **60.18 KB** raw / **17.16 KB** gzip.

### Documented Limits & Historical Rationale
1. **SQLite Removal Rationale (Historical)**:
   - Under heavy concurrent WRITE load (`POST /todos` at >100 connections), SQLite single-writer WAL file lock contention degraded write latency (p50: 45 ms at c=100 → 548 ms at c=1000). SQLite has been explicitly removed (ADR-003 superseded) in favor of MySQL for relational SQL storage and MongoDB for document storage.
2. **CSRF & Rate Limiting Guarding**:
   - Web routes are protected by `CsrfMiddleware` and `@RateLimit`, preventing external automated write floods from overwhelming application controllers.

### Candidate Dependencies for Cleanup (v0.5)
- **`reflect-metadata` (0.23 MB)**: Candidate for removal in v0.5 in favor of native TC39 Stage 3 `Symbol.metadata` available natively in Bun 1.3+.

---

## 9. Application Aliases & API Routing Subsystem

### 9.1 Application Aliases Architecture

ForgeTS eliminates fragile relative traversal (`../app/controllers/...`, `../../models/...`) by providing stable semantic import aliases configured identically across `tsconfig.json`, `vite.config.ts`, Bun runtime, and React SSR:

- **Backend Application Namespaces**:
  - `@/controllers/*` -> `app/controllers/*`
  - `@/models/*` -> `app/models/*`
  - `@/services/*` -> `app/services/*`
  - `@/middleware/*` -> `app/middleware/*`
  - `@/config/*` -> `config/*`
  - `@/routes/*` -> `routes/*`
  - `@/bootstrap/*` -> `bootstrap/*`
- **Frontend / Client Namespaces**:
  - `@/components/*` -> `resources/js/components/*`
  - `@/layouts/*` -> `resources/js/layouts/*`
  - `@/hooks/*` -> `resources/js/hooks/*`
  - `@/lib/*` -> `resources/js/lib/*`
  - `@/types/*` and `@/types` -> `resources/js/types/*`
  - `@/pages/*` -> `resources/js/pages/*`
- **Explicit Server Namespace (Option B compatibility)**:
  - `@app/*` -> `app/*` (`@app/controllers/*`, `@app/models/*`, etc.)
  - `@config/*` -> `config/*`
  - `@database/*` -> `database/*`
  - `@routes/*` -> `routes/*`
  - `@bootstrap/*` -> `bootstrap/*`
  - `@forge/core` and `@forge/database` -> framework core engine only.

**Why this namespace?**
The unified `@/*` and `@app/*` aliases allow developers to write clean, idiomatic imports without colliding backend domain logic and frontend React components.

**ESM `.js` Extension**:
Per ESM module resolution in Bun and Node, imports targeting `.ts` source files can use the standard `.js` specifier (e.g. `import { WelcomeController } from '@/controllers/WelcomeController.js'`). Bun resolves this transparently without requiring source files to be renamed.

### 9.2 API Routing (`routes/api.ts`)

ForgeTS provides first-class API routing mounted via `app.registerRoutes(apiRoutes, { prefix: '/api', type: 'api' })`:

1. **Prefix Mounting**: Routes in `routes/api.ts` are automatically mounted under the `/api` prefix (configurable via `APP_API_PREFIX` or `config/app.ts`).
2. **CSRF Isolation**: Web routes in `routes/web.ts` enforce `CsrfMiddleware` (HTTP 419 on mismatch), while API routes in `routes/api.ts` remain stateless and exempt from CSRF protection.
3. **Structured JSON Responses**: API routes return structured JSON via `res.json()`, `res.created()`, `res.noContent()`, or by returning plain objects/arrays from controller handlers.
4. **Structured JSON Errors**:
   - HTTP status exceptions (`BadRequestException` 400, `UnauthorizedException` 401, `ForbiddenException` 403, `NotFoundException` 404, `UnprocessableEntityException` 422) return structured JSON payloads.
   - 404 errors on API routes return `{ error: '...', statusCode: 404 }`.
   - Internal errors (500) return sanitized diagnostics when `APP_DEBUG=true` and `{ message: 'Internal Server Error' }` when `APP_DEBUG=false`, preventing sensitive leaks.
5. **CLI Scaffolding & Introspection**:
   - `forge make:controller <Name> --api` scaffolds an API controller and registers it into `routes/api.ts` using application aliases.
   - `forge routes:list` cleanly distinguishes `WEB` vs `API` routes in the terminal route table.