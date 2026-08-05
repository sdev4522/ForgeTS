import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('notes')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('content', 'text')
    .addColumn('created_at', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('notes').execute();
}
