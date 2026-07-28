# ⚡ ForgeTS

> **Batteries-included, TypeScript-first web framework running on Bun.**  
> *Laravel's developer experience meets JavaScript's raw speed.*

---

## 🚀 Key Highlights

- **⚡ Bun-Native Speed**: Built directly on `Bun.serve()` with zero Express/Koa abstraction bloat. Sub-50ms cold starts and 1MB idle heap.
- **🎯 TC39 Stage 3 Decorators**: Future-proof ECMAScript standard decorators (`@Controller`, `@Get`, `@Post`, `@Middleware`, `@Column`). Zero `experimentalDecorators` or `reflect-metadata` overhead.
- **🛤️ Radix-Trie Router**: O(path-segments) route matching that never degrades as your application route count grows.
- **🗄️ Active Record ORM**: Built on Kysely with full type inference, fluent queries (`User.find()`, `$user.save()`), and eager relationship loading (`.with('posts')`).
- **🧩 Dependency Injection**: Inversion of Control container with explicit singleton and transient lifetimes.
- **🎨 HTML View Engine**: Built-in template renderer (`resources/views/`) and automatic static file serving (`public/`).
- **🛠️ `forge` CLI**: Scaffolding tool for controllers, models, migrations, services, middleware, and route auditing (`forge routes:list`).
- **📏 Strict Separation of Concerns**: Enforces clean boundaries — Controllers handle HTTP → Services execute logic → Models query data → Views render UI.

---

## 📦 Folder Structure

ForgeTS follows convention-over-configuration directory placement so any developer can navigate the codebase effortlessly:

```
my-app/
├── app/
│   ├── controllers/       # HTTP request handlers (thin controllers)
│   ├── models/            # Active Record models (extend Model)
│   ├── services/          # Business logic (@Injectable classes)
│   ├── middleware/        # Request pipeline middleware
│   ├── providers/         # Service container composition roots
│   └── validators/        # Zod request validation schemas
├── bootstrap/
│   └── app.ts             # Composition root & app bootstrapping
├── bin/
│   ├── serve.ts           # Server entry point
│   └── forge.ts           # CLI scaffolding executable
├── config/                # Typed configuration modules (app.ts, database.ts)
├── database/
│   ├── migrations/        # Schema migration scripts
│   ├── seeders/           # Database seed scripts
│   └── factories/         # Test model factories
├── public/                # Static assets (CSS, JS, images, favicon)
├── resources/
│   └── views/             # Server-rendered HTML templates (.html)
├── routes/
│   ├── api.ts             # API route definitions (/api)
│   └── web.ts             # Web page route definitions (/)
├── storage/               # Runtime logs, cache, uploads, SQLite DB
└── tests/
    └── unit/              # Bun unit tests (*.test.ts)
```

---

## 🛠️ Quick Start

### 1. Installation

Ensure you have [Bun](https://bun.sh) (v1.3+) installed:

```bash
bun install
```

### 2. Run Development Server

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

## 💻 Core Framework Usage

### 1. Controllers & Routing

Controllers handle HTTP requests and return standard responses or views:

```typescript
// app/controllers/UserController.ts
import { Controller, Get, Post, Middleware } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { AuthMiddleware } from '../middleware/AuthMiddleware.js';

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

### 2. Views & Static Assets

Render HTML templates located in `resources/views/`:

```typescript
// app/controllers/WelcomeController.ts
import { Controller, Get } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';

@Controller('/')
export class WelcomeController {
  @Get('/')
  async welcome(_req: Request, res: ForgeResponse) {
    return res.view('welcome', {
      version: '0.1.0',
      uptime: '10m',
    });
  }
}
```

View Template (`resources/views/welcome.html`):

```html
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

## 🛠️ CLI Reference

The `forge` CLI provides instant scaffolding and route auditing:

```bash
# Display all registered application routes in a table
forge routes:list

# Scaffold a new HTTP controller
forge make:controller UserController

# Scaffold an Active Record model (with optional migration)
forge make:model Post --migration

# Scaffold an @Injectable() business logic service
forge make:service PostService

# Scaffold HTTP middleware
forge make:middleware AuthMiddleware

# Scaffold a database migration script
forge make:migration create_posts_table
```

---

## 🧪 Testing

Run unit tests using Bun's native test runner:

```bash
bun test
```

Test results:

```
bun test v1.3.14
tests/unit/Model.test.ts:
✓ Active Record Model & QueryBuilder > Model.create() and Model.find()
✓ Active Record Model & QueryBuilder > Model.where() and save() update
✓ Active Record Model & QueryBuilder > Relationships: HasMany & BelongsTo eager loading
✓ Active Record Model & QueryBuilder > Model.delete()

 4 pass
 0 fail
Ran 4 tests across 1 file. [133.00ms]
```

---

## 📄 License

Designed and built with ⚡ for high performance TypeScript development.
