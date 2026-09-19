# Canonical CRUD Walkthrough in ForgeTS

> An end-to-end, production-grade tutorial implementing a complete CRUD flow with Active Record models, migrations, controllers, input validation, CSRF protection, and React 19 SSR.

---

## 1. Step 1: Database Migration

Create a migration file in `database/migrations/`:

```typescript
// database/migrations/20260920000001_create_users_table.ts
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'varchar(255)')
    .addColumn('updated_at', 'varchar(255)')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('users').execute();
}
```

---

## 2. Step 2: Active Record Model

Create the model in `app/models/User.ts`:

```typescript
// app/models/User.ts
import { Model, Column } from '@forge/database';

export class User extends Model {
  static override table = 'users';
  static override fillable = ['name', 'email', 'password'];

  @Column() declare id: number;
  @Column() declare name: string;
  @Column() declare email: string;
  @Column() declare password: string;
  @Column() declare created_at: string;
  @Column() declare updated_at: string;
}
```

---

## 3. Step 3: Controller with Full CRUD Actions

Implement the controller in `app/controllers/UserController.ts`:

```typescript
// app/controllers/UserController.ts
import { Controller, Get, Post, Put, Delete, Hash } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { User } from '@/models/User.js';

@Controller('/users')
export class UserController {
  /**
   * GET /users
   * Lists all users and renders the React SSR page.
   */
  @Get('/')
  async index(_req: Request, res: ForgeResponse) {
    const users = await User.all();

    // Model instances are serialized automatically before reaching React SSR
    return res.view('user', {
      title: 'User Management',
      userData: users,
    });
  }

  /**
   * GET /users/:id
   * Returns a single user as JSON.
   */
  @Get('/:id')
  async show(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) {
      return res.notFound('User not found');
    }
    return res.json(user);
  }

  /**
   * POST /users
   * Validates input, hashes password, persists model, and redirects or returns 201.
   */
  @Post('/')
  async store(req: Request, res: ForgeResponse) {
    const data = await req.validate({
      name: 'required|string|min:2',
      email: 'required|email',
      password: 'required|string|min:8',
    });

    const hashedPassword = await Hash.make(data.password);

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
    });

    if (req.wantsJson()) {
      return res.created(user);
    }

    return res.redirect('/users');
  }

  /**
   * PUT /users/:id
   * Updates an existing user record.
   */
  @Put('/:id')
  async update(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) {
      return res.notFound('User not found');
    }

    const data = await req.validate({
      name: 'string|min:2',
      email: 'email',
    });

    await user.update(data);
    return res.json(user);
  }

  /**
   * DELETE /users/:id
   * Deletes a user record.
   */
  @Delete('/:id')
  async destroy(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) {
      return res.notFound('User not found');
    }

    await user.delete();
    return res.noContent();
  }
}
```

---

## 4. Step 4: React 19 SSR Page

Implement the React SSR page in `resources/js/pages/user.tsx`:

```tsx
// resources/js/pages/user.tsx
import React from 'react';
import type { PageProps } from '@/types';

export interface UserItem {
  id: number;
  name: string;
  email: string;
}

export interface UserPageProps extends PageProps {
  title?: string;
  userData?: UserItem[];
}

export default function UserPage({
  csrf_token,
  title = 'Users',
  userData = [],
}: UserPageProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', color: '#f8fafc' }}>
      <h1>{title}</h1>

      {/* Creation Form */}
      <form action="/users" method="POST" style={{ marginBottom: '2rem' }}>
        {/* CSRF Token Verification */}
        <input type="hidden" name="_token" value={csrf_token} />

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Name</label>
          <input type="text" name="name" required placeholder="Full Name" />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Email</label>
          <input type="email" name="email" required placeholder="name@example.com" />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Password</label>
          <input type="password" name="password" required minLength={8} />
        </div>

        <button type="submit">Create User</button>
      </form>

      {/* User Records Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}>
            <th style={{ padding: '0.5rem' }}>ID</th>
            <th style={{ padding: '0.5rem' }}>Name</th>
            <th style={{ padding: '0.5rem' }}>Email</th>
            <th style={{ padding: '0.5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {userData.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                No users found.
              </td>
            </tr>
          ) : (
            userData.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '0.5rem' }}>{user.id}</td>
                <td style={{ padding: '0.5rem' }}>{user.name}</td>
                <td style={{ padding: '0.5rem' }}>{user.email}</td>
                <td style={{ padding: '0.5rem' }}>
                  <form action={`/users/${user.id}/delete`} method="POST" style={{ display: 'inline' }}>
                    <input type="hidden" name="_token" value={csrf_token} />
                    <button type="submit" style={{ color: '#ef4444' }}>Delete</button>
                  </form>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 5. Step 5: Route Registration

Ensure the controller is registered in `routes/web.ts`:

```typescript
// routes/web.ts
import { Router, CsrfMiddleware } from '@forge/core';
import { UserController } from '@/controllers/UserController.js';

const router = new Router();

router.middleware(CsrfMiddleware);
router.controller(UserController);

export default router;
```

---

## 6. How Serialization Works in this Flow

1. The controller retrieves `const users = await User.all();`.
2. `users` is an array of `User` instances wrapping private `_attributes`.
3. The controller returns `res.view('user', { userData: users })`.
4. `ForgeResponse.view()` and `ReactEngine.renderPage()` recursively process `{ userData: users }` using `serializeViewData()`.
5. Each `User` instance's `.toJSON()` method is called, extracting only its database columns into a clean plain object.
6. The React component renders without encountering active record methods, proxies, or circular references.
7. The `<script id="__FORGETS_DATA__">` client payload is serialized without leaking `_attributes`.
