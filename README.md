# ForgeTS: TypeScript Web Framework for Node.js

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 24.7](https://img.shields.io/badge/node-%3E%3D24.7-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React 19 SSR](https://img.shields.io/badge/React-19%20SSR-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![GitHub stars](https://img.shields.io/github/stars/sdev4522/ForgeTS?style=social)](https://github.com/sdev4522/ForgeTS)

> **Batteries-included, TypeScript-first full-stack web framework for Node.js.**  
> *Laravel's developer experience meets JavaScript's raw speed.*

**ForgeTS** is an open-source MVC framework for building web apps and REST APIs in TypeScript. It gives you an Active Record ORM (MySQL and MongoDB), React 19 server-side rendering, routing with standard TC39 decorators, dependency injection, validation, CSRF protection, rate limiting, database migrations and a `forge` CLI in one package. If you know Laravel, Rails or AdonisJS, ForgeTS will feel familiar; it runs directly on `node:http` without Express or Koa.

**Contents:** [Highlights](#key-highlights) · [Quick Start](#quick-start) · [Usage](#core-framework-usage) · [CLI](#cli-reference) · [Short Syntax](#the-short-syntax) · [Migrations](#database-migrations)

---

## Key Highlights

- **Lean Node.js Engine**: Built directly on `node:http` through a thin Fetch-API adapter — no Express or Koa layers. Radix-trie routing and minimal idle heap.
- **TC39 Stage 3 Decorators**: ECMAScript standard decorators (`@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`, `@Middleware`, `@Column`). Zero `experimentalDecorators` or `reflect-metadata` overhead.
- **Radix-Trie Router**: O(path-segments) route matching that never degrades as your application route count grows. Supports route parameters (`:id`), grouping, and prefixes.
- **Active Record ORM**: Built on Kysely (MySQL) and native MongoDB drivers with a 100% unified API (`User.find()`, `User.all()`, `User.create()`, `user.save()`, `user.delete()`, `user.fill()`). Features mass-assignment protection (`fillable`/`guarded`) and driver-aware datetime serialization.
- **View Data Serialization Boundary**: Dedicated serializer (`serializeViewData()`) automatically unwraps Active Record Model instances and collections before they reach React SSR or HTML templates, preventing internal attributes (`_attributes`) from leaking into client hydration payloads.
- **Dual View Engines**: Built-in server HTML View Engine (`resources/views/`) and React 19 server-side rendering (`resources/js/pages/`) with deterministic client hydration and Vite dev server integration.
- **Native Development Supervisor**: Automatic backend process supervisor (`bin/dev.ts`) with debounced restarts on backend changes and instant Vite HMR for React frontend changes.
- **Dependency Injection**: Inversion of Control container with explicit singleton and transient lifetimes and automatic class constructor resolution.
- **Event Subsystem**: Deterministic FIFO event dispatcher supporting class and function listeners with automatic container dependency injection.
- **Security by Default**: Stateful CSRF token verification (`CsrfMiddleware` with HTTP 419 on mismatch), sliding-window rate limiting (`@RateLimit` with HTTP 429), declarative input validation (`req.validate()`), Argon2id password hashing (`Hash`), and process secret redaction.
- **First-Class Error Infrastructure**: Complete error subsystem with automated multi-layer secret redaction (`Redactor`), Ignition-style dark-mode HTML debug interface (`HtmlErrorRenderer`), structured dev JSON payloads, zero-leak production responses, deterministic error correlation IDs (`err_<id>`), and fail-safe recovery.
- **`forge` CLI**: Scaffolding tool for controllers, models, migrations, services, middleware, full CRUD flows (`forge make:page <Name> --crud`), route auditing (`forge routes:list`), and cache management.

---

## Folder Structure

```
ForgeTS/
├── app/
│   ├── controllers/       # HTTP request handlers (UserController.ts, WelcomeController.ts)
│   ├── models/            # Active Record models extending Model (User.ts)
│   ├── services/          # Business logic services (@Injectable classes)
│   └── middleware/        # Request pipeline middleware classes
├── bootstrap/
│   ├── app.ts             # Composition root & application wiring
│   └── env.ts             # Early environment variable loader
├── bin/
│   ├── dev.ts             # Development process supervisor
│   ├── serve.ts           # Standalone HTTP server launcher
│   └── forge.ts           # CLI scaffolding executable
├── config/                # Typed configuration modules (app.ts, database.ts)
├── database/
│   ├── migrations/        # Schema migration scripts
│   └── seeders/           # Database seed scripts
├── packages/
│   └── forge/             # Framework core engine (@forge/core, @forge/database)
├── public/                # Static assets (CSS, JS, images, favicon)
├── resources/
│   ├── js/                # React SSR pages, components, and client entry
│   │   ├── pages/         # React SSR page components (user.tsx, welcome.tsx)
│   │   ├── types/         # Shared TypeScript interfaces (PageProps)
│   │   ├── entry-client.tsx # Client-side hydration entry
│   │   └── entry-server.tsx # SSR production bundle entry
│   └── views/             # Master React SSR shell document (app.html)
├── routes/
│   ├── api.ts             # Stateless API route definitions (/api)
│   └── web.ts             # Web page route definitions with CSRF protection (/)
└── tests/
    ├── unit/              # Unit test suites (*.test.ts)
    └── integration/       # Integration & security regression suites
```

---

## Quick Start

### 1. Installation

Ensure you have [Node.js](https://nodejs.org) 24.7 or newer installed (TypeScript runs through `tsx`, no build step in development):

```bash
git clone https://github.com/sdev4522/ForgeTS.git
cd ForgeTS
npm install
```

### 2. Configure Environment

Copy the example environment file and configure your database settings:

```bash
cp .env.example .env
```

### 3. Run Development Server

```bash
# Start development supervisor with hot reloading & Vite HMR
npm run dev
```

Or using the `forge` CLI:

```bash
forge serve
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Core Framework Usage

### 1. Controllers & Routing

Controllers handle HTTP requests and return typed JSON or server-rendered views:

```typescript
// app/controllers/UserController.ts
import { Controller, Get, Post, Put, Delete } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { User } from '@/models/User.js';

@Controller('/users')
export class UserController {
  @Get('/')
  async index(req: Request, res: ForgeResponse) {
    const users = await User.all();

    if (req.wantsJson()) {
      return res.json(users);
    }

    return res.view('user', {
      title: 'Users Directory',
      userData: users,
    });
  }

  @Get('/:id')
  async show(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) return res.notFound('User not found');
    return res.json(user);
  }

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
}
```

Register controllers in `routes/web.ts` (with CSRF protection) or `routes/api.ts` (stateless):

```typescript
// routes/web.ts
import { Router, CsrfMiddleware } from '@forge/core';
import { UserController } from '@/controllers/UserController.js';
import { WelcomeController } from '@/controllers/WelcomeController.js';

const router = new Router();

router.middleware(CsrfMiddleware);
router.controller(WelcomeController);
router.controller(UserController);

export default router;
```

---

### 2. React 19 Server-Side Rendering & Serialization

React pages placed in `resources/js/pages/*.tsx` are rendered on the server and hydrated in the browser:

```tsx
// resources/js/pages/user.tsx
import React from 'react';
import type { PageProps } from '@/types';

interface UserItem {
  id: number;
  name: string;
  email: string;
}

interface UserPageProps extends PageProps {
  title?: string;
  userData?: UserItem[];
}

export default function UserPage({ csrf_token, title = 'Users', userData = [] }: UserPageProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>{title}</h1>

      <form action="/users" method="POST">
        <input type="hidden" name="_token" value={csrf_token} />
        <input type="text" name="name" placeholder="Name" required />
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Create User</button>
      </form>

      <ul>
        {userData.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Automatic Model Serialization
When passing Active Record instances to `res.view()`:
```typescript
const users = await User.all();
return res.view('user', { userData: users });
```
The framework automatically passes `viewData` through `serializeViewData()`. Every Model instance is unwrapped via its `.toJSON()` method into plain objects. Internal state (`_attributes`) and active record methods are never exposed to React SSR components or leaked into client hydration scripts.

#### Master SSR Shell Document
The React SSR engine mounts rendered components inside `resources/views/app.html`:

```html
<!-- resources/views/app.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title><!-- FORGETS_TITLE --></title>
</head>
<body>
  <div id="root"><!-- FORGETS_APP --></div>
  <script type="application/json" id="__FORGETS_DATA__"><!-- FORGETS_DATA --></script>
  <script type="module" src="/resources/js/entry-client.tsx"></script>
</body>
</html>
```

---

### 3. Active Record ORM

Define models extending `Model` with `@Column()` decorators:

```typescript
// app/models/User.ts
import { Model, Column, HasMany } from '@forge/database';
import { Post } from './Post.js';

export class User extends Model {
  static override table = 'users';
  static override fillable = ['name', 'email', 'password'];

  @Column() declare id: number;
  @Column() declare name: string;
  @Column() declare email: string;
  @Column() declare password: string;
  @Column() declare created_at: string;
  @Column() declare updated_at: string;

  @HasMany(() => Post, 'user_id')
  declare posts: Post[];
}
```

#### Querying & Persisting Records
```typescript
// Create & save
const user = await User.create({ name: 'Alice', email: 'alice@example.com' });
user.name = 'Alice Smith';
await user.save();

// Update with mass-assignment filtering
await user.update({ name: 'Alice Doe' });

// Fluent queries
const activeUsers = await User.where('status', 'active')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

// Find single record
const user = await User.find(1);
const requiredUser = await User.findOrFail(1);

// Delete record
await user.delete();
```

---

### 4. Dependency Injection

Define injectable services with `@Injectable()`:

```typescript
// app/services/UserService.ts
import { Injectable } from '@forge/core';
import { User } from '@/models/User.js';

@Injectable({ lifetime: 'singleton' })
export class UserService {
  async getActiveUsers() {
    return User.where('status', 'active').get();
  }
}
```

Resolve services from the container:

```typescript
const userService = container.resolve(UserService);
```

---

### 5. Event Subsystem

Define decoupled events and listeners with deterministic FIFO execution:

```typescript
// app/events/UserRegistered.ts
export class UserRegistered {
  constructor(public user: User) {}
}

// app/listeners/SendWelcomeEmail.ts
export class SendWelcomeEmail {
  async handle(event: UserRegistered) {
    // Send email logic
  }
}

// Register and dispatch
app.events.listen(UserRegistered, SendWelcomeEmail);
await app.events.dispatch(new UserRegistered(user));
```

---

## CLI Reference

The `forge` CLI provides scaffolding, route auditing, and cache management:

```bash
# Display all registered application routes in a formatted table
forge routes:list

# Scaffold a new HTTP controller
forge make:controller UserController [--api]

# Scaffold an Active Record model (with optional migration)
forge make:model User [--migration]

# Scaffold a full React page CRUD flow (Model, Migration, Controller, 4 React Pages)
forge make:page User --crud

# Scaffold an @Injectable() business logic service
forge make:service UserService

# Scaffold HTTP middleware
forge make:middleware AuthMiddleware

# Scaffold a database migration script
forge make:migration create_users_table

# Clear application, config, and framework caches
forge cache:clear
forge config:clear
forge optimize:clear
```

---

## The Short Syntax

Handlers return what should be sent — no response object to thread through:

```ts
import { Router, view, created, redirect, abort, type Request } from '@forge/core';
import { Post } from '@/models/Post.js';

const router = new Router();

router.view('/about', 'about');                       // a page with no controller
router.get('/posts', () => Post.latest().paginate(20)); // objects, arrays and models become JSON
router.get('/posts/:id', async (req: Request) => (await Post.find(req.params.id)) ?? abort(404));
router.post('/posts', async (req: Request) =>
  created(await Post.create(await req.validate({ title: 'required|min:3', status: 'in:draft,live' }))));
router.resource('/comments', CommentController);      // index/show/store/update/destroy in one line
```

- **Return values:** object / array / model → JSON, string → plain text, `null` → 204, or a helper: `view()`, `json()`, `created()`, `noContent()`, `redirect()`, `back()`.
- **Stop early:** `abort(404)`, `abortIf(cond, 403)`, `abortUnless(user, 401)`.
- **Input:** `req.input('page', 1)`, `req.only('title', 'body')`, `req.except(...)`, `req.all()`, `req.has()`, `req.boolean()`, `req.integer()`, `req.file()`.
- **Validation rules:** `required`, `nullable`, `bail`, `string`, `numeric`, `integer`, `boolean`, `array`, `email`, `url`, `uuid`, `date`, `alpha`, `alpha_num`, `min`, `max`, `between`, `size`, `in`, `not_in`, `confirmed`, `same`, `different`, `regex`. Custom messages go in a second argument (`{ 'email.required': '…' }`); add your own rule with `Validator.extend()`. A misspelled rule throws instead of being silently ignored.
- **Middleware** can be a plain function: `const auth = async (req, next) => req.bearerToken() ? next() : json({ error: 'Unauthorized' }, 401);`
- **Models:** `Post.find(id)`, `findBy('slug', s)`, `where(...)`, `whereIn(...)`, `orderBy(...)`, `latest()`, `count()`, `paginate(perPage, page)`, `firstOrCreate()`, `updateOrCreate()`, `destroy(id)`; on a query: `.pluck()`, `.exists()`, `.update({...})`, `.delete()`; on an instance: `.update()`, `.refresh()`, `.delete()`. Columns can be declared without decorators: `declare title: string;`.

## Database Migrations

Migration files live in `database/migrations/` and export `up(db)` / `down(db)` (Kysely schema builder):

```bash
npm run forge make:migration create_posts_table   # scaffold a migration
npm run forge migrate                             # run pending migrations (one batch)
npm run forge migrate:status                      # read-only: what has run
npm run forge migrate:rollback -- --step=1        # revert the latest batch
npm run forge migrate:fresh -- --seed             # drop everything, re-run, seed
npm run forge db:seed                             # run database/seeders/DatabaseSeeder.ts
```

`migrate:rollback`, `migrate:reset`, `migrate:fresh` and `db:seed` refuse to run when `NODE_ENV=production` unless `--force` is passed.

## Application Manifest (for tooling and AI agents)

`forge inspect` describes the whole application in one document: routes (with middleware and params), models (table, columns, relations, fillable/hidden), redacted config, events, migrations, CLI commands, the project conventions, and warnings.

```bash
npm run forge inspect                   # human-readable summary
npm run --silent forge inspect -- --json        # full manifest as JSON
npm run --silent forge inspect routes -- --json # one section
npm run --silent forge inspect -- --json --db   # include migration run status
```

Every warning carries a stable `code`, the `file`, and a concrete `fix`, for example `MODEL_SENSITIVE_NOT_HIDDEN`, `MODEL_NO_FILLABLE`, `ROUTE_WEB_WITHOUT_CSRF`, `MIGRATIONS_PENDING`. Secrets never appear in the manifest. Migration commands accept `--json` too and return `{ ok, ... }` or `{ ok: false, error: { code, message, fix } }` with a non-zero exit code.

## Testing & Building

Run unit and integration tests using Node's built-in test runner:

```bash
npm test
```

Run security access control regression tests:

```bash
npm run test:security
```

Run production client and SSR bundle builds:

```bash
npm run build
```

Start in production mode:

```bash
npm run start
```

---

## Engineering Standards

ForgeTS enforces strict engineering standards:
- **Zero Emojis**: Prohibited in all source code, technical documentation, CLI output, logs, and error messages.
- **Clean Architecture**: Complete separation of framework core engine (`packages/forge/src/`) and application domain (`app/`).
- **Standard Decorators**: Pure ECMAScript TC39 Stage 3 decorator compliance using `context.metadata`.

---

## License

ForgeTS is open source under the [MIT License](LICENSE). Designed and built for high-performance TypeScript development on Node.js.

If ForgeTS is useful to you, a star on [GitHub](https://github.com/sdev4522/ForgeTS) helps other developers find it.
