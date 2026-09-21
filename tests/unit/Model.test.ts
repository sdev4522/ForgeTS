// tests/unit/Model.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';
import {
  Kysely,
  DummyDriver,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type Dialect,
  type Driver,
  type DatabaseConnection,
  type CompiledQuery,
  type QueryResult,
} from 'kysely';
import { Model, Column, HasMany, BelongsTo, setDatabaseConnection } from '../../packages/forge/src/database/index.js';
import { initConfig } from '../../packages/forge/src/config/ConfigManager.js';
import appConfig from '../../config/app.js';
import dbConfig from '../../config/database.js';

// ─── Lightweight In-Memory Mock SQL Dialect ───

class MemoryConnection implements DatabaseConnection {
  private tables: Record<string, any[]> = {};
  private autoIds: Record<string, number> = {};

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const sql = compiledQuery.sql;
    const params = compiledQuery.parameters as any[];

    if (sql.includes('create table')) {
      const match = sql.match(/create table "?(\w+)"?/i);
      if (match) {
        const table = match[1];
        this.tables[table] = [];
        this.autoIds[table] = 1;
      }
      return { rows: [] };
    }

    if (sql.startsWith('insert into')) {
      const match = sql.match(/insert into "?(\w+)"?/i);
      const table = match ? match[1] : 'unknown';
      if (!this.tables[table]) this.tables[table] = [];
      const id = this.autoIds[table]++;

      // Infer column names from query
      const colMatch = sql.match(/\(([^)]+)\)\s+values/i);
      const cols = colMatch ? colMatch[1].split(',').map((c) => c.trim().replace(/"/g, '')) : [];

      const record: any = { id };
      cols.forEach((col, idx) => {
        record[col] = params[idx];
      });

      this.tables[table].push(record);
      return { insertId: BigInt(id), numAffectedRows: BigInt(1), rows: [] };
    }

    if (sql.startsWith('select')) {
      const match = sql.match(/from "?(\w+)"?/i);
      const table = match ? match[1] : '';
      let rows = [...(this.tables[table] || [])];

      // Simple where id = ? or user_id in (?) filter
      if (sql.includes('where')) {
        if (sql.includes('"id" =') || sql.includes('id =')) {
          const targetId = Number(params[0]);
          rows = rows.filter((r) => r.id === targetId);
        } else if (sql.includes('"user_id" in') || sql.includes('user_id in')) {
          const ids = params.map(Number);
          rows = rows.filter((r) => ids.includes(r.user_id));
        } else if (sql.includes('email =') || sql.includes('"email" =')) {
          rows = rows.filter((r) => r.email === params[0]);
        }
      }

      return { rows: rows as R[] };
    }

    if (sql.startsWith('update')) {
      const match = sql.match(/update "?(\w+)"?/i);
      const table = match ? match[1] : '';
      const targetId = Number(params[params.length - 1]);
      const records = this.tables[table] || [];
      const item = records.find((r) => r.id === targetId);
      if (item) {
        const setMatch = sql.match(/set\s+(.+?)\s+where/i);
        if (setMatch) {
          const sets = setMatch[1].split(',').map((s) => s.split('=')[0].trim().replace(/"/g, ''));
          sets.forEach((col, idx) => {
            item[col] = params[idx];
          });
        }
      }
      return { numAffectedRows: BigInt(1), rows: [] };
    }

    if (sql.startsWith('delete from')) {
      const match = sql.match(/delete from "?(\w+)"?/i);
      const table = match ? match[1] : '';
      const targetId = Number(params[0]);
      if (this.tables[table]) {
        this.tables[table] = this.tables[table].filter((r) => r.id !== targetId);
      }
      return { numAffectedRows: BigInt(1), rows: [] };
    }

    return { rows: [] };
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Not implemented');
  }
}

class MemoryDriver implements Driver {
  private conn = new MemoryConnection();
  async init() {}
  async acquireConnection() { return this.conn; }
  async releaseConnection() {}
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
  async destroy() {}
}

class MemorySqlDialect implements Dialect {
  createDriver() { return new MemoryDriver(); }
  createQueryCompiler() { return new SqliteQueryCompiler(); }
  createAdapter() { return new SqliteAdapter(); }
  createIntrospector(db: Kysely<any>) { return new SqliteIntrospector(db); }
}

// ─── Test Models ───

class User extends Model {
  static override table = 'users';

  @Column() id!: number;
  @Column() name!: string;
  @Column() email!: string;

  @HasMany(() => Post, 'user_id')
  posts!: Post[];
}

class Post extends Model {
  static override table = 'posts';

  @Column() id!: number;
  @Column() title!: string;
  @Column() user_id!: number;

  @BelongsTo(() => User, 'user_id')
  author!: User;
}

describe('Active Record Model & QueryBuilder', () => {
  beforeAll(async () => {
    const configManager = initConfig(process.cwd());
    configManager.set('app', appConfig);
    configManager.set('database', dbConfig);

    const db = new Kysely<any>({
      dialect: new MemorySqlDialect(),
    });
    setDatabaseConnection(db);

    await db.schema
      .createTable('users')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('name', 'text')
      .addColumn('email', 'text')
      .addColumn('created_at', 'text')
      .addColumn('updated_at', 'text')
      .execute();

    await db.schema
      .createTable('posts')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('title', 'text')
      .addColumn('user_id', 'integer')
      .execute();
  });

  test('Model.create() and Model.find()', async () => {
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
    });

    expect(user).toBeInstanceOf(User);
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');

    const found = await User.find(user.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('John Doe');
  });

  test('Model.where() and save() update', async () => {
    const user = await User.where('email', '=', 'john@example.com').first();
    expect(user).not.toBeNull();

    if (user) {
      user.fill({ name: 'Jane Doe' });
      await user.save();

      const updated = await User.find(user.id);
      expect(updated?.name).toBe('Jane Doe');
    }
  });

  test('Relationships: HasMany & BelongsTo eager loading', async () => {
    const user = await User.create({
      name: 'Author User',
      email: 'author@example.com',
    });

    await Post.create({ title: 'Post 1', user_id: user.id });
    await Post.create({ title: 'Post 2', user_id: user.id });

    const userWithPosts = await User.where('id', '=', user.id).with('posts').first();
    expect(userWithPosts).not.toBeNull();
    expect(userWithPosts?.posts).toBeArray();
    expect(userWithPosts?.posts.length).toBe(2);

    const postWithAuthor = await Post.where('id', '=', 1).with('author').first();
    expect(postWithAuthor).not.toBeNull();
  });

  test('Model.delete()', async () => {
    const tempUser = await User.create({
      name: 'Temp User',
      email: 'temp@example.com',
    });

    await tempUser.delete();
    const deleted = await User.find(tempUser.id);
    expect(deleted).toBeNull();
  });
});
