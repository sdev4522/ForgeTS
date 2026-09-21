# ForgeTS

> **Batteries-included, TypeScript-first web framework running on Bun.**  
> *Laravel's developer experience meets JavaScript's raw speed.*

---

## Key Highlights

- **Bun-Native Engine**: Built directly on `Bun.serve()` with zero intermediate abstraction layers. Sub-millisecond routing and minimal idle heap.
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
# Start development supervisor with hot reloading & Vite HMR
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

## Testing & Building

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

Start in production mode:

```bash
bun run start
```

---

## Documentation Directory

Detailed architectural guides and documentation are available in the `Docs/` directory:

- [Error Infrastructure & Diagnostics Subsystem](Docs/ERROR_HANDLING.md)
- [Active Record ORM Guide](Docs/ORM.md)
- [React 19 Server-Side Rendering Guide](Docs/REACT_SSR.md)
- [HTTP, Controllers, Routing & Security Guide](Docs/HTTP_ROUTING.md)
- [Canonical End-to-End CRUD Walkthrough](Docs/CRUD_WALKTHROUGH.md)
- [System Architecture Report](Docs/architecture_report.md)
- [System Design Specification](Docs/DESIGN.md)
- [Product Requirements Document (PRD)](Docs/PRD.md)
- [Framework Memory & Conventions](Docs/MEMORY.md)
- [Task Register & Milestone Log](Docs/TASK.md)
- [Project Overview & Architectural Decisions](Docs/PROJECT.md)
- [Mandatory Engineering Rules](Docs/RULES.md)

---

## Engineering Standards

ForgeTS enforces strict engineering standards:
- **Zero Emojis**: Prohibited in all source code, technical documentation, CLI output, logs, and error messages (see `Docs/RULES.md` Rule 8).
- **Clean Architecture**: Complete separation of framework core engine (`packages/forge/src/`) and application domain (`app/`).
- **Standard Decorators**: Pure ECMAScript TC39 Stage 3 decorator compliance using `context.metadata`.

---

## License

MIT License. Designed and built for high-performance TypeScript development on Bun.
