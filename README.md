# ForgeTS

> **Batteries-included, TypeScript-first web framework running on Bun.**  
> *Laravel's developer experience meets JavaScript's raw speed.*

---

## Key Highlights

- **Bun-Native Engine**: Built directly on `Bun.serve()` with zero intermediate abstraction bloat. Sub-millisecond routing and minimal idle heap.
- **TC39 Stage 3 Decorators**: Future-proof ECMAScript standard decorators (`@Controller`, `@Get`, `@Post`, `@Middleware`, `@Column`). Zero `experimentalDecorators` or `reflect-metadata` overhead.
- **Radix-Trie Router**: O(path-segments) route matching that never degrades as your application route count grows.
- **Active Record ORM**: Built on Kysely with full type inference, fluent queries (`User.find()`, `user.save()`), and eager relationship loading (`.with('posts')`). Supports both MySQL relational storage and MongoDB document engines with a unified API.
- **Dependency Injection**: Inversion of Control container with explicit singleton and transient lifetimes.
- **Dual View Engines**: Built-in server HTML View Engine (`resources/views/`) and React 19 server-side rendering (`resources/js/pages/`) with client hydration and Vite dev server integration.
- **Event Subsystem**: Deterministic event dispatcher supporting synchronous and asynchronous listeners with automatic container dependency resolution.
- **Security by Default**: Synchronized CSRF token verification, sliding-window rate limiting, input validation pipelines, and process secret redaction.
- **`forge` CLI**: Scaffolding tool for controllers, models, migrations, services, middleware, pages, and route auditing (`forge routes:list`).
- **Strict Separation of Concerns**: Enforces clean boundaries: Controllers handle HTTP → Services execute logic → Models query data → Views render UI.

---

## Folder Structure

ForgeTS follows convention-over-configuration directory placement so any developer can navigate the codebase effortlessly:

```
my-app/
├── app/
│   ├── controllers/       # HTTP request handlers (thin controllers)
│   ├── models/            # Active Record models (extend Model)
│   ├── services/          # Business logic (@Injectable classes)
│   └── middleware/        # Request pipeline middleware
├── bootstrap/
│   └── app.ts             # Composition root & app bootstrapping
├── bin/
│   ├── serve.ts           # Server entry point
│   └── forge.ts           # CLI scaffolding executable
├── config/                # Typed configuration modules (app.ts, database.ts)
├── database/
│   ├── migrations/        # Schema migration scripts
│   └── seeders/           # Database seed scripts
├── public/                # Static assets (CSS, JS, images, favicon)
├── resources/
│   ├── js/                # React SSR pages, components, and client entry
│   └── views/             # Server-rendered HTML templates (.html)
├── routes/
│   ├── api.ts             # API route definitions (/api)
│   └── web.ts             # Web page route definitions (/)
└── tests/
    ├── unit/              # Unit test suites (*.test.ts)
    └── integration/       # Integration & security regression suites
```

---

## Quick Start

### 1. Installation

Ensure you have [Bun](https://bun.sh) (v1.3+) installed:

```bash
bun install
```

### 2. Configure Environment

Copy the example environment file and configure your database settings:

```bash
cp .env.example .env
```

### 3. Run Development Server

```bash
# Start with hot reloading
bun run dev
```

Or using the `forge` CLI:

```bash
forge serve
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Core Framework Usage

### 1. Controllers & Routing

Controllers handle HTTP requests and return typed responses or views:

```typescript
// app/controllers/UserController.ts
import { Controller, Get, Post, Middleware } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { AuthMiddleware } from '../middleware/AuthMiddleware.js';
import { User } from '../models/User.js';

@Controller('/users')
@Middleware(AuthMiddleware)
export class UserController {
  @Get('/')
  async index(_req: Request, res: ForgeResponse) {
    const users = await User.all();
    return res.json(users);
  }

  @Get('/:id')
  async show(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) return res.notFound('User not found');
    return res.json(user);
  }
}
```

Register controllers in `routes/api.ts` or `routes/web.ts`:

```typescript
// routes/api.ts
import { Router } from '@forge/core';
import { UserController } from '../app/controllers/UserController.js';

const router = new Router();

router.group({ prefix: '/api/v1' }, () => {
  router.controller(UserController);
});

export default router;
```

---

### 2. Views (React SSR & HTML View Engine)

#### React Server-Side Rendering
Pages located under `resources/js/pages/*.tsx` are rendered server-side and hydrated on the client:

```typescript
// app/controllers/TodoController.ts
import { Controller, Get, Request, ForgeResponse } from '@forge/core';
import { Todo } from '../models/Todo.js';

@Controller('/todos')
export class TodoController {
  @Get('/')
  async index(_req: Request, res: ForgeResponse) {
    const todos = await Todo.all();
    return res.view('todos/index', { todos });
  }
}
```

#### Built-in HTML View Engine
Alternatively, plain HTML templates located in `resources/views/` can be rendered with `{{ var }}` syntax:

```html
<!-- resources/views/welcome.html -->
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/css/welcome.css">
</head>
<body>
  <h1>Welcome to ForgeTS v{{{ version }}}</h1>
</body>
</html>
```

*Static assets placed in `public/` (e.g. `public/css/welcome.css`) are served automatically.*

---

### 3. Active Record ORM

Define models extending `Model` with `@Column()`, `@HasMany()`, and `@BelongsTo()` decorators:

```typescript
// app/models/User.ts
import { Model, Column, HasMany } from '@forge/database';
import { Post } from './Post.js';

export class User extends Model {
  static override table = 'users';

  @Column() declare id: number;
  @Column() declare name: string;
  @Column() declare email: string;

  @HasMany(() => Post, 'user_id')
  declare posts: Post[];
}
```

Query and persist records:

```typescript
// Create & save
const user = await User.create({ name: 'Alice', email: 'alice@example.com' });
user.name = 'Alice Smith';
await user.save();

// Fluent queries with relationship eager loading
const userWithPosts = await User.where('email', 'alice@example.com')
  .with('posts')
  .first();

// Delete
await user.delete();
```

---

### 4. Dependency Injection

Define injectable services with `@Injectable()`:

```typescript
// app/services/UserService.ts
import { Injectable } from '@forge/core';
import { User } from '../models/User.js';

@Injectable({ lifetime: 'singleton' })
export class UserService {
  async getActiveUsers() {
    return User.where('active', 1).get();
  }
}
```

Inject services into controllers via constructor or resolve from the container:

```typescript
const userService = container.resolve(UserService);
```

---

### 5. Events Subsystem

Define decoupled events and listeners with deterministic execution and DI support:

```typescript
// app/events/UserRegistered.ts
export class UserRegistered {
  constructor(public user: User) {}
}

// app/listeners/SendWelcomeEmail.ts
export class SendWelcomeEmail {
  async handle(event: UserRegistered) {
    // Send onboarding email
  }
}

// Register and dispatch
app.events.listen(UserRegistered, SendWelcomeEmail);
await app.events.dispatch(new UserRegistered(user));
```

---

## CLI Reference

The `forge` CLI provides scaffolding and route auditing:

```bash
# Display all registered application routes in a table
forge routes:list

# Scaffold a new HTTP controller
forge make:controller UserController

# Scaffold an Active Record model (with optional migration)
forge make:model Post --migration

# Scaffold a full React page CRUD flow (Model, Migration, Controller, 4 React Pages)
forge make:page Note --crud

# Scaffold an @Injectable() business logic service
forge make:service PostService

# Scaffold HTTP middleware
forge make:middleware AuthMiddleware

# Scaffold a database migration script
forge make:migration create_posts_table
```

---

## Testing

Run unit and integration tests using Bun's native test runner:

```bash
bun test
```

Run security access control regression tests:

```bash
bun run test:security
```

Run production client and SSR bundle builds:

```bash
bun run build
```

---

## Engineering Standards

ForgeTS enforces strict engineering standards:
- Zero emojis in source code, technical documentation, CLI output, logs, or error messages (see `RULES.md` Rule 8).
- Complete separation of framework core engine (`packages/forge/src/`) and application logic (`app/`).
- Future-proof standards compliance using native TC39 Stage 3 decorator metadata.

---

## License

MIT License. Designed and built for high-performance TypeScript development on Bun.
