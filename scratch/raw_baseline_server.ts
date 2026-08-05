import { Database } from 'bun:sqlite';
import { Kysely, SqliteDialect } from 'kysely';

const dbPath = './storage/database.sqlite';
const sqlite = new Database(dbPath);
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, completed INTEGER, created_at TEXT);');

const db = new Kysely<any>({
  dialect: new SqliteDialect({ database: sqlite }),
});

const PORT = 3001;

console.log(`⚡ [Raw Baseline Server] Running on http://localhost:${PORT}`);

Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === '/todos' && req.method === 'GET') {
      const todos = await db.selectFrom('todos').selectAll().execute();
      return Response.json(todos);
    }

    if (url.pathname === '/todos' && req.method === 'POST') {
      try {
        const body = (await req.json()) as any;
        const result = await db.insertInto('todos').values({
          title: body?.title || 'Benchmark Todo',
          completed: 0,
          created_at: new Date().toISOString(),
        }).executeTakeFirst();

        return Response.json({ id: Number(result.insertId), title: body?.title }, { status: 201 });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});
