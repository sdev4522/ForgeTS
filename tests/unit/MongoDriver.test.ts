// tests/unit/MongoDriver.test.ts
import '../../packages/forge/src/polyfills.js';
import { describe, test, expect, beforeAll } from 'bun:test';
import { MongoDriver } from '../../packages/forge/src/database/MongoDriver.js';
import { Model, Column } from '../../packages/forge/src/database/index.js';
import { setMongoDriver } from '../../packages/forge/src/database/Connection.js';
import { initConfig } from '../../packages/forge/src/config/ConfigManager.js';
import appConfig from '../../config/app.js';
import dbConfig from '../../config/database.js';

// ─── In-Memory Mongo Mock Driver for Unit Tests ───

class MemoryMongoDriver extends MongoDriver {
  private collections: Record<string, any[]> = {};
  private autoId = 1;

  constructor() {
    super({ uri: 'mongodb://127.0.0.1:27017', database: 'test' });
  }

  override async connect(): Promise<void> {}
  override async disconnect(): Promise<void> {}

  override async find(collectionName: string, id: string | number): Promise<any | null> {
    const list = this.collections[collectionName] || [];
    const item = list.find((doc) => String(doc._id) === String(id) || String(doc.id) === String(id));
    return item ? { ...item, id: String(item._id || item.id) } : null;
  }

  override async findMany(collectionName: string, options: any = {}): Promise<any[]> {
    let list = [...(this.collections[collectionName] || [])];

    if (options.where) {
      for (const [key, val] of Object.entries(options.where)) {
        list = list.filter((doc) => doc[key] === val);
      }
    }

    if (options.orderBy) {
      const { column, direction } = options.orderBy;
      list.sort((a, b) => {
        if (a[column] < b[column]) return direction === 'desc' ? 1 : -1;
        if (a[column] > b[column]) return direction === 'desc' ? -1 : 1;
        return 0;
      });
    }

    if (options.offset) {
      list = list.slice(options.offset);
    }

    if (options.limit) {
      list = list.slice(0, options.limit);
    }

    return list.map((doc) => ({ ...doc, id: String(doc._id || doc.id) }));
  }

  override async create(collectionName: string, data: Record<string, any>): Promise<any> {
    if (!this.collections[collectionName]) this.collections[collectionName] = [];
    const id = data.id || `mongo_id_${this.autoId++}`;
    const doc = { ...data, _id: id, id: String(id) };
    this.collections[collectionName].push(doc);
    return doc;
  }

  override async update(collectionName: string, id: string | number, data: Record<string, any>): Promise<any> {
    const list = this.collections[collectionName] || [];
    const doc = list.find((item) => String(item._id) === String(id) || String(item.id) === String(id));
    if (doc) {
      Object.assign(doc, data);
    }
    return doc ? { ...doc, id: String(doc._id || doc.id) } : null;
  }

  override async delete(collectionName: string, id: string | number): Promise<boolean> {
    if (!this.collections[collectionName]) return false;
    const lenBefore = this.collections[collectionName].length;
    this.collections[collectionName] = this.collections[collectionName].filter(
      (doc) => String(doc._id) !== String(id) && String(doc.id) !== String(id)
    );
    return this.collections[collectionName].length < lenBefore;
  }

  override async raw<T = any>(collectionName: string, extra?: any): Promise<T> {
    return (this.collections[collectionName] || []) as any;
  }
}

class TestLogEntry extends Model {
  static override table = 'log_entries';
  static override connection = 'mongodb';
  static override fillable = ['level', 'message', 'context', 'created_at', 'updated_at'];

  @Column() id!: string;
  @Column() level!: string;
  @Column() message!: string;
  @Column() context!: Record<string, any>;
}

describe('MongoDB Driver & Active Record Integration', () => {
  beforeAll(() => {
    const configManager = initConfig(process.cwd());
    configManager.set('app', appConfig);
    configManager.set('database', dbConfig);

    setMongoDriver(new MemoryMongoDriver());
  });

  test('1. Fail-Fast Loud Connection Error Handling', async () => {
    const badDriver = new MongoDriver({ uri: 'mongodb://127.0.0.1:29999', database: 'bad_db' });
    expect(badDriver.connect()).rejects.toThrow('[ForgeTS Mongo Connection Failure]');
  });

  test('2. Mongo Document Model CRUD via identical Active Record API', async () => {
    // Create
    const entry = await TestLogEntry.create({
      level: 'info',
      message: 'Application started successfully',
      context: { env: 'production' },
    });

    expect(entry).toBeInstanceOf(TestLogEntry);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Application started successfully');
    expect(entry.id).toBeDefined();

    // Query with where & orderBy
    const results = await TestLogEntry.where('level', '=', 'info').orderBy('created_at', 'desc').get();
    expect(results).toBeArray();
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(entry.id);

    // Find
    const found = await TestLogEntry.find(entry.id);
    expect(found).not.toBeNull();
    expect(found?.message).toBe('Application started successfully');

    // Update
    entry.fill({ message: 'Updated Log Message' });
    await entry.save();

    const updated = await TestLogEntry.find(entry.id);
    expect(updated?.message).toBe('Updated Log Message');

    // Delete
    await entry.delete();
    const deleted = await TestLogEntry.find(entry.id);
    expect(deleted).toBeNull();
  });
});
