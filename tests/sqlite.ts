// tests/sqlite.ts
// ─────────────────────────────────────────────────────────────────────
// In-memory SQLite database for tests, using Node's built-in node:sqlite
// behind Kysely's SqliteDialect. No external service or dependency.
// ─────────────────────────────────────────────────────────────────────

import { DatabaseSync } from 'node:sqlite';
import { Kysely, SqliteDialect } from 'kysely';

export function createTestDatabase(): Kysely<any> {
  const sqlite = new DatabaseSync(':memory:');

  // Adapt node:sqlite to the better-sqlite3 surface SqliteDialect expects
  const database = {
    close: () => sqlite.close(),
    prepare: (sql: string) => {
      const statement = sqlite.prepare(sql);
      return {
        reader: /^\s*(select|pragma|with|explain)\b/i.test(sql) || /\breturning\b/i.test(sql),
        all: (params: readonly unknown[]) => statement.all(...(params as any[])),
        run: (params: readonly unknown[]) => statement.run(...(params as any[])),
        iterate: (params: readonly unknown[]) => statement.iterate(...(params as any[])),
      };
    },
  };

  return new Kysely<any>({ dialect: new SqliteDialect({ database: database as any }) });
}
