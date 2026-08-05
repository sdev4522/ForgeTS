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
| Import aliases | `@forge/core`, `@forge/database`, `@app/*`, `@config/*`, `@database/*`, `@routes/*` | Framework internals import via `@forge/*`; app code never uses relative paths into `packages/forge/src/` |

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
                           NOT a throwaway example. This is the reference
                           implementation of how a real developer uses ForgeTS,
                           and will seed the separate starter-skeleton repo
                           (`forgets/starter`, mirroring Laravel's laravel/laravel)
                           once the framework is ready to publish.
    controllers/
    models/
    services/
    middleware/
  routes/               <- Route definitions (web.ts, api.ts)
  resources/
    views/               <- Server-rendered HTML templates (.html)
  database/
    migrations/          <- Database schema migrations
  config/                <- Configuration files (app.ts, database.ts)
  bootstrap/             <- App bootstrap (app.ts)
  bin/                   <- CLI & Server entry points (serve.ts, forge.ts)
```

**Note on history:** an earlier `src/core/` directory (created during an intermediate
rebuild attempt) was audited, confirmed to have zero live imports anywhere in the
active codebase, and deleted along with `tsconfig.src.json` and legacy `src:dev`/
`src:serve` scripts. `packages/forge/src/` has always been — and remains — the only
active runtime framework engine. All app-layer imports now use the `@forge/core` /
`@forge/database` aliases rather than relative paths.

**Note on `app/` naming:** an earlier decision renamed this to `src/example/` to avoid
confusion with a "real app." That decision was explicitly superseded by direct
instruction to build the dogfood app using the framework's actual real-world
conventions, to prove the DX works the way a real developer would experience it.
`app/` is intentional and permanent — not a leftover.

---

## 4. Roadmap Status

- **v0.1 — Core Engine & Application Skeleton** — ✅ **COMPLETED & VERIFIED**
  - Router + TC39 Stage 3 Decorators — ✅
  - DI Container — ✅
  - Request / Response wrappers + Form Body Parser — ✅
  - Global Error Handler + Debug Display Engine (`APP_DEBUG`) — ✅
  - DatabaseDriver interface + SQLDriver (Kysely + **SQLite and MySQL, both verified
    end-to-end with identical CRUD behavior**) — ✅
  - Active Record Model base class (`Model`) — ✅
  - Server-Side HTML View Engine (`res.view()`) — ✅
  - CLI Scaffolding (`forge serve`, `make:controller`, `make:model`, `make:migration`,
    `make:service`, `make:middleware`, `routes:list`) — ✅
  - Dogfood Application (Todo App, HTML UI + JSON API, verified on both SQLite and
    MySQL) — ✅
  - Single-source architecture cleanup (orphaned `src/core/` removed, aliases
    standardized) — ✅

- **v0.2 — Security & Stability** — ✅ **COMPLETED & VERIFIED**
  - Task 0: Global Error Handler Verification — ✅ Verified `APP_DEBUG=true` JSON/HTML and `APP_DEBUG=false` production response.
  - Task 1: Input Validation Layer — ✅ Implemented pipe-separated rules (`required`, `email`, `min:N`, `max:N`, `numeric`, `string`, `boolean`), `req.validate()`, `ValidationError` 422 JSON formatting, verified with `TodoController.store()`.
  - Task 2: Mass-Assignment Protection — ✅ Implemented `fillable`/`guarded` in `Model`, safe default Option A (guarding `id`, `created_at`, `updated_at`, `deleted_at`), updated `Todo.ts`, verified unauthorized field stripping.
  - Task 3: CSRF Protection — ✅ Implemented `CsrfMiddleware`, `forge_session` cookie, automatic `csrf_field`/`csrf_token` view injection, HTTP 419 rejection on mismatch, verified end-to-end with Todo HTML forms.
  - Task 4: Rate Limiting Middleware — ✅ Implemented `RateLimiter` sliding-window engine, `@RateLimit(maxAttempts, windowSeconds)` decorator, HTTP 429 response with `Retry-After` header, verified with 4 sequential requests to `POST /todos`.
  - Task 5: Password Hashing Helper — ✅ Implemented `Hash` class & `hash` helper using SIMD-accelerated native Argon2id (`Bun.password`), verified round-trip `make()` and `verify()` success/failure.
  - Task 6: Secrets Redaction — ✅ Implemented `ErrorDisplayEngine.redactSecrets()` scanning `.env` values, verified `[REDACTED]` replacement for process secrets in debug error outputs.

- **v0.3 — React + Vite SSR** — ✅ **COMPLETED & VERIFIED**
  - Security & Access Control Regression Suite — ✅ Created `tests/integration/SecurityAccessControl.test.ts` (`bun run test:security`), verified 404 responses for `/packages/forge/src/view/ViewEngine.ts`, `/config/database.ts`, `/.env`, and `/package.json`, and 200 OK for `/todos`.
  - Task 1: Vite Dev Server Integration (Middleware Mode) — ✅ Created `vite.config.ts`, `ViteDevServer.ts`, integrated Vite middleware mode, verified zero pre-existing route regressions (`/todos/ui`, `/todos`).
  - Task 2: Page Resolution + SSR Render Pipeline — ✅ Implemented `ReactEngine.ts`, updated `res.view()` to resolve `resources/js/pages/*.tsx` first, created `resources/js/pages/todos/index.tsx`, verified server-rendered HTML payload via `curl`.
  - Task 3: Client-Side Hydration — ✅ Implemented `resources/js/entry-client.tsx`, serialized `{ page, props }` in `__FORGETS_DATA__` script tag, verified hydration in Chrome browser with zero console hydration warnings and verified interactivity.
  - Task 4: Production Build Pipeline — ✅ Created `resources/js/entry-server.tsx`, configured Vite client manifest & SSR bundle builds (`bun run build`), verified production bundle size reduction (`entry-client-*.js` ~384 KB / 116 KB gzip vs 964 KB dev bundle), updated production server path to load compiled SSR bundle (`dist/server/entry-server.js`) & manifest assets (`dist/client/manifest.json`) without Vite dev server, verified `NODE_ENV=production` execution.
  - Task 5: SEO Meta Tags — ✅ Implemented chainable `res.view().meta({ title, description })` API on `ForgeResponse`, injected `<title>` and `<meta name="description">` tags into `<head>` of SSR shell document, verified raw crawlable HTML via `curl` (`GET /todos/react` in production mode).

- **v0.4 — SSR Polish & DX** — ✅ **COMPLETED & VERIFIED**
  - Task 1: HTML Error Page for Browser-Rendered Routes — ✅ Enhanced `Application.handleError()` request type detection to distinguish HTML browser navigation (`Accept: text/html`) from API requests (`Accept: application/json` or `/api/*`), integrated `ErrorDisplayEngine.renderHtml()` for debug mode (`APP_DEBUG=true`) with secrets redaction & code snippets, and `ErrorDisplayEngine.renderProductionHtml()` for production mode (`APP_DEBUG=false`), preserved JSON error format unchanged.
  - Task 2: Client Hydration Mismatch Guidance — ✅ Added dev-mode console interceptor wrapper around `hydrateRoot` in `resources/js/entry-client.tsx`, re-logging clearer `⚡ [ForgeTS Hydration Warning]` framework guidance alongside React's original warning, disabled in production.
  - Task 3: Single-Shot Full CRUD Scaffolder (`forge make:page <name> --crud`) — ✅ Added `forge make:page <PageName> [--crud]` command to `bin/forge.ts`, scaffolding Model, Migration, Controller, 4 React Pages (`index`, `create`, `edit`, `show`), and web route registration with overwrite safety warnings.
  - Task 4: Per-Page Code Splitting — ✅ Configured dynamic `import()` page component resolution in `resources/js/entry-client.tsx`, verified Vite client build output produces separate page chunks (`dist/client/assets/*.js`), added targeted `<link rel="modulepreload">` injection in `ReactEngine.ts` for production page rendering.
  - Task 5: Minimal Documentation Site (React SSR Dogfooding) — ✅ Dogfooded React SSR to build `/docs` site (`DocsController.ts`, `resources/js/pages/docs/index.tsx`, `routing.tsx`, `models.tsx`, `views.tsx`, `cli.tsx`), verified end-to-end with 24 passing integration tests.

- **Database Architecture Refactor (Removing SQLite, Adding MongoDB, Fail-fast Resilience & Unified Active Record API)** — ✅ **COMPLETED & VERIFIED**
  - Task 1: Clean Removal of SQLite Driver — ✅ Removed `bun:sqlite` engine, `ForgeBunSqliteDialect`, `BunConnection`, `BunDriver`, removed `kysely-bun-sqlite` dependency, updated `.env.example` and `config/database.ts` (MySQL default).
  - Task 2: Native MongoDB Driver & Unified Active Record API — ✅ Created `DatabaseDriver` interface & `MongoDriver` implementation wrapping official `mongodb` package (`^6.12.0`), added `LogEntry` Mongo-backed model, proved 100% identical Active Record API surface (`.find()`, `.where()`, `.create()`, `.save()`, `.delete()`) across both MySQL and MongoDB models.
  - Task 3: Boot-Time Fail-Fast Check & Request-Time 503 Handling — ✅ Implemented `verifyDatabaseConnectionOnBoot()` in `Connection.ts` and `Application.start()` (logs redacted connection details and exits with code 1 if DB is unreachable); updated `Application.handleError()` to catch mid-request database outages and return HTTP **503 Service Unavailable** (verified with live test outputs).
  - Task 4: Load Testing & Connection Pool Backpressure — ✅ Tested MySQL and MongoDB endpoints under 10, 100, 500, 1000 concurrent connections via `autocannon` (peak 30,977 Req/sec, 0% error rate, zero process crashes under 1000 connections).

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

---

## 7. Session Startup Checklist for AI Agents

Before starting any task in a new session:
1. Read this file (PROJECT.md) fully.
2. Read RULES.md fully.
3. Confirm which roadmap version/task you're being asked to work on (Section 4).
4. If the task conflicts with anything in Section 2, 3, or 5, stop and ask before
   proceeding — do not silently resolve the conflict yourself.

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