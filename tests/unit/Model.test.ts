// tests/unit/Model.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';
import { Kysely } from 'kysely';
import { Database as BunDatabase } from 'bun:sqlite';
import { Model, Column, HasMany, BelongsTo, getDatabaseConnection, setDatabaseConnection, ForgeBunSqliteDialect } from '../../packages/forge/src/database/index.js';
import { initConfig } from '../../packages/forge/src/config/ConfigManager.js';
import appConfig from '../../config/app.js';
import dbConfig from '../../config/database.ts';

// ─── Test Models ───

class User extends Model {
  static override table = 'users';

  @Column() declare id: number;
  @Column() declare name: string;
  @Column() declare email: string;

  @HasMany(() => Post, 'user_id')
  declare posts: Post[];
}

class Post extends Model {
  static override table = 'posts';

  @Column() declare id: number;
  @Column() declare title: string;
  @Column() declare user_id: number;

  @BelongsTo(() => User, 'user_id')
  declare author: User;
}

describe('Active Record Model & QueryBuilder', () => {
  beforeAll(async () => {
    // Init config and in-memory SQLite database
    const configManager = initConfig(process.cwd());
    configManager.set('app', appConfig);
    configManager.set('database', dbConfig);

    const bunDb = new BunDatabase(':memory:');
    const db = new Kysely<any>({
      dialect: new ForgeBunSqliteDialect(bunDb),
    });
    setDatabaseConnection(db);

    // Create test tables
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
      .addColumn('created_at', 'text')
      .addColumn('updated_at', 'text')
      .execute();
  });

  test('Model.create() and Model.find()', async () => {
    const user = await User.create({ name: 'Alice', email: 'alice@example.com' });
    expect(user.id).toBeDefined();
    expect(user.name).toBe('Alice');

    const found = await User.find(user.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Alice');
  });

  test('Model.where() and save() update', async () => {
    const user = await User.create({ name: 'Bob', email: 'bob@example.com' });
    user.name = 'Robert';
    await user.save();

    const updated = await User.where('email', 'bob@example.com').first();
    expect(updated?.name).toBe('Robert');
  });

  test('Relationships: HasMany & BelongsTo eager loading', async () => {
    const user = await User.create({ name: 'Charlie', email: 'charlie@example.com' });
    const post1 = await Post.create({ title: 'First Post', user_id: user.id });
    const post2 = await Post.create({ title: 'Second Post', user_id: user.id });

    // Test with .with('posts')
    const userWithPosts = await User.where('id', user.id).with('posts').first();
    expect(userWithPosts?.posts).toBeDefined();
    expect(userWithPosts?.posts.length).toBe(2);
    expect(userWithPosts?.posts[0].title).toBe('First Post');

    // Test inverse with .with('author')
    const postWithAuthor = await Post.where('id', post1.id).with('author').first();
    expect(postWithAuthor?.author).toBeDefined();
    expect(postWithAuthor?.author.name).toBe('Charlie');
  });

  test('Model.delete()', async () => {
    const user = await User.create({ name: 'Dave', email: 'dave@example.com' });
    await user.delete();

    const found = await User.find(user.id);
    expect(found).toBeNull();
  });
});
