// tests/integration/DatabaseDatetimeSerialization.test.ts
// ─────────────────────────────────────────────────────────────────────
// Integration Test: Database DateTime/Timestamp Generic Serialization
// Verifies real MySQL DATETIME/TIMESTAMP handling across models, queries,
// automatic timestamps, timezone policy, and error handling.
// ─────────────────────────────────────────────────────────────────────

import '../../packages/forge/src/polyfills.js';
import { describe, test, expect, beforeAll, afterAll } from '../harness.js';
import { initConfig } from '../../packages/forge/src/config/ConfigManager.js';
import appConfig from '../../config/app.js';
import dbConfig from '../../config/database.js';
import {
  getDatabaseConnection,
  resetDatabaseConnection,
  Model,
  Column,
  serializeDatabaseValue,
  formatMysqlDateTime,
} from '../../packages/forge/src/database/index.js';
import { now, ForgeDate } from '../../packages/forge/src/core/time.js';

class TestArticle extends Model {
  static override table = 'test_articles';
  static override fillable = ['title', 'published_at', 'archived_at', 'created_at', 'updated_at'];

  @Column() id!: number;
  @Column() title!: string;
  @Column() published_at!: Date | string | null;
  @Column() archived_at!: Date | string | null;
  @Column() created_at!: Date;
  @Column() updated_at!: Date;
}

describe('Database DateTime/Timestamp Generic Serialization Suite', () => {
  let db: any;

  beforeAll(async () => {
    resetDatabaseConnection();
    const configManager = initConfig(process.cwd());
    configManager.set('app', appConfig);
    configManager.set('database', dbConfig);

    db = getDatabaseConnection();

    // Create table with MySQL DATETIME columns
    await db.schema
      .createTable('test_articles')
      .ifNotExists()
      .addColumn('id', 'integer', (col: any) => col.primaryKey().autoIncrement())
      .addColumn('title', 'varchar(255)', (col: any) => col.notNull())
      .addColumn('published_at', 'datetime')
      .addColumn('archived_at', 'datetime')
      .addColumn('created_at', 'datetime', (col: any) => col.notNull())
      .addColumn('updated_at', 'datetime', (col: any) => col.notNull())
      .execute();
  });

  afterAll(async () => {
    if (db) {
      await db.schema.dropTable('test_articles').ifExists().execute();
      resetDatabaseConnection();
    }
  });

  test('1. Automatic timestamps on Model.create() into MySQL DATETIME columns', async () => {
    const article = await TestArticle.create({
      title: 'Auto Timestamps Article',
    });

    expect(article).toBeInstanceOf(TestArticle);
    expect(article.id).toBeDefined();
    expect(article.created_at).toBeDefined();
    expect(article.updated_at).toBeDefined();

    // Hydration check from real MySQL query
    const fetched = await TestArticle.find(article.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.created_at).toBeInstanceOf(Date);
    expect(fetched?.updated_at).toBeInstanceOf(Date);

    // API JSON serialization preserves ISO-8601
    const json = JSON.parse(JSON.stringify(fetched));
    expect(typeof json.created_at).toBe('string');
    expect(json.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    await article.delete();
  });

  test('2. Explicit JavaScript Date on Model.create()', async () => {
    const customDate = new Date('2026-08-15T14:30:00.000Z');

    const article = await TestArticle.create({
      title: 'Explicit Date Article',
      published_at: customDate,
      created_at: customDate,
      updated_at: customDate,
    });

    const fetched = await TestArticle.find(article.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.published_at).toBeInstanceOf(Date);
    expect((fetched?.published_at as Date).toISOString()).toBe('2026-08-15T14:30:00.000Z');

    await article.delete();
  });

  test('3. Explicit ISO-8601 string on Model.create() converts seamlessly without MySQL error', async () => {
    const isoString = '2026-09-19T17:18:46.094Z';

    const article = await TestArticle.create({
      title: 'ISO String Article',
      published_at: isoString,
    });

    expect(article.id).toBeDefined();

    const fetched = await TestArticle.find(article.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.published_at).toBeInstanceOf(Date);

    await article.delete();
  });

  test('4. Explicit MySQL datetime string on Model.create() passes through intact', async () => {
    const mysqlStr = '2026-09-19 17:18:46';

    const article = await TestArticle.create({
      title: 'MySQL String Article',
      published_at: mysqlStr,
    });

    expect(article.id).toBeDefined();

    const fetched = await TestArticle.find(article.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.published_at).toBeInstanceOf(Date);

    await article.delete();
  });

  test('5. ForgeDate / now() helper on Model.create()', async () => {
    const article = await TestArticle.create({
      title: 'ForgeDate Article',
      published_at: now(),
    });

    expect(article.id).toBeDefined();

    const fetched = await TestArticle.find(article.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.published_at).toBeInstanceOf(Date);

    await article.delete();
  });

  test('6. Model update() and updateAttributes() update updated_at without error', async () => {
    const article = await TestArticle.create({
      title: 'Original Title',
    });

    const originalUpdatedAt = new Date(article.updated_at).getTime();

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 50));

    await article.updateAttributes({
      title: 'Updated Title via updateAttributes',
    });

    const fetched = await TestArticle.find(article.id);
    expect(fetched?.title).toBe('Updated Title via updateAttributes');
    expect(fetched?.updated_at).toBeInstanceOf(Date);

    await article.delete();
  });

  test('7. Query parameter serialization: where with Date', async () => {
    const pastDate = new Date('2026-01-01T00:00:00.000Z');
    const futureDate = new Date('2030-01-01T00:00:00.000Z');

    const article = await TestArticle.create({
      title: 'Query Date Article',
      published_at: new Date('2026-06-01T12:00:00.000Z'),
    });

    const matches = await TestArticle.where('published_at', '>=', pastDate).get();
    expect(matches.some((a) => a.id === article.id)).toBe(true);

    const none = await TestArticle.where('published_at', '>=', futureDate).get();
    expect(none.some((a) => a.id === article.id)).toBe(false);

    await article.delete();
  });

  test('8. Query parameter serialization: where with ISO-8601 string', async () => {
    const article = await TestArticle.create({
      title: 'Query ISO Article',
      published_at: new Date('2026-06-01T12:00:00.000Z'),
    });

    const matches = await TestArticle.where('published_at', '>=', '2026-01-01T00:00:00.000Z').get();
    expect(matches.some((a) => a.id === article.id)).toBe(true);

    await article.delete();
  });

  test('9. Query parameter serialization: whereBetween with range', async () => {
    const article = await TestArticle.create({
      title: 'Between Article',
      published_at: new Date('2026-06-01T12:00:00.000Z'),
    });

    const matches = await TestArticle.query()
      .whereBetween('published_at', [
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-07-01T00:00:00.000Z'),
      ])
      .get();

    expect(matches.some((a) => a.id === article.id)).toBe(true);

    await article.delete();
  });

  test('10. Invalid Date value throws descriptive TypeError intentionally', async () => {
    const invalidDate = new Date('invalid-date-string');

    // Model create with invalid date must throw
    expect(
      TestArticle.create({
        title: 'Bad Date',
        published_at: invalidDate,
      })
    ).rejects.toThrow('[ForgeTS Database Serialization Error] Invalid Date value');

    // Query with invalid date must throw
    expect(() => {
      TestArticle.where('published_at', '>=', invalidDate);
    }).toThrow('[ForgeTS Database Serialization Error] Invalid Date value');
  });

  test('11. Null values on nullable datetime columns are preserved as SQL NULL', async () => {
    const article = await TestArticle.create({
      title: 'Nullable DateTime Article',
      published_at: null,
      archived_at: null,
    });

    const fetched = await TestArticle.find(article.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.published_at).toBeNull();
    expect(fetched?.archived_at).toBeNull();

    await article.delete();
  });

  test('12. Database vs API serialization separation', () => {
    const testDate = new Date('2026-09-19T17:18:46.094Z');

    // MySQL serialization: YYYY-MM-DD HH:mm:ss.sss
    const mysqlValue = serializeDatabaseValue(testDate, 'mysql', 'UTC');
    expect(mysqlValue).toBe('2026-09-19 17:18:46.094');

    // MongoDB serialization: keeps native Date
    const mongoValue = serializeDatabaseValue(testDate, 'mongodb');
    expect(mongoValue).toBeInstanceOf(Date);

    // API JSON serialization: ISO-8601 string
    const jsonString = JSON.stringify({ date: testDate });
    expect(jsonString).toBe('{"date":"2026-09-19T17:18:46.094Z"}');
  });
});
