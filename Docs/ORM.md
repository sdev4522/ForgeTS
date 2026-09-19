# ForgeTS Active Record ORM

> Official guide to ForgeTS Active Record ORM, models, QueryBuilder, relationships, multi-driver database persistence, and view serialization.

---

## 1. Overview

ForgeTS includes a TypeScript-first Active Record ORM built on top of Kysely (for relational SQL storage) and native MongoDB drivers (for NoSQL document storage).

### Key Characteristics
- **Active Record Pattern**: Model instances encapsulate both data attributes and database operations (`user.save()`, `user.delete()`).
- **Standard TC39 Stage 3 Decorators**: Uses `@Column()`, `@HasMany()`, `@BelongsTo()`, and `@HasOne()` without legacy `experimentalDecorators`.
- **Transparent Property Access**: Model instances use an ES6 Proxy wrapper. Reading `user.name` or setting `user.email = '...'` operates on internal state while tracking dirty properties and enforcing mass-assignment rules.
- **Unified Multi-Driver Support**: Models can target MySQL or MongoDB while preserving an identical Active Record query and persistence API.
- **Seamless HTTP / SSR Serialization**: Models implement `toJSON()` and integrate with `serializeViewData()` so that `User.all()` or individual models passed to `res.view()` or `res.json()` are serialized automatically without leaking internal structures into React SSR components or hydration payloads.

---

## 2. Defining Models

Models extend `Model` from `@forge/database`. Declare attributes using TypeScript `declare` syntax along with the `@Column()` decorator:

```typescript
// app/models/User.ts
import { Model, Column } from '@forge/database';

export class User extends Model {
  /** Explicit database table name (defaults to pluralized class name) */
  static override table = 'users';

  /** Primary key column name (defaults to 'id') */
  static override primaryKey = 'id';

  /** Enable automatic created_at and updated_at timestamps (default: true) */
  static override timestamps = true;

  /** Mass-assignment allow-list (optional) */
  static override fillable = ['name', 'email', 'password'];

  @Column() declare id: number;
  @Column() declare name: string;
  @Column() declare email: string;
  @Column() declare password: string;
  @Column() declare created_at: string;
  @Column() declare updated_at: string;
}
```

### Model Configuration Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `static table` | `string` | Pluralized name (e.g. `'users'`) | Table or collection name |
| `static primaryKey` | `string` | `'id'` | Primary key column name |
| `static timestamps` | `boolean` | `true` | Automatically manage `created_at` and `updated_at` |
| `static connection` | `string` | `'mysql'` | Connection name (`'mysql'` or `'mongodb'`) |
| `static fillable` | `string[]` | `undefined` | Permitted attributes for mass-assignment |
| `static guarded` | `string[]` | `['id', 'created_at', 'updated_at', 'deleted_at']` | Denied attributes for mass-assignment |

---

## 3. Mass-Assignment Protection

ForgeTS protects against mass-assignment vulnerabilities when hydrating models from HTTP requests:

1. **Allow-List (`fillable`)**: If `fillable` is defined, only the specified keys can be filled via mass assignment (`new User(data)`, `User.create(data)`, `user.fill(data)`).
2. **Deny-List (`guarded`)**: If `fillable` is not set, attributes in `guarded` are stripped. Setting `guarded = ['*']` blocks all mass-assignment.
3. **Safe Default**: If neither `fillable` nor `guarded` is defined, ForgeTS defaults to guarding:
   `['id', 'created_at', 'updated_at', 'deleted_at']`

### Example
```typescript
// Only 'name' and 'email' are written; 'id' and 'is_admin' are ignored
user.fill({
  id: 999,
  name: 'Jane Doe',
  email: 'jane@example.com',
  is_admin: true,
});
```

---

## 4. Querying Records (QueryBuilder)

Every model class provides fluent query builder entrypoints:

### Basic Retrieval
```typescript
// Retrieve all records as an array of Model instances
const users = await User.all();

// Find by primary key (returns Model instance or null)
const user = await User.find(1);

// Find by primary key or throw an Error if missing
const user = await User.findOrFail(1);
```

### Fluent Filtering & Sorting
```typescript
// Simple equality filter
const activeUsers = await User.where('status', 'active').get();

// Comparison operators (=, !=, >, >=, <, <=)
const seniors = await User.where('age', '>=', 65).get();

// Range queries
const recent = await User.whereBetween('id', [10, 50]).get();

// Ordering and pagination
const page = await User.where('status', 'active')
  .orderBy('created_at', 'desc')
  .limit(20)
  .offset(40)
  .get();

// First match
const firstAdmin = await User.where('role', 'admin').first();
const requiredAdmin = await User.where('role', 'admin').firstOrFail();
```

---

## 5. Persistence Operations

### Creating Records
```typescript
// Approach 1: Static create (mass-assignment filtered, automatically saved)
const user = await User.create({
  name: 'Alice',
  email: 'alice@example.com',
  password: 'hashed-password',
});

// Approach 2: Instantiation followed by save
const user = new User();
user.name = 'Bob';
user.email = 'bob@example.com';
await user.save();
```

### Updating Records
```typescript
const user = await User.findOrFail(id);

// Update properties directly
user.name = 'Alice Smith';
await user.save();

// Update with mass-assignment filtering
await user.update({
  name: 'Alice Johnson',
  email: 'alice.johnson@example.com',
});
```

### Deleting Records
```typescript
const user = await User.findOrFail(id);
await user.delete();
```

---

## 6. Relationships

Relationships are defined on model classes using TC39 Stage 3 field decorators:

```typescript
// app/models/User.ts
import { Model, Column, HasMany } from '@forge/database';
import { Post } from './Post.js';

export class User extends Model {
  static override table = 'users';

  @Column() declare id: number;
  @Column() declare name: string;

  @HasMany(() => Post, 'user_id')
  declare posts: Post[];
}
```

```typescript
// app/models/Post.ts
import { Model, Column, BelongsTo } from '@forge/database';
import { User } from './User.js';

export class Post extends Model {
  static override table = 'posts';

  @Column() declare id: number;
  @Column() declare user_id: number;
  @Column() declare title: string;

  @BelongsTo(() => User, 'user_id')
  declare author: User;
}
```

### Eager Loading
Load related records efficiently using `.with('relationName')`:

```typescript
// Eager-load posts for all users in a single query
const users = await User.query().with('posts').get();

// Eager-load author for a post
const posts = await Post.query().with('author').get();
```

---

## 7. Model Serialization & React SSR Boundary

### Internal Architecture vs Public API
- **Internal State**: The raw database attributes are stored internally on the instance (`this._attributes`).
- **Proxy Trapping**: The model constructor returns an ES6 Proxy. Property reads and writes operate on `this._attributes`.
- **Object Reflection**: The proxy implements `ownKeys`, `has`, and `getOwnPropertyDescriptor`. Therefore, native reflection operations (`Object.keys(user)`, `Object.entries(user)`, `{ ...user }`) reflect the attributes directly without leaking `_attributes`.
- **Public API Principle**: Application code should never reference `_attributes`. Always use property access (`user.name`), `user.toJSON()`, or the query methods.

### Automatic View & JSON Serialization
When returning data from a controller:

```typescript
// app/controllers/UserController.ts
@Get('/')
async index(req: Request, res: ForgeResponse) {
  const users = await User.all();

  // Passing Model instances directly to res.view() is 100% safe
  return res.view('user', {
    userData: users,
  });
}
```

1. `ForgeResponse.view()` and `ReactEngine.renderPage()` execute `serializeViewData()` on all view data.
2. `serializeViewData()` detects Model instances (or any object with a `toJSON()` method) and unwraps them into plain JavaScript objects recursively.
3. React components receive plain data:
   ```typescript
   interface UserPageProps extends PageProps {
     userData?: Array<{ id: number; name: string; email: string }>;
   }
   ```
4. Client hydration payloads in `<script id="__FORGETS_DATA__">` contain clean, deterministic JSON without internal active record methods or circular references.

---

## 8. Multi-Driver Support: MySQL & MongoDB

ForgeTS supports both relational SQL (MySQL via Kysely) and document stores (MongoDB via official `mongodb` client):

### MongoDB Model Configuration
```typescript
// app/models/LogEntry.ts
import { Model, Column } from '@forge/database';

export class LogEntry extends Model {
  static override table = 'logs';
  static override connection = 'mongodb';
  static override primaryKey = '_id';

  @Column() declare _id: string;
  @Column() declare message: string;
  @Column() declare level: string;
  @Column() declare created_at: string;
}
```

The exact same Active Record API (`find`, `where`, `create`, `save`, `delete`) works across both drivers.
