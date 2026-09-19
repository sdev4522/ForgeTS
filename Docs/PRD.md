# ForgeTS Product Requirements Document (PRD)

> Comprehensive requirements and specification document for the ForgeTS TypeScript web framework.

---

## 1. Product Vision & Goals

ForgeTS is a high-performance, TypeScript-first web framework running natively on Bun. It delivers the developer velocity and architectural elegance of Laravel while exploiting JavaScript/TypeScript speed and modern ecosystem standards.

### Target Audience
TypeScript and JavaScript developers seeking:
- Full-stack structure without the fragmentation of Express/Fastify.
- First-class Active Record ORM with full TypeScript typing.
- Native React 19 Server-Side Rendering without the overhead of heavy full-stack client runtimes.
- Built-in security (CSRF, rate limiting, input validation, secret redaction).

---

## 2. Functional Requirements

### 2.1 Runtime & Engine
- **Runtime**: Must run natively on Bun (1.3+) using `Bun.serve()`.
- **Decorators**: Must exclusively support TC39 Stage 3 decorators (`context.metadata`). No `experimentalDecorators` or `reflect-metadata` runtime dependencies.
- **Routing**: Radix-trie route resolver with support for parameterized routes (`:id`), HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`), and controller grouping.

### 2.2 Active Record ORM (`@forge/database`)
- **Base Model**: Abstract `Model` class with ES6 Proxy attribute trapping.
- **Mass-Assignment**: Configurable `fillable` and `guarded` attributes with safe defaults (`id`, `created_at`, `updated_at`, `deleted_at`).
- **QueryBuilder**: Chainable fluent API (`where`, `whereBetween`, `orderBy`, `limit`, `offset`, `with`, `find`, `findOrFail`, `all`, `create`, `first`, `firstOrFail`).
- **Persistence**: `save()`, `update()`, `fill()`, `delete()`, `toJSON()`.
- **Multi-Driver**: Unified API across relational SQL (MySQL via Kysely) and document NoSQL (MongoDB via official driver).
- **Timezone Awareness**: Driver-aware datetime serialization (`YYYY-MM-DD HH:mm:ss` for MySQL, native Date for MongoDB).

### 2.3 HTTP Layer & Security (`@forge/core`)
- **Request Wrapper**: Lazy evaluation of params, query parameters, headers, cookies, and bodies.
- **Input Validation**: Pipe-separated string validation rules (`required`, `email`, `numeric`, `string`, `boolean`, `min:N`, `max:N`) and Zod schema support. Throws `ValidationError` (422).
- **ForgeResponse**: Chainable response builder with status normalization (`normalizeHttpStatus`), cookie handling, redirects, content negotiation (`wantsJson`, `isJson`), and shortcut helpers (`created`, `noContent`, `notFound`, `unprocessable`).
- **CSRF Protection**: Stateful session token verification (`forge_session` cookie) with HTTP 419 rejection on mismatch and automatic token injection into views.
- **Rate Limiting**: Memory-backed sliding-window rate limiter (`@RateLimit(maxAttempts, windowSeconds)`) with HTTP 429 and `Retry-After`.
- **Password Hashing**: Native SIMD Argon2id password hashing via `Hash.make()` and `Hash.verify()`.

### 2.4 Presentation & View Layer
- **Dual View Support**:
  1. Server HTML View Engine (`resources/views/*.html`) with `{{ var }}`, `{{{ raw }}}`, `{{@ partial }}`.
  2. React 19 Server-Side Rendering (`resources/js/pages/*.tsx`).
- **Automatic Serialization Boundary**: `serializeViewData()` deeply unwraps Model instances and custom `toJSON()` structures before passing props to React SSR or HTML templates.
- **Deterministic Hydration**: Renders static HTML and generates escaped JSON payloads in `<script id="__FORGETS_DATA__">` for client hydration via `entry-client.tsx`.
- **Development DX**: Seamless Vite HMR in development without backend restarts; precompiled SSR bundles in production.

### 2.5 CLI Scaffolding (`bin/forge.ts`)
- Scaffolding commands for controllers (`forge make:controller`), models (`forge make:model`), migrations (`forge make:migration`), services (`forge make:service`), middleware (`forge make:middleware`), and full React CRUD flows (`forge make:page <Name> --crud`).
- Route auditing (`forge routes:list`).
- Cache clearing (`forge cache:clear`, `forge config:clear`, `forge optimize:clear`).

---

## 3. Non-Functional Requirements

1. **Zero Emojis**: Emojis are strictly prohibited from source code, technical documentation, CLI output, logs, and error messages (Rule 8).
2. **Environment Genericity**: Zero hardcoded developer-specific paths, timezones, or usernames (Rule 9).
3. **Framework Core Genericity**: Engine internals (`packages/forge/src/`) must be 100% reusable across any application without hardcoded domain logic.
4. **Performance & Memory**: Sub-millisecond route resolution and minimal idle heap footprint.
