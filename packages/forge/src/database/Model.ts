// packages/forge/src/database/Model.ts
// ─────────────────────────────────────────────────────────────────────
// Base Active Record Model class with Proxy-backed attribute access
// and mass-assignment protection (fillable / guarded).
// Inspired by Eloquent / Lucid.
// ─────────────────────────────────────────────────────────────────────

import { getDatabaseConnection, getMongoDriver } from './Connection.js';
import { QueryBuilder } from './QueryBuilder.js';

export abstract class Model {
  /** Database table or collection name */
  static table?: string;

  /** Database connection driver name ('mysql', 'mongodb', etc.) */
  static connection?: string;

  /** Primary key column name */
  static primaryKey: string = 'id';

  /** Enable automatic created_at and updated_at timestamps */
  static timestamps: boolean = true;

  /** Allowed attributes for mass-assignment (allow-list). Takes precedence if set. */
  static fillable?: string[];

  /** Guarded attributes denied from mass-assignment (deny-list). */
  static guarded?: string[];

  /** Internal attributes storage */
  public _attributes: Record<string, any> = {};

  /**
   * Instantiate an Active Record model.
   *
   * Architectural Note:
   * Returns an ES6 Proxy wrapping the model instance. Property reads/writes
   * that do not match internal symbols or prototype methods are transparently
   * routed to this._attributes. This allows developers to use natural property syntax
   * (e.g. `user.name = 'Alice'`) while the underlying ORM manages dirty state tracking,
   * database column mapping, and mass-assignment filtering.
   */
  constructor(attributes: Record<string, any> = {}) {
    this.fill(attributes);

    return new Proxy(this, {
      get(target: any, prop: string | symbol, _receiver: any) {
        if (
          typeof prop === 'symbol' ||
          prop.startsWith('_') ||
          prop === 'constructor' ||
          typeof target[prop] === 'function'
        ) {
          return Reflect.get(target, prop, target);
        }
        if (prop in target._attributes) {
          return target._attributes[prop];
        }
        return Reflect.get(target, prop, target);
      },
      set(target: any, prop: string | symbol, value: any) {
        if (typeof prop === 'string' && !prop.startsWith('_')) {
          if (value === undefined && target._attributes[prop] !== undefined) {
            return true;
          }
          target._attributes[prop] = value;
          return true;
        }
        return Reflect.set(target, prop, value, target);
      },
    });
  }

  /**
   * Get table name for this model class.
   */
  static getTable(): string {
    if (this.table) return this.table;
    const name = this.name.toLowerCase();
    return name.endsWith('s') ? name : `${name}s`;
  }

  /**
   * Get primary key column name.
   */
  static getPrimaryKey(): string {
    return this.primaryKey;
  }

  /**
   * Filter data attributes against model fillable / guarded mass-assignment rules.
   * - If fillable is set, only keys in fillable are allowed.
   * - Else if guarded is set, keys in guarded are denied (['*'] denies all).
   * - Else (neither set), defaults to safe default: guarded = ['id', 'created_at', 'updated_at', 'deleted_at'].
   */
  static filterMassAssignment(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    if (Array.isArray(this.fillable)) {
      // Fillable allow-list takes precedence (primaryKey & _id always preserved for database hydration)
      const allowedKeys = new Set([...this.fillable, this.getPrimaryKey(), '_id']);
      for (const key of allowedKeys) {
        if (key in data && data[key] !== undefined) {
          result[key] = data[key];
        }
      }
      return result;
    }

    const guardedList = Array.isArray(this.guarded)
      ? this.guarded
      : ['id', 'created_at', 'updated_at', 'deleted_at'];

    if (guardedList.includes('*')) {
      return {};
    }

    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined && !guardedList.includes(key)) {
        result[key] = val;
      }
    }

    return result;
  }

  /**
   * Populate model instance with mass-assignable attributes.
   * Silently strips unallowed fields per fillable/guarded rules.
   */
  fill(attributes: Record<string, any>): this {
    const ctor = this.constructor as typeof Model;
    const filtered = ctor.filterMassAssignment(attributes);

    for (const [key, value] of Object.entries(filtered)) {
      if (value !== undefined) {
        this._attributes[key] = value;
      }
    }
    return this;
  }

  /**
   * Fill instance with mass-assignable attributes and save to database.
   */
  async update(attributes: Record<string, any>): Promise<this> {
    this.fill(attributes);
    return this.save();
  }

  /**
   * Instantiate and hydrate a model instance from a raw database row (bypassing mass-assignment).
   */
  static hydrate<T extends Model>(this: new (...args: any[]) => T, row: Record<string, any>): T {
    const instance = new this();
    for (const [k, v] of Object.entries(row)) {
      if (v !== undefined) {
        instance._attributes[k] = v;
      }
    }
    return instance;
  }

  // ─── Query Builder Entry Points ───

  static query<T extends typeof Model>(this: T): QueryBuilder<T> {
    return new QueryBuilder(this);
  }

  static find<T extends typeof Model>(this: T, id: string | number): Promise<InstanceType<T> | null> {
    return new QueryBuilder(this).where(this.getPrimaryKey(), id).first();
  }

  static findOrFail<T extends typeof Model>(this: T, id: string | number): Promise<InstanceType<T>> {
    return new QueryBuilder(this).where(this.getPrimaryKey(), id).firstOrFail();
  }

  static all<T extends typeof Model>(this: T): Promise<InstanceType<T>[]> {
    return new QueryBuilder(this).get();
  }

  static where<T extends typeof Model>(this: T, column: string, value: unknown): QueryBuilder<T>;
  static where<T extends typeof Model>(this: T, column: string, op: string, value: unknown): QueryBuilder<T>;
  static where<T extends typeof Model>(this: T, column: string, opOrVal: unknown, value?: unknown): QueryBuilder<T> {
    const qb = new QueryBuilder(this);
    return qb.where(column, opOrVal as any, value);
  }

  static async create<T extends typeof Model>(this: T, data: Record<string, any>): Promise<InstanceType<T>> {
    const instance = new (this as any)(data);
    await instance.save();
    return instance;
  }

  // ─── Persistence Methods ───

  /**
   * Save the current model instance to the database (INSERT or UPDATE).
   */
  async save(): Promise<this> {
    const ctor = this.constructor as typeof Model;
    const table = ctor.getTable();
    const pk = ctor.getPrimaryKey();

    const data: Record<string, any> = { ...this.toJSON() };

    if (ctor.timestamps) {
      const now = new Date().toISOString();
      if (!data['created_at']) data['created_at'] = now;
      data['updated_at'] = now;
      this._attributes['updated_at'] = now;
      if (!this._attributes['created_at']) this._attributes['created_at'] = now;
    }

    const currentPkValue = this._attributes[pk];

    if (ctor.connection === 'mongodb') {
      const mongo = getMongoDriver();
      if (currentPkValue !== undefined && currentPkValue !== null) {
        const updated = await mongo.update(table, currentPkValue, data);
        if (updated) this.fill(updated);
      } else {
        const created = await mongo.create(table, data);
        if (created) this.fill(created);
      }
    } else {
      const db = getDatabaseConnection();
      if (currentPkValue !== undefined && currentPkValue !== null) {
        // UPDATE
        await db
          .updateTable(table)
          .set(data)
          .where(pk, '=', currentPkValue)
          .execute();
      } else {
        // INSERT
        delete data[pk];
        const result = await db.insertInto(table).values(data).executeTakeFirst();
        if (result && result.insertId !== undefined) {
          const insertedId = Number(result.insertId);
          this._attributes[pk] = insertedId;
        }
      }
    }

    return this;
  }

  /**
   * Delete this record from the database.
   */
  async delete(): Promise<void> {
    const ctor = this.constructor as typeof Model;
    const table = ctor.getTable();
    const pk = ctor.getPrimaryKey();
    const pkValue = this._attributes[pk];

    if (pkValue === undefined || pkValue === null) {
      throw new Error(`[ForgeTS] Cannot delete unsaved model instance.`);
    }

    if (ctor.connection === 'mongodb') {
      const mongo = getMongoDriver();
      await mongo.delete(table, pkValue);
    } else {
      const db = getDatabaseConnection();
      await db.deleteFrom(table).where(pk, '=', pkValue).execute();
    }
  }

  /**
   * Convert model to plain object for JSON serialization.
   */
  toJSON(): Record<string, any> {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(this._attributes)) {
      if (val !== undefined) {
        res[key] = val;
      }
    }
    return res;
  }
}
