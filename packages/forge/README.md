# @forge/core & @forge/database

> Core engine internals for ForgeTS, a TypeScript-first web framework running on Bun.

---

## Overview

The `packages/forge` directory contains the framework runtime engine. It is partitioned into two primary packages exposed via TypeScript and bundler import aliases:

- `@forge/core` (`packages/forge/src/index.ts`): Application lifecycle, TC39 Stage 3 routing decorators, HTTP request/response primitives, middleware pipeline, CSRF protection, sliding-window rate limiting, input validation, dependency injection container, event dispatcher, configuration manager, and React SSR / ViewEngine integration.
- `@forge/database` (`packages/forge/src/database/index.ts`): Active Record ORM (`Model`), fluent QueryBuilder, multi-driver database manager (MySQL and MongoDB), relationship decorators (`@HasMany`, `@BelongsTo`, `@HasOne`), column decorator (`@Column`), and database/view serializers.

---

## Package Exports Reference

### 1. @forge/core Exports

#### Core Application & Exceptions
- `Application`: Central composition root and HTTP server manager.
- `Provider`: Base class for service providers with `register(container)` and optional `boot(container)`.
- `HttpException`: Base HTTP exception with status code and payload.
- `NotFoundException` (404), `UnauthorizedException` (401), `ForbiddenException` (403), `BadRequestException` (400), `UnprocessableEntityException` (422).
- `now()`, `today()`, `ForgeDate`, `getTimezone()`: DateTime utilities.

#### HTTP Primitives & Security
- `Request`: Unified HTTP request wrapper with lazy property evaluation (`params`, `query`, `headers`, `body()`, `json()`, `validate()`, `wantsJson()`, `isJson()`, `ip()`, `bearerToken()`).
- `ForgeResponse`: Chainable HTTP response builder (`status()`, `header()`, `json()`, `html()`, `text()`, `view()`, `meta()`, `redirect()`, `cookie()`, `clearCookie()`, `created()`, `noContent()`, `notFound()`, `badRequest()`, `unprocessable()`).
- `isValidHttpStatus(status)`, `normalizeHttpStatus(status, default)`: Status code normalization ensuring fetch specification compliance.
- `serializeViewData(value)`: Recursive serializer that unwraps ORM Model instances and custom `toJSON()` structures into plain objects, preventing internal state leakage into SSR or ViewEngine.
- `CsrfMiddleware`: Cookie-based CSRF protection using `forge_session` cookie; validates `_token` on state-modifying verbs (`POST`, `PUT`, `PATCH`, `DELETE`) and returns 419 on mismatch.
- `RateLimiter`, `RateLimit`, `createRateLimitMiddleware`: Sliding-window memory rate limiter and method/class decorator.
- `ErrorDisplayEngine`: Ignition-inspired visual error page renderer (`APP_DEBUG=true`) and sanitized production error handler (`APP_DEBUG=false`).
- `Validator`, `ValidationError`: Pipe-separated string validator (`required`, `string`, `numeric`, `boolean`, `email`, `min:N`, `max:N`).
- `Hash`, `hash`: Native Argon2id password hashing powered by Bun SIMD runtime (`make()`, `verify()`).

#### Routing & Decorators
- `Router`: Radix-trie route registry supporting controller registration, route grouping, and explicit verb registration.
- `@Controller(prefix)`: TC39 Stage 3 class decorator marking an HTTP controller.
- `@Get(path)`, `@Post(path)`, `@Put(path)`, `@Patch(path)`, `@Delete(path)`, `@Head(path)`, `@Options(path)`: TC39 Stage 3 method decorators.
- `@Middleware(...classes)`: Class or method decorator attaching middleware to the execution pipeline.

#### Dependency Injection Container
- `Container`: Inversion of Control container supporting `singleton()`, `bind()` (transient), `instance()`, `resolve()`, and child container scoping.
- `@Injectable(options)`: Class decorator marking services for container resolution.

#### Configuration & Environment
- `env(key, default)`: Environment helper with typed accessors (`env.number()`, `env.boolean()`).
- `bootstrapEnv()`: Early environment bootstrap loader ensuring `.env` is loaded before static module evaluations.
- `defineConfig(config)`: Type-safe configuration helper.
- `config()`, `initConfig()`, `getConfigManager()`: Central configuration access.

#### Events
- `EventDispatcher`, `events`: Deterministic FIFO event dispatcher supporting class and function listeners with automatic DI resolution.

---

### 2. @forge/database Exports

- `Model`: Active Record base class featuring ES6 Proxy attribute trapping, mass-assignment protection (`fillable`, `guarded`), auto-timestamps, and persistence (`save()`, `delete()`, `fill()`, `update()`, `toJSON()`).
- `QueryBuilder`: Fluent query builder supporting `.where()`, `.whereBetween()`, `.orderBy()`, `.limit()`, `.offset()`, `.with()`, `.get()`, `.first()`, `.firstOrFail()`.
- `@Column()`: TC39 Stage 3 field decorator declaring a database-backed attribute.
- `@HasMany(targetModelGetter, foreignKey)`: One-to-many relationship decorator.
- `@BelongsTo(targetModelGetter, foreignKey)`: Inverse relationship decorator.
- `@HasOne(targetModelGetter, foreignKey)`: One-to-one relationship decorator.
- `getDatabaseConnection()`, `resetDatabaseConnection()`: Relational Kysely MySQL connection manager.
- `getMongoDriver()`, `MongoDriver`: Document driver wrapping official MongoDB client.
- `serializeModelAttributes()`, `serializeDatabaseValue()`, `formatMysqlDateTime()`: Database persistence value sanitizers.

---

## Architectural Principles

1. **Framework Core Genericity**: `packages/forge` contains zero domain-specific models, application routes, or hardcoded application logic.
2. **Standard TC39 Stage 3 Decorators**: No legacy `experimentalDecorators` or `reflect-metadata` runtime overhead. Decorator metadata is stored cleanly via `context.metadata`.
3. **Serialization Boundary**: Active Record models store data internally in `this._attributes`, virtualized by an ES6 Proxy. When passing data across the HTTP response or React SSR boundary (`res.view()` or `res.json()`), `serializeViewData()` unwraps instances via `model.toJSON()`, guaranteeing that React components receive plain serializable structures.
