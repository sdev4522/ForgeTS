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
| SQL dialects | SQLite (`bun:sqlite`) and MySQL (`mysql2`) | SQLite for zero-config local dev; MySQL for production database testing. **Both verified end-to-end (full CRUD) with identical behavior as of v0.1 close.** |
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

- **v0.2 — Security & Stability** — NEXT
  - CSRF protection (session-based routes)
  - Rate limiting middleware (default on auth routes)
  - Mass-assignment protection (`fillable`/`guarded` on models)
  - Input validation layer (`req.validate({...})`, pipe-style rules)
  - Password hashing helper enforced
  - `.env`/secrets redaction in any future error-reporting or AI-debug output

- **v0.3 — React + Vite SSR** — NOT STARTED (coexists with, does not replace, the
  existing HTML View Engine)

- **v0.4 — SSR Polish & DX** — NOT STARTED

- **v0.5 — Batteries Included** (queues, storage, mail, cache, events) — NOT STARTED

---

## 5. Explicit Non-Goals (Don't Build These Unless Asked)

- MongoDB support (driver interface must stay DB-agnostic, but no MongoDriver
  implementation until explicitly scheduled — likely v0.2.5/v0.3 timeframe)
- Streaming SSR, RSC, code-splitting (v0.4+ only)
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