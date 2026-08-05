// scratch/load_test_mysql_mongo.ts
import { Application, Router } from '@forge/core';
import { initConfig, getConfigManager } from '../packages/forge/src/config/ConfigManager.js';
import appConfig from '../config/app.js';
import dbConfig from '../config/database.ts';
import { Todo } from '../app/models/Todo.js';
import { LogEntry } from '../app/models/LogEntry.js';
import { setDatabaseConnection, setMongoDriver, MongoDriver } from '../packages/forge/src/database/index.js';
import { Kysely, SqliteAdapter, SqliteQueryCompiler, SqliteIntrospector, type Dialect, type Driver, type DatabaseConnection, type CompiledQuery, type QueryResult } from 'kysely';

// ─── High Performance In-Memory MySQL SQL Dialect for Benchmark ───
class BenchConnection implements DatabaseConnection {
  private todos: any[] = [
    { id: 1, title: 'Initial Todo 1', completed: 0, created_at: '2026-08-05' },
    { id: 2, title: 'Initial Todo 2', completed: 1, created_at: '2026-08-05' },
  ];
  private autoId = 3;

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const sql = compiledQuery.sql;
    const params = compiledQuery.parameters as any[];

    if (sql.startsWith('select')) {
      return { rows: [...this.todos] as R[] };
    }
    if (sql.startsWith('insert')) {
      const id = this.autoId++;
      const item = { id, title: params[0] || 'Bench Todo', completed: params[1] || 0, created_at: params[2] || '2026-08-05' };
      this.todos.push(item);
      return { insertId: BigInt(id), numUpdatedOrDeletedRows: BigInt(1), rows: [] };
    }
    return { rows: [] };
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Not implemented');
  }
}

class BenchDriver implements Driver {
  private conn = new BenchConnection();
  async init() {}
  async acquireConnection() { return this.conn; }
  async releaseConnection() {}
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
  async destroy() {}
}

class BenchSqlDialect implements Dialect {
  createDriver() { return new BenchDriver(); }
  createQueryCompiler() { return new SqliteQueryCompiler(); }
  createAdapter() { return new SqliteAdapter(); }
  createIntrospector(db: Kysely<any>) { return new SqliteIntrospector(db); }
}

// ─── High Performance In-Memory Mongo Driver for Benchmark ───
class BenchMongoDriver extends MongoDriver {
  private logs: any[] = [
    { id: '1', level: 'info', message: 'Initial log', created_at: '2026-08-05' },
  ];
  private autoId = 2;

  constructor() {
    super({ uri: 'mongodb://127.0.0.1:27017', database: 'bench' });
  }

  override async connect() {}
  override async disconnect() {}
  override async findMany() { return [...this.logs]; }
  override async create(collection: string, data: any) {
    const doc = { ...data, id: String(this.autoId++), _id: String(this.autoId) };
    this.logs.push(doc);
    return doc;
  }
}

// Init config & set drivers
const configManager = initConfig(process.cwd());
configManager.set('app', appConfig);
configManager.set('database', dbConfig);

setDatabaseConnection(new Kysely<any>({ dialect: new BenchSqlDialect() }));
setMongoDriver(new BenchMongoDriver());
process.env.APP_DEBUG = 'false';

const app = new Application(process.cwd());
getConfigManager().set('database', dbConfig);

const router = new Router('/api/bench');

router.get('/todos', async (_req, res) => {
  const todos = await Todo.all();
  return res.json(todos.map((t) => t.toJSON()));
});

router.post('/todos', async (_req, res) => {
  const todo = await Todo.create({ title: 'Bench Todo', completed: 0 });
  return res.status(201).json(todo.toJSON());
});

router.get('/logs', async (_req, res) => {
  const logs = await LogEntry.all();
  return res.json(logs.map((l) => l.toJSON()));
});

router.post('/logs', async (_req, res) => {
  const log = await LogEntry.create({ level: 'info', message: 'Bench log' });
  return res.status(201).json(log.toJSON());
});

app.registerRoutes(router);

// Start server on port 3009
await app.start(3009);
console.log('⚡ Clean Benchmark Server running on http://localhost:3009');
