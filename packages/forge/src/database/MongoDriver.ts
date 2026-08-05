// packages/forge/src/database/MongoDriver.ts
// ─────────────────────────────────────────────────────────────────────
// MongoDB Native Driver implementation for ForgeTS DatabaseDriver interface.
// Powers NoSQL models with identical Active Record API surface.
// ─────────────────────────────────────────────────────────────────────

import { MongoClient, Db, ObjectId } from 'mongodb';
import type { DatabaseDriver, FindOptions } from './DatabaseDriver.js';

export interface MongoDriverConfig {
  uri: string;
  database: string;
  timeoutMs?: number;
}

export class MongoDriver implements DatabaseDriver {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(private config: MongoDriverConfig) {
    if (!config.uri) {
      throw new Error('[ForgeTS Mongo Error] MongoDB connection URI is required. Set MONGO_URI in .env or config/database.ts.');
    }
    if (!config.database) {
      throw new Error('[ForgeTS Mongo Error] MongoDB database name is required. Set MONGO_DB_NAME in .env or config/database.ts.');
    }
  }

  async connect(): Promise<void> {
    if (this.db && this.client) return;

    const timeout = this.config.timeoutMs ?? 1000;

    try {
      this.client = new MongoClient(this.config.uri, {
        serverSelectionTimeoutMS: timeout,
        connectTimeoutMS: timeout,
      });

      await this.client.connect();
      this.db = this.client.db(this.config.database);

      // Verify connection with ping
      await this.db.command({ ping: 1 });
    } catch (err: any) {
      this.client = null;
      this.db = null;
      throw new Error(
        `[ForgeTS Mongo Connection Failure] Failed to connect to MongoDB at '${this.config.uri}' (Database: '${this.config.database}'): ${err.message}`
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  private getDb(): Db {
    if (!this.db) {
      throw new Error(
        '[ForgeTS Mongo Error] Database is not connected. Call connect() or verify database configuration.'
      );
    }
    return this.db;
  }

  private parseId(id: string | number): any {
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
      return new ObjectId(id);
    }
    return id;
  }

  private normalizeDoc(doc: any): any {
    if (!doc) return null;
    const normalized = { ...doc };
    if (normalized._id) {
      normalized.id = String(normalized._id);
    }
    return normalized;
  }

  async find(collectionName: string, id: string | number): Promise<any | null> {
    await this.connect();
    const parsedId = this.parseId(id);
    const filter = {
      $or: [{ _id: parsedId }, { id: id }],
    };

    const doc = await this.getDb().collection(collectionName).findOne(filter);
    return this.normalizeDoc(doc);
  }

  async findMany(collectionName: string, options: FindOptions = {}): Promise<any[]> {
    await this.connect();
    const filter = options.where || {};

    let cursor = this.getDb().collection(collectionName).find(filter);

    if (options.orderBy) {
      const dir = options.orderBy.direction === 'desc' ? -1 : 1;
      cursor = cursor.sort({ [options.orderBy.column]: dir });
    }

    if (options.offset !== undefined && options.offset > 0) {
      cursor = cursor.skip(options.offset);
    }

    if (options.limit !== undefined && options.limit > 0) {
      cursor = cursor.limit(options.limit);
    }

    const docs = await cursor.toArray();
    return docs.map((d) => this.normalizeDoc(d));
  }

  async create(collectionName: string, data: Record<string, any>): Promise<any> {
    await this.connect();
    const toInsert = { ...data };

    if (toInsert.id && !toInsert._id) {
      toInsert._id = this.parseId(toInsert.id);
    }

    const result = await this.getDb().collection(collectionName).insertOne(toInsert);
    const insertedId = result.insertedId;

    const doc = await this.getDb().collection(collectionName).findOne({ _id: insertedId });
    return this.normalizeDoc(doc || { ...toInsert, _id: insertedId });
  }

  async update(collectionName: string, id: string | number, data: Record<string, any>): Promise<any> {
    await this.connect();
    const parsedId = this.parseId(id);
    const filter = { $or: [{ _id: parsedId }, { id: id }] };

    const updateData = { ...data };
    delete updateData._id;
    delete updateData.id;

    await this.getDb().collection(collectionName).updateOne(filter, { $set: updateData });
    const updated = await this.getDb().collection(collectionName).findOne(filter);
    return this.normalizeDoc(updated);
  }

  async delete(collectionName: string, id: string | number): Promise<boolean> {
    await this.connect();
    const parsedId = this.parseId(id);
    const filter = { $or: [{ _id: parsedId }, { id: id }] };

    const result = await this.getDb().collection(collectionName).deleteOne(filter);
    return result.deletedCount > 0;
  }

  async raw<T = any>(collectionName: string, extra?: any): Promise<T> {
    await this.connect();
    if (Array.isArray(extra)) {
      // Aggregation pipeline escape hatch
      const docs = await this.getDb().collection(collectionName).aggregate(extra).toArray();
      return docs.map((d) => this.normalizeDoc(d)) as any;
    }
    throw new Error('[ForgeTS Mongo Error] raw() for Mongo expects an aggregation pipeline array.');
  }
}
