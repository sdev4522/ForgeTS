// packages/forge/src/database/Model.ts
// ─────────────────────────────────────────────────────────────────────
// Base Active Record Model class with Proxy-backed attribute access
// and mass-assignment protection (fillable / guarded).
// Inspired by Eloquent / Lucid.
// ─────────────────────────────────────────────────────────────────────

import { getDatabaseConnection, getMongoDriver } from './Connection.js';
import { QueryBuilder } from './QueryBuilder.js';
import { serializeModelAttributes, formatMysqlDateTime, serializeDatabaseValue } from './serializer.js';

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

  /** Attributes excluded from toJSON() / API output (e.g. ['password']). */
  static hidden?: string[];

  /** Internal attributes storage */
  public _attributes: Record<string, any> = {};

  /** Eager-loaded relations (never persisted as columns). */
  public _relations: Record<string, any> = {};

  /** True once this instance corresponds to a row/document in the database. */
  public _exists = false;

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
          (typeof prop === 'string' && prop.startsWith('_')) ||
          prop === 'constructor' ||
          typeof target[prop] === 'function'
        ) {
          return Reflect.get(target, prop, target);
        }
        if (typeof prop === 'string' && Object.hasOwn(target._relations, prop)) {
          return target._relations[prop];
        }
        if (typeof prop === 'string' && Object.hasOwn(target._attributes, prop)) {
          return target._attributes[prop];
        }
        return Reflect.get(target, prop, target);
      },
      set(target: any, prop: string | symbol, value: any) {
        if (typeof prop === 'string' && !prop.startsWith('_')) {
          // Class field declarations (`name!: string`) initialize to undefined after
          // construction; they must neither clobber hydrated values nor create
          // phantom attributes.
          if (value === undefined) {
            return true;
          }
          // Assigning to a loaded relation replaces the relation, not a column
          if (Object.hasOwn(target._relations, prop)) {
            target._relations[prop] = value;
            return true;
          }
          target._attributes[prop] = value;
          return true;
        }
        return Reflect.set(target, prop, value, target);
      },
      has(target: any, prop: string | symbol) {
        if (typeof prop === 'string' && Object.hasOwn(target._attributes, prop)) {
          return true;
        }
        return Reflect.has(target, prop);
      },
      ownKeys(target: any) {
        const attributeKeys = Object.keys(target._attributes);
        const targetKeys = Reflect.ownKeys(target).filter(
          (k) => typeof k !== 'string' || !k.startsWith('_'),
        );
        return Array.from(new Set([...targetKeys, ...attributeKeys]));
      },
      getOwnPropertyDescriptor(target: any, prop: string | symbol) {
        if (typeof prop === 'string' && Object.hasOwn(target._attributes, prop)) {
          return {
            value: target._attributes[prop],
            writable: true,
            enumerable: true,
            configurable: true,
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    });
  }

  /**
   * Get table name for this model class.
   */
  static getTable(): string {
    if (this.table) return this.table;
    // UserProfile -> user_profiles, Category -> categories, Box -> boxes
    const snake = this.name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    if (/[^aeiou]y$/.test(snake)) return `${snake.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/.test(snake)) return snake.endsWith('s') ? snake : `${snake}es`;
    return `${snake}s`;
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
   * - Else (neither set), a default deny-list applies: id, created_at, updated_at, deleted_at.
   *
   * With the default deny-list (no `fillable` / `guarded` declared) and with
   * `fillable`, the primary key and Mongo `_id` are only mass-assignable when
   * listed explicitly: request input must not be able to choose which record a
   * save() writes to. An explicit `guarded` list is honoured exactly as written
   * (`guarded = []` allows everything). Rows loaded from the database go
   * through hydrate(), which bypasses these rules.
   */
  static filterMassAssignment(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    if (!data || typeof data !== 'object') return result;

    if (Array.isArray(this.fillable)) {
      for (const key of this.fillable) {
        if (Object.hasOwn(data, key) && data[key] !== undefined) {
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

    const identityKeys = Array.isArray(this.guarded)
      ? new Set<string>()
      : new Set([this.getPrimaryKey(), '_id']);

    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      if (identityKeys.has(key) || guardedList.includes(key)) continue;
      // Internal slots and prototype keys are never attributes
      if (key.startsWith('_') || key === 'constructor') continue;
      result[key] = val;
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
   * Set attributes directly, bypassing fillable / guarded rules.
   * For trusted, server-side values only — never pass request input.
   */
  forceFill(attributes: Record<string, any>): this {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        this._attributes[key] = value;
      }
    }
    return this;
  }

  /** Raw attribute map (including hidden attributes). */
  getAttributes(): Record<string, any> {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(this._attributes)) {
      if (val !== undefined) res[key] = val;
    }
    return res;
  }

  /** Get a loaded relation by name. */
  getRelation<T = any>(name: string): T | undefined {
    return this._relations[name];
  }

  /** Attach a loaded relation without marking it as a column. */
  setRelation(name: string, value: unknown): this {
    this._relations[name] = value;
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
   * Alias for update() to support ActiveRecord / Laravel conventions.
   */
  async updateAttributes(attributes: Record<string, any>): Promise<this> {
    return this.update(attributes);
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
    instance._exists = true;
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
    return arguments.length >= 3
      ? qb.where(column, opOrVal as string, value)
      : qb.where(column, opOrVal);
  }

  static async create<T extends typeof Model>(this: T, data: Record<string, any>): Promise<InstanceType<T>> {
    const instance = new (this as any)(data);
    // Explicitly provided created_at / updated_at overrides in create data take precedence
    if (data.created_at !== undefined) instance._attributes.created_at = data.created_at;
    if (data.updated_at !== undefined) instance._attributes.updated_at = data.updated_at;
    await instance.save();
    return instance;
  }

  // ─── Persistence Methods ───

  /**
   * Save the current model instance to the database (INSERT or UPDATE).
   *
   * Instances loaded from the database (or already saved) are UPDATEd; new
   * instances are INSERTed — including new instances with a preset primary key
   * (UUIDs, natural keys). The decision never depends on request-supplied data.
   */
  async save(): Promise<this> {
    const ctor = this.constructor as typeof Model;
    const table = ctor.getTable();
    const pk = ctor.getPrimaryKey();

    const data: Record<string, any> = this.getAttributes();
    const isMongo = ctor.connection === 'mongodb';

    if (ctor.timestamps) {
      if (isMongo) {
        const nowVal = new Date().toISOString();
        if (!data['created_at']) data['created_at'] = nowVal;
        data['updated_at'] = nowVal;
        this._attributes['updated_at'] = nowVal;
        if (!this._attributes['created_at']) this._attributes['created_at'] = nowVal;
      } else {
        const formattedNow = formatMysqlDateTime(new Date());
        if (!data['created_at']) data['created_at'] = formattedNow;
        data['updated_at'] = formattedNow;
        if (!this._attributes['created_at']) this._attributes['created_at'] = data['created_at'];
        this._attributes['updated_at'] = data['updated_at'];
      }
    }

    if (!isMongo) {
      if (typeof data['created_at'] === 'string' && data['created_at'].includes('T')) {
        data['created_at'] = serializeDatabaseValue(data['created_at'], 'mysql');
        this._attributes['created_at'] = data['created_at'];
      }
      if (typeof data['updated_at'] === 'string' && data['updated_at'].includes('T')) {
        data['updated_at'] = serializeDatabaseValue(data['updated_at'], 'mysql');
        this._attributes['updated_at'] = data['updated_at'];
      }
    }

    const currentPkValue = this._attributes[pk];
    const hasPk = currentPkValue !== undefined && currentPkValue !== null;

    if (isMongo) {
      const mongo = getMongoDriver();
      const documentId = hasPk ? currentPkValue : this._attributes['_id'];
      if (this._exists && documentId !== undefined && documentId !== null) {
        const updated = await mongo.update(table, documentId, data);
        if (updated) this.forceFill(updated);
      } else {
        const created = await mongo.create(table, data);
        if (created) this.forceFill(created);
      }
      this._exists = true;
    } else {
      const db = getDatabaseConnection();
      const driver = ctor.connection || 'mysql';
      const serializedData = serializeModelAttributes(data, driver);

      if (this._exists) {
        if (!hasPk) {
          throw new Error(
            `[ForgeTS] Cannot update ${ctor.name}: primary key '${pk}' is missing on a persisted instance.`,
          );
        }
        // UPDATE — the primary key identifies the row and is never rewritten
        delete serializedData[pk];
        if (Object.keys(serializedData).length > 0) {
          await db
            .updateTable(table)
            .set(serializedData)
            .where(pk, '=', currentPkValue)
            .execute();
        }
      } else {
        // INSERT — keep an explicitly assigned primary key (UUIDs / natural keys)
        if (!hasPk) delete serializedData[pk];
        const result = await db.insertInto(table).values(serializedData).executeTakeFirst();
        if (!hasPk && result && result.insertId !== undefined && result.insertId !== null) {
          const raw = result.insertId;
          const numeric = Number(raw);
          // Keep 64-bit ids exact instead of silently rounding them
          this._attributes[pk] = Number.isSafeInteger(numeric) ? numeric : String(raw);
        }
        this._exists = true;
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
    const isMongo = ctor.connection === 'mongodb';
    const pkValue = this._attributes[pk] ?? (isMongo ? this._attributes['_id'] : undefined);

    if (pkValue === undefined || pkValue === null) {
      throw new Error(`[ForgeTS] Cannot delete unsaved model instance.`);
    }

    if (isMongo) {
      const mongo = getMongoDriver();
      await mongo.delete(table, pkValue);
    } else {
      const db = getDatabaseConnection();
      await db.deleteFrom(table).where(pk, '=', pkValue).execute();
    }
    this._exists = false;
  }

  /**
   * Convert model to plain object for JSON serialization.
   * Attributes listed in `static hidden` are omitted; loaded relations are included.
   */
  toJSON(): Record<string, any> {
    const ctor = this.constructor as typeof Model;
    const hidden = Array.isArray(ctor.hidden) ? ctor.hidden : [];
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(this._attributes)) {
      if (val !== undefined && !hidden.includes(key)) {
        res[key] = val;
      }
    }
    for (const [key, val] of Object.entries(this._relations)) {
      if (val !== undefined && !hidden.includes(key)) {
        res[key] = val;
      }
    }
    return res;
  }
}
