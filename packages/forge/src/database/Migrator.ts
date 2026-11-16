// packages/forge/src/database/Migrator.ts
// ─────────────────────────────────────────────────────────────────────
// Database migration runner (artisan migrate equivalent).
//
// Migration files live in database/migrations/ and export:
//   export async function up(db: Kysely<any>): Promise<void>
//   export async function down(db: Kysely<any>): Promise<void>
//
// Files run in filename order (timestamp prefix). Every `migrate` run is
// recorded as one batch in the `migrations` table; `rollback` reverts the
// most recent batch(es) in reverse order.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sql, type Kysely } from 'kysely';

export interface MigrationModule {
  up(db: Kysely<any>): Promise<void>;
  down?(db: Kysely<any>): Promise<void>;
}

export interface MigrationStatus {
  name: string;
  ran: boolean;
  batch: number | null;
  ranAt: string | null;
  /** Recorded in the database but the file no longer exists on disk. */
  missing: boolean;
}

export interface MigrationResult {
  /** Migrations applied / reverted by this call, in execution order. */
  migrations: string[];
  batch: number | null;
  /** Set when a migration failed; earlier ones in `migrations` stay applied. */
  failed?: { name: string; error: Error };
}

export interface MigratorOptions {
  /** Directory containing migration files. */
  directory: string;
  /** Bookkeeping table name (default: 'migrations'). */
  table?: string;
  /** Custom module loader (used by tests). Defaults to dynamic import(). */
  load?: (filePath: string, name: string) => Promise<MigrationModule>;
}

interface MigrationRow {
  migration: string;
  batch: number;
  ran_at: string | null;
}

const MIGRATION_FILE = /^[\w.-]+\.(ts|js|mjs)$/;

export class Migrator {
  private readonly directory: string;
  private readonly table: string;
  private readonly load: (filePath: string, name: string) => Promise<MigrationModule>;

  constructor(private readonly db: Kysely<any>, options: MigratorOptions) {
    this.directory = resolve(options.directory);
    this.table = options.table ?? 'migrations';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(this.table)) {
      throw new Error(`[ForgeTS Migrator] Invalid migrations table name: '${this.table}'.`);
    }
    this.load =
      options.load ??
      (async (filePath) => (await import(pathToFileURL(filePath).href)) as MigrationModule);
  }

  /** Migration names found on disk (filename without extension), sorted. */
  files(): string[] {
    if (!existsSync(this.directory)) return [];
    const names = readdirSync(this.directory)
      .filter((file) => MIGRATION_FILE.test(file) && !file.endsWith('.d.ts'))
      .map((file) => file.replace(/\.(ts|js|mjs)$/, ''));
    const unique = [...new Set(names)].sort();
    if (unique.length !== names.length) {
      throw new Error(
        '[ForgeTS Migrator] Duplicate migration names found (same name with different extensions).',
      );
    }
    return unique;
  }

  private filePath(name: string): string {
    for (const ext of ['ts', 'js', 'mjs']) {
      const candidate = join(this.directory, `${name}.${ext}`);
      if (existsSync(candidate)) return candidate;
    }
    throw new Error(`[ForgeTS Migrator] Migration file not found for '${name}' in ${this.directory}.`);
  }

  /** Create the bookkeeping table if it does not exist yet. */
  async ensureTable(): Promise<void> {
    await this.db.schema
      .createTable(this.table)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('migration', 'varchar(255)', (col) => col.notNull().unique())
      .addColumn('batch', 'integer', (col) => col.notNull())
      .addColumn('ran_at', 'varchar(32)')
      .execute();
  }

  private async tableExists(): Promise<boolean> {
    const tables = await this.db.introspection.getTables();
    return tables.some((t) => t.name === this.table);
  }

  /** Recorded migrations. Read-only: never creates the bookkeeping table. */
  private async rows(): Promise<MigrationRow[]> {
    if (!(await this.tableExists())) return [];
    const rows = await this.db
      .selectFrom(this.table)
      .select(['migration', 'batch', 'ran_at'])
      .orderBy('batch', 'asc')
      .orderBy('migration', 'asc')
      .execute();
    return rows.map((row: any) => ({
      migration: String(row.migration),
      batch: Number(row.batch),
      ran_at: row.ran_at ?? null,
    }));
  }

  /**
   * Status of every migration known on disk or in the database.
   * Read-only: safe to call against any database.
   */
  async status(): Promise<MigrationStatus[]> {
    const ran = new Map((await this.rows()).map((row) => [row.migration, row]));
    const onDisk = this.files();

    const statuses: MigrationStatus[] = onDisk.map((name) => {
      const row = ran.get(name);
      return {
        name,
        ran: Boolean(row),
        batch: row?.batch ?? null,
        ranAt: row?.ran_at ?? null,
        missing: false,
      };
    });

    for (const [name, row] of ran) {
      if (!onDisk.includes(name)) {
        statuses.push({ name, ran: true, batch: row.batch, ranAt: row.ran_at, missing: true });
      }
    }

    return statuses.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Names of migrations that have not been applied yet. */
  async pending(): Promise<string[]> {
    return (await this.status()).filter((s) => !s.ran).map((s) => s.name);
  }

  /**
   * Apply all pending migrations as one batch.
   * Stops at the first failure; migrations applied before it stay recorded.
   */
  async up(): Promise<MigrationResult> {
    const pending = await this.pending();
    if (pending.length === 0) return { migrations: [], batch: null };

    await this.ensureTable();

    const lastBatch = (await this.rows()).reduce((max, row) => Math.max(max, row.batch), 0);
    const batch = lastBatch + 1;
    const applied: string[] = [];

    for (const name of pending) {
      try {
        const mod = await this.load(this.filePath(name), name);
        if (typeof mod.up !== 'function') {
          throw new Error(`Migration '${name}' does not export an up() function.`);
        }
        await mod.up(this.db);
        await this.db
          .insertInto(this.table)
          .values({ migration: name, batch, ran_at: new Date().toISOString() })
          .execute();
        applied.push(name);
      } catch (err) {
        return { migrations: applied, batch, failed: { name, error: toError(err) } };
      }
    }

    return { migrations: applied, batch };
  }

  /**
   * Revert the most recent batch (or the last `steps` batches), newest first.
   */
  async rollback(steps = 1): Promise<MigrationResult> {
    const rows = await this.rows();
    if (rows.length === 0) return { migrations: [], batch: null };

    const batches = [...new Set(rows.map((row) => row.batch))].sort((a, b) => b - a);
    const target = new Set(batches.slice(0, Math.max(1, Math.trunc(steps) || 1)));
    const toRevert = rows
      .filter((row) => target.has(row.batch))
      .sort((a, b) => b.batch - a.batch || b.migration.localeCompare(a.migration));

    return this.revert(toRevert.map((row) => row.migration), batches[0]);
  }

  /** Revert every applied migration, newest first. */
  async reset(): Promise<MigrationResult> {
    const rows = await this.rows();
    const ordered = rows.sort((a, b) => b.batch - a.batch || b.migration.localeCompare(a.migration));
    return this.revert(ordered.map((row) => row.migration), null);
  }

  private async revert(names: string[], batch: number | null): Promise<MigrationResult> {
    const reverted: string[] = [];

    for (const name of names) {
      try {
        const mod = await this.load(this.filePath(name), name);
        if (typeof mod.down !== 'function') {
          throw new Error(`Migration '${name}' does not export a down() function.`);
        }
        await mod.down(this.db);
        await this.db.deleteFrom(this.table).where('migration', '=', name).execute();
        reverted.push(name);
      } catch (err) {
        return { migrations: reverted, batch, failed: { name, error: toError(err) } };
      }
    }

    return { migrations: reverted, batch };
  }

  /**
   * Drop every table in the database, then run all migrations from scratch.
   * DESTRUCTIVE: all data is lost.
   */
  async fresh(): Promise<MigrationResult> {
    const tables = await this.db.introspection.getTables();
    const isMysql = await this.isMysql();

    if (isMysql) await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(this.db);
    try {
      for (const table of tables) {
        if (table.isView) {
          await this.db.schema.dropView(table.name).ifExists().execute();
        } else {
          await this.db.schema.dropTable(table.name).ifExists().execute();
        }
      }
    } finally {
      if (isMysql) await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(this.db);
    }

    return this.up();
  }

  private async isMysql(): Promise<boolean> {
    try {
      const adapterName = (this.db as any).getExecutor?.().adapter?.constructor?.name ?? '';
      return /mysql/i.test(adapterName);
    } catch {
      return false;
    }
  }
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}
