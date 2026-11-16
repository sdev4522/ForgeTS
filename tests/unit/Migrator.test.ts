// tests/unit/Migrator.test.ts
// ─────────────────────────────────────────────────────────────────────
// Migration runner: ordering, batches, rollback, reset, fresh, failures.
// Runs against a real in-memory SQLite engine.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect, beforeEach, afterEach } from '../harness.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import { Migrator } from '@forge/database';
import { createTestDatabase } from '../sqlite.js';

const createTable = (table: string) => `
export async function up(db) {
  await db.schema.createTable('${table}').addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement()).addColumn('name', 'varchar(50)').execute();
}
export async function down(db) {
  await db.schema.dropTable('${table}').execute();
}
`;

describe('Migrator', () => {
  let db: Kysely<any>;
  let dir: string;
  let migrator: Migrator;

  const tables = async () =>
    (await db.introspection.getTables()).map((t) => t.name).filter((n) => n !== 'migrations').sort();
  const add = (name: string, source: string) => writeFileSync(join(dir, `${name}.mjs`), source);

  beforeEach(() => {
    db = createTestDatabase();
    dir = mkdtempSync(join(tmpdir(), 'forge-migrations-'));
    migrator = new Migrator(db, { directory: dir });
  });

  afterEach(async () => {
    await db.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  test('runs pending migrations in filename order as one batch', async () => {
    add('20260102000000_create_posts', createTable('posts'));
    add('20260101000000_create_users', createTable('users'));

    const result = await migrator.up();
    expect(result.failed).toBeUndefined();
    expect(result.batch).toBe(1);
    expect(result.migrations).toEqual(['20260101000000_create_users', '20260102000000_create_posts']);
    expect(await tables()).toEqual(['posts', 'users']);
  });

  test('is idempotent and assigns a new batch to later migrations', async () => {
    add('20260101000000_create_users', createTable('users'));
    await migrator.up();
    expect((await migrator.up()).migrations).toEqual([]);

    add('20260103000000_create_tags', createTable('tags'));
    const second = await migrator.up();
    expect(second.batch).toBe(2);
    expect(second.migrations).toEqual(['20260103000000_create_tags']);
  });

  test('status reports ran, pending and missing files', async () => {
    add('20260101000000_create_users', createTable('users'));
    await migrator.up();
    add('20260102000000_create_posts', createTable('posts'));

    const status = await migrator.status();
    expect(status.map((s) => [s.name, s.ran, s.batch])).toEqual([
      ['20260101000000_create_users', true, 1],
      ['20260102000000_create_posts', false, null],
    ]);
    expect(await migrator.pending()).toEqual(['20260102000000_create_posts']);

    rmSync(join(dir, '20260101000000_create_users.mjs'));
    const missing = (await migrator.status()).find((s) => s.name.endsWith('create_users'));
    expect(missing?.missing).toBe(true);
  });

  test('rollback reverts only the latest batch, newest first', async () => {
    add('20260101000000_create_users', createTable('users'));
    await migrator.up();
    add('20260102000000_create_posts', createTable('posts'));
    add('20260103000000_create_tags', createTable('tags'));
    await migrator.up();

    const result = await migrator.rollback();
    expect(result.migrations).toEqual(['20260103000000_create_tags', '20260102000000_create_posts']);
    expect(await tables()).toEqual(['users']);

    // --step=2 style: nothing but batch 1 is left
    expect((await migrator.rollback(2)).migrations).toEqual(['20260101000000_create_users']);
    expect(await tables()).toEqual([]);
    expect((await migrator.rollback()).migrations).toEqual([]);
  });

  test('reset reverts everything; fresh rebuilds from scratch', async () => {
    add('20260101000000_create_users', createTable('users'));
    add('20260102000000_create_posts', createTable('posts'));
    await migrator.up();
    await db.insertInto('users').values({ name: 'kept?' }).execute();

    const fresh = await migrator.fresh();
    expect(fresh.migrations.length).toBe(2);
    expect(await db.selectFrom('users').selectAll().execute()).toEqual([]);

    const reset = await migrator.reset();
    expect(reset.migrations).toEqual(['20260102000000_create_posts', '20260101000000_create_users']);
    expect(await tables()).toEqual([]);
  });

  test('stops at the first failing migration and keeps earlier ones recorded', async () => {
    add('20260101000000_create_users', createTable('users'));
    add('20260102000000_broken', `export async function up() { throw new Error('boom'); }\nexport async function down() {}`);
    add('20260103000000_create_tags', createTable('tags'));

    const result = await migrator.up();
    expect(result.migrations).toEqual(['20260101000000_create_users']);
    expect(result.failed?.name).toBe('20260102000000_broken');
    expect(result.failed?.error.message).toBe('boom');
    expect(await tables()).toEqual(['users']);
    expect(await migrator.pending()).toEqual(['20260102000000_broken', '20260103000000_create_tags']);
  });

  test('a migration without down() cannot be rolled back and stays recorded', async () => {
    add('20260101000000_no_down', `export async function up(db) { await db.schema.createTable('x').addColumn('id', 'integer').execute(); }`);
    await migrator.up();

    const result = await migrator.rollback();
    expect(result.failed?.error.message).toContain('down()');
    expect(await migrator.pending()).toEqual([]);
  });

  test('rejects unsafe bookkeeping table names', () => {
    expect(() => new Migrator(db, { directory: dir, table: 'x; drop table users' })).toThrow();
  });
});
