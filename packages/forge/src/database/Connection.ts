// packages/forge/src/database/Connection.ts
// ─────────────────────────────────────────────────────────────────────
// Kysely Database Connection Manager for Bun.
// Uses native BunDatabase for SQLite and mysql2 for MySQL.
// ─────────────────────────────────────────────────────────────────────

import {
  Kysely,
  MysqlDialect,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type Dialect,
  type Driver,
  type DatabaseConnection,
  type CompiledQuery,
  type QueryResult,
} from 'kysely';
import { Database as BunDatabase } from 'bun:sqlite';
import mysql from 'mysql2';
import { dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { config } from '../config/ConfigManager.js';

// ─── Bun Native SQLite Driver for Kysely ───

class BunConnection implements DatabaseConnection {
  constructor(private db: BunDatabase) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const sql = compiledQuery.sql;
    const params = compiledQuery.parameters as any[];
    const isSelect = /^\s*(select|pragma|with)/i.test(sql) || sql.toLowerCase().includes('returning');

    if (isSelect) {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as R[];
      return { rows };
    } else {
      const stmt = this.db.prepare(sql);
      const info = stmt.run(...params);
      return {
        insertId: info.lastInsertRowid !== undefined ? BigInt(info.lastInsertRowid) : undefined,
        numUpdatedOrDeletedRows: BigInt(info.changes),
        rows: [],
      };
    }
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('[ForgeTS] Streaming queries are not supported on Bun SQLite driver.');
  }
}

class BunDriver implements Driver {
  private connection: BunConnection;

  constructor(private db: BunDatabase) {
    this.connection = new BunConnection(db);
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.connection;
  }

  async releaseConnection(): Promise<void> {}

  async beginTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({ sql: 'BEGIN', parameters: [], query: {} as any });
  }

  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({ sql: 'COMMIT', parameters: [], query: {} as any });
  }

  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({ sql: 'ROLLBACK', parameters: [], query: {} as any });
  }

  async destroy(): Promise<void> {
    this.db.close();
  }
}

export class ForgeBunSqliteDialect implements Dialect {
  constructor(private db: BunDatabase) {}

  createDriver(): Driver {
    return new BunDriver(this.db);
  }

  createQueryCompiler() {
    return new SqliteQueryCompiler();
  }

  createAdapter() {
    return new SqliteAdapter();
  }

  createIntrospector(db: Kysely<any>) {
    return new SqliteIntrospector(db);
  }
}

// ─── Connection Manager ───

let _kyselyInstance: Kysely<any> | null = null;

export function getDatabaseConnection(): Kysely<any> {
  if (_kyselyInstance) {
    return _kyselyInstance;
  }

  const defaultConnectionName = config<string>('database.default', 'mysql');
  const connConfig = config<any>(`database.connections.${defaultConnectionName}`);

  if (!connConfig) {
    throw new Error(`[ForgeTS] Database connection '${defaultConnectionName}' is not defined in config/database.ts.`);
  }

  if (connConfig.driver === 'mysql') {
    const pool = mysql.createPool({
      host: connConfig.host ?? '127.0.0.1',
      port: connConfig.port ?? 3306,
      database: connConfig.database,
      user: connConfig.username ?? connConfig.user ?? 'root',
      password: connConfig.password ?? '',
      connectionLimit: 10,
    });

    _kyselyInstance = new Kysely<any>({
      dialect: new MysqlDialect({ pool: pool as any }),
    });
  } else if (connConfig.driver === 'sqlite') {
    const dbPath = connConfig.filename ?? './storage/database.sqlite';
    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    const bunDb = new BunDatabase(dbPath);
    _kyselyInstance = new Kysely<any>({
      dialect: new ForgeBunSqliteDialect(bunDb),
    });
  } else {
    throw new Error(`[ForgeTS] Driver '${connConfig.driver}' is not configured.`);
  }

  return _kyselyInstance;
}

export function setDatabaseConnection(db: Kysely<any>): void {
  _kyselyInstance = db;
}
