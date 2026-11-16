// packages/forge/src/database/QueryBuilder.ts
// ─────────────────────────────────────────────────────────────────────
// Active Record Query Builder wrapping Kysely (SQL) and MongoDriver (NoSQL).
// Maps raw database rows/documents into hydrated Model instances.
// ─────────────────────────────────────────────────────────────────────

import type { Model } from './Model.js';
import { getDatabaseConnection, getMongoDriver } from './Connection.js';
import { MODEL_RELATIONS, type RelationDefinition } from './decorators.js';
import { serializeDatabaseValue } from './serializer.js';
import { ModelNotFoundException } from '../errors/index.js';
import { sql } from 'kysely';

/** One page of results. */
export interface Paginated<T> {
  data: T[];
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).some((k) => k.startsWith('$'))
  );
}

/**
 * Reject values that would be interpreted as MongoDB query operators.
 * Request input such as `{ "$ne": null }` must never reach a filter as-is;
 * comparisons are expressed through where(column, operator, value).
 */
function assertSafeMongoValue(column: string, value: unknown): void {
  const check = (v: unknown, depth: number): void => {
    if (v === null || typeof v !== 'object' || depth > 8) return;
    if (v instanceof Date) return;
    if (Array.isArray(v)) {
      for (const item of v) check(item, depth + 1);
      return;
    }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return; // ObjectId, ForgeDate, …
    for (const [key, nested] of Object.entries(v)) {
      if (key.startsWith('$')) {
        throw new TypeError(
          `[ForgeTS] Refusing MongoDB operator '${key}' in where('${column}', …) value. ` +
            `Pass scalar values, or use where(column, operator, value).`,
        );
      }
      check(nested, depth + 1);
    }
  };
  check(value, 0);
}

export class QueryBuilder<M extends typeof Model> {
  private sqlQuery: any = null;
  private mongoWhere: Record<string, any> = {};
  private mongoOrderBy: { column: string; direction?: 'asc' | 'desc' } | undefined = undefined;
  private mongoLimit: number | undefined = undefined;
  private mongoOffset: number | undefined = undefined;
  private eagerRelations: string[] = [];
  /** SQL conditions, replayed onto UPDATE / DELETE statements. */
  private sqlConditions: Array<(qb: any) => any> = [];

  /** Add a SQL condition to the SELECT and remember it for bulk update/delete. */
  private addSqlCondition(apply: (qb: any) => any): void {
    this.sqlConditions.push(apply);
    this.sqlQuery = apply(this.sqlQuery);
  }

  constructor(private modelClass: M) {
    if (!this.isMongo()) {
      const db = getDatabaseConnection();
      this.sqlQuery = db.selectFrom(modelClass.getTable()).selectAll();
    }
  }

  private isMongo(): boolean {
    return (
      (this.modelClass as any).connection === 'mongodb' ||
      (this.modelClass as any).driver === 'mongodb'
    );
  }

  where(column: string, value: unknown): this;
  where(column: string, op: string, value: unknown): this;
  where(column: string, opOrValue: unknown, value?: unknown): this {
    if (this.isMongo()) {
      const driver = 'mongodb';
      const hasOperator = arguments.length >= 3;
      const operator = hasOperator ? String(opOrValue) : '=';
      const actualValue = hasOperator ? value : opOrValue;
      assertSafeMongoValue(column, actualValue);

      // The model primary key maps onto Mongo's `_id` (ObjectId when applicable)
      let field = column;
      let serializedValue = serializeDatabaseValue(actualValue, driver);
      if (column === this.modelClass.getPrimaryKey() || column === '_id') {
        field = '_id';
        serializedValue = getMongoDriver().toDocumentId(serializedValue as any);
      }

      const mongoOps: Record<string, string> = {
        '>': '$gt',
        '>=': '$gte',
        '<': '$lt',
        '<=': '$lte',
        '!=': '$ne',
        '<>': '$ne',
      };

      if (operator === '=') {
        this.mongoWhere[field] = serializedValue;
      } else if (mongoOps[operator]) {
        // Merge with existing operators on the same field (e.g. >= and <)
        const existing = this.mongoWhere[field];
        const base = isOperatorObject(existing) ? existing : {};
        this.mongoWhere[field] = { ...base, [mongoOps[operator]]: serializedValue };
      } else {
        throw new TypeError(`[ForgeTS] Unsupported where operator '${operator}' for MongoDB models.`);
      }
    } else {
      const driver = (this.modelClass as any).connection || 'mysql';
      if (arguments.length < 3) {
        const serialized = serializeDatabaseValue(opOrValue, driver);
        this.addSqlCondition((qb) => qb.where(column, '=', serialized));
      } else {
        const serialized = serializeDatabaseValue(value, driver);
        this.addSqlCondition((qb) => qb.where(column, opOrValue as any, serialized));
      }
    }
    return this;
  }

  whereBetween(column: string, range: [unknown, unknown]): this {
    if (this.isMongo()) {
      const driver = 'mongodb';
      assertSafeMongoValue(column, range[0]);
      assertSafeMongoValue(column, range[1]);
      this.mongoWhere[column] = {
        $gte: serializeDatabaseValue(range[0], driver),
        $lte: serializeDatabaseValue(range[1], driver),
      };
    } else {
      const driver = (this.modelClass as any).connection || 'mysql';
      const min = serializeDatabaseValue(range[0], driver);
      const max = serializeDatabaseValue(range[1], driver);
      this.addSqlCondition((qb) => qb.where(column, '>=', min).where(column, '<=', max));
    }
    return this;
  }

  /** Match any of the given values. An empty list matches nothing. */
  whereIn(column: string, values: readonly unknown[]): this {
    return this.addListCondition(column, values, false);
  }

  /** Match none of the given values. An empty list matches everything. */
  whereNotIn(column: string, values: readonly unknown[]): this {
    return this.addListCondition(column, values, true);
  }

  private addListCondition(column: string, values: readonly unknown[], negate: boolean): this {
    if (!Array.isArray(values)) {
      throw new TypeError(`[ForgeTS] whereIn('${column}', …) expects an array of values.`);
    }
    if (this.isMongo()) {
      for (const value of values) assertSafeMongoValue(column, value);
      const isId = column === this.modelClass.getPrimaryKey() || column === '_id';
      const list = values.map((v) => {
        const serialized = serializeDatabaseValue(v, 'mongodb');
        return isId ? getMongoDriver().toDocumentId(serialized as any) : serialized;
      });
      const field = isId ? '_id' : column;
      const existing = this.mongoWhere[field];
      const base = isOperatorObject(existing) ? existing : {};
      this.mongoWhere[field] = { ...base, [negate ? '$nin' : '$in']: list };
    } else {
      const driver = (this.modelClass as any).connection || 'mysql';
      const list = values.map((v) => serializeDatabaseValue(v, driver));
      if (list.length === 0) {
        // `IN ()` is invalid SQL: express "nothing" / "everything" directly
        this.addSqlCondition((qb) => qb.where(sql<boolean>`${sql.lit(negate ? 1 : 0)} = 1`));
      } else {
        this.addSqlCondition((qb) => qb.where(column, negate ? 'not in' : 'in', list));
      }
    }
    return this;
  }

  whereNull(column: string): this {
    if (this.isMongo()) {
      this.mongoWhere[column] = null;
    } else {
      this.addSqlCondition((qb) => qb.where(column, 'is', null));
    }
    return this;
  }

  whereNotNull(column: string): this {
    if (this.isMongo()) {
      const existing = this.mongoWhere[column];
      const base = isOperatorObject(existing) ? existing : {};
      this.mongoWhere[column] = { ...base, $ne: null };
    } else {
      this.addSqlCondition((qb) => qb.where(column, 'is not', null));
    }
    return this;
  }

  /** Newest first (by created_at unless another column is given). */
  latest(column = 'created_at'): this {
    return this.orderBy(column, 'desc');
  }

  /** Oldest first (by created_at unless another column is given). */
  oldest(column = 'created_at'): this {
    return this.orderBy(column, 'asc');
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    if (direction !== 'asc' && direction !== 'desc') {
      throw new TypeError(`[ForgeTS] orderBy direction must be 'asc' or 'desc'.`);
    }
    if (this.isMongo()) {
      this.mongoOrderBy = { column, direction };
    } else {
      this.sqlQuery = this.sqlQuery.orderBy(column, direction);
    }
    return this;
  }

  /** Alias for limit(). */
  take(count: number): this {
    return this.limit(count);
  }

  /** Alias for offset(). */
  skip(count: number): this {
    return this.offset(count);
  }

  limit(count: number): this {
    if (this.isMongo()) {
      this.mongoLimit = count;
    } else {
      this.sqlQuery = this.sqlQuery.limit(count);
    }
    return this;
  }

  offset(count: number): this {
    if (this.isMongo()) {
      this.mongoOffset = count;
    } else {
      this.sqlQuery = this.sqlQuery.offset(count);
    }
    return this;
  }

  with(relationName: string): this {
    this.eagerRelations.push(relationName);
    return this;
  }

  /**
   * Execute query and return an array of hydrated Model instances.
   */
  async get(): Promise<InstanceType<M>[]> {
    let rows: any[] = [];

    if (this.isMongo()) {
      const driver = getMongoDriver();
      rows = await driver.findMany(this.modelClass.getTable(), {
        where: this.mongoWhere,
        orderBy: this.mongoOrderBy,
        limit: this.mongoLimit,
        offset: this.mongoOffset,
      });
    } else {
      rows = await this.sqlQuery.execute();
    }

    const instances = rows.map((row) => (this.modelClass as any).hydrate(row) as InstanceType<M>);

    if (this.eagerRelations.length > 0 && instances.length > 0) {
      if (this.isMongo()) {
        console.warn(
          `[ForgeTS Mongo Warning] Eager loading relations on Mongo models is an intentional non-goal / known gap in Task 2. Skipping relation '${this.eagerRelations.join(', ')}'.`
        );
      } else {
        await this.loadEagerRelations(instances);
      }
    }

    return instances;
  }

  /**
   * Execute query and return the first matching Model instance, or null.
   */
  async first(): Promise<InstanceType<M> | null> {
    const instance = (await this.limit(1).get())[0] ?? null;
    return instance;
  }

  /** Number of matching records (ignores limit / offset / ordering). */
  async count(): Promise<number> {
    if (this.isMongo()) {
      const driver: any = getMongoDriver();
      const table = this.modelClass.getTable();
      if (typeof driver.count === 'function') {
        return driver.count(table, this.mongoWhere);
      }
      return (await driver.findMany(table, { where: this.mongoWhere })).length;
    }

    const row = await this.sqlQuery
      .clearSelect()
      .clearOrderBy()
      .clearLimit()
      .clearOffset()
      .select((eb: any) => eb.fn.countAll().as('aggregate'))
      .executeTakeFirst();
    return Number(row?.aggregate ?? 0);
  }

  /** True when at least one record matches. */
  async exists(): Promise<boolean> {
    return (await this.count()) > 0;
  }

  /** Values of a single column for every matching record. */
  async pluck<T = any>(column: string): Promise<T[]> {
    return (await this.get()).map((instance) => (instance as any)[column] as T);
  }

  /**
   * One page of results plus the totals needed to render pagination.
   *
   * @example
   * ```ts
   * const page = await User.query().latest().paginate(20, req.integer('page', 1));
   * // { data, total, perPage, currentPage, lastPage, from, to }
   * ```
   */
  async paginate(perPage = 15, page = 1): Promise<Paginated<InstanceType<M>>> {
    const size = Math.min(Math.max(1, Math.trunc(perPage) || 15), 1000);
    const current = Math.max(1, Math.trunc(page) || 1);

    const total = await this.count();
    const data = await this.limit(size).offset((current - 1) * size).get();
    const lastPage = Math.max(1, Math.ceil(total / size));

    return {
      data,
      total,
      perPage: size,
      currentPage: current,
      lastPage,
      from: data.length > 0 ? (current - 1) * size + 1 : null,
      to: data.length > 0 ? (current - 1) * size + data.length : null,
    };
  }

  /**
   * Update every matching record. Returns the number of affected rows.
   * Refuses to run without a where condition; use Model.query().updateAll() intent explicitly.
   */
  async update(values: Record<string, any>): Promise<number> {
    this.assertBulkAllowed('update');
    const driver = (this.modelClass as any).connection || 'mysql';
    const data: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      if (val !== undefined) data[key] = serializeDatabaseValue(val, driver);
    }
    if ((this.modelClass as any).timestamps && data['updated_at'] === undefined) {
      data['updated_at'] = serializeDatabaseValue(new Date(), driver);
    }
    if (Object.keys(data).length === 0) return 0;

    let statement: any = getDatabaseConnection().updateTable(this.modelClass.getTable()).set(data);
    for (const apply of this.sqlConditions) statement = apply(statement);
    const result = await statement.executeTakeFirst();
    return Number(result?.numUpdatedRows ?? result?.numChangedRows ?? 0);
  }

  /** Delete every matching record. Returns the number of deleted rows. */
  async delete(): Promise<number> {
    this.assertBulkAllowed('delete');
    let statement: any = getDatabaseConnection().deleteFrom(this.modelClass.getTable());
    for (const apply of this.sqlConditions) statement = apply(statement);
    const result = await statement.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0);
  }

  private assertBulkAllowed(action: 'update' | 'delete'): void {
    if (this.isMongo()) {
      throw new Error(
        `[ForgeTS] Bulk ${action}() is not supported for MongoDB models yet. Load the records and ${action} them individually.`,
      );
    }
    if (this.sqlConditions.length === 0) {
      throw new Error(
        `[ForgeTS] Refusing to ${action} every row of '${this.modelClass.getTable()}': add a where() condition first.`,
      );
    }
  }

  /**
   * Execute query and return first instance or throw error if missing.
   */
  async firstOrFail(): Promise<InstanceType<M>> {
    const instance = await this.first();
    if (!instance) {
      throw new ModelNotFoundException(this.modelClass.name);
    }
    return instance;
  }

  private async loadEagerRelations(instances: InstanceType<M>[]): Promise<void> {
    const metadata = (this.modelClass as any)[Symbol.metadata as any];
    if (!metadata) return;

    const relations = (metadata[MODEL_RELATIONS] as RelationDefinition[]) ?? [];

    for (const relName of this.eagerRelations) {
      const relDef = relations.find((r) => String(r.propertyKey) === relName);
      if (!relDef) {
        throw new Error(
          `[ForgeTS] Relation '${relName}' is not defined on model ${this.modelClass.name}.`,
        );
      }

      const TargetClass: any = relDef.targetModelGetter();
      const primaryKey = this.modelClass.getPrimaryKey();

      if (relDef.type === 'hasMany' || relDef.type === 'hasOne') {
        const ids = [
          ...new Set(
            instances
              .map((inst) => (inst as any)[primaryKey])
              .filter((id) => id !== undefined && id !== null),
          ),
        ];
        if (ids.length === 0) continue;

        const db = getDatabaseConnection();
        const relatedRows: any[] = await db
          .selectFrom(TargetClass.getTable())
          .selectAll()
          .where(relDef.foreignKey, 'in', ids)
          .execute();

        const relatedInstances = relatedRows.map((r) => TargetClass.hydrate(r));

        for (const inst of instances) {
          const matching = relatedInstances.filter(
            (relInst) => String(relInst[relDef.foreignKey]) === String((inst as any)[primaryKey]),
          );
          (inst as any).setRelation(relName, relDef.type === 'hasOne' ? (matching[0] ?? null) : matching);
        }
      } else if (relDef.type === 'belongsTo') {
        const foreignIds = [
          ...new Set(
            instances
              .map((inst) => (inst as any)[relDef.foreignKey])
              .filter((id) => id !== undefined && id !== null),
          ),
        ];
        if (foreignIds.length === 0) continue;

        const targetPrimaryKey = TargetClass.getPrimaryKey();
        const db = getDatabaseConnection();
        const parentRows: any[] = await db
          .selectFrom(TargetClass.getTable())
          .selectAll()
          .where(targetPrimaryKey, 'in', foreignIds)
          .execute();

        const parentInstances = parentRows.map((r) => TargetClass.hydrate(r));

        for (const inst of instances) {
          const matching = parentInstances.find(
            (pInst) => String(pInst[targetPrimaryKey]) === String((inst as any)[relDef.foreignKey]),
          );
          (inst as any).setRelation(relName, matching ?? null);
        }
      }
    }
  }
}
