// packages/forge/src/database/QueryBuilder.ts
// ─────────────────────────────────────────────────────────────────────
// Active Record Query Builder wrapping Kysely (SQL) and MongoDriver (NoSQL).
// Maps raw database rows/documents into hydrated Model instances.
// ─────────────────────────────────────────────────────────────────────

import type { Model } from './Model.js';
import { getDatabaseConnection, getMongoDriver } from './Connection.js';
import { MODEL_RELATIONS, type RelationDefinition } from './decorators.js';
import { serializeDatabaseValue } from './serializer.js';

export class QueryBuilder<M extends typeof Model> {
  private sqlQuery: any = null;
  private mongoWhere: Record<string, any> = {};
  private mongoOrderBy: { column: string; direction?: 'asc' | 'desc' } | undefined = undefined;
  private mongoLimit: number | undefined = undefined;
  private mongoOffset: number | undefined = undefined;
  private eagerRelations: string[] = [];

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
      const actualValue = value === undefined ? opOrValue : value;
      const serializedValue = serializeDatabaseValue(actualValue, driver);

      if (value === undefined) {
        this.mongoWhere[column] = serializedValue;
      } else if (opOrValue === '=') {
        this.mongoWhere[column] = serializedValue;
      } else if (opOrValue === '>') {
        this.mongoWhere[column] = { $gt: serializedValue };
      } else if (opOrValue === '>=') {
        this.mongoWhere[column] = { $gte: serializedValue };
      } else if (opOrValue === '<') {
        this.mongoWhere[column] = { $lt: serializedValue };
      } else if (opOrValue === '<=') {
        this.mongoWhere[column] = { $lte: serializedValue };
      } else if (opOrValue === '!=') {
        this.mongoWhere[column] = { $ne: serializedValue };
      } else {
        this.mongoWhere[column] = serializedValue;
      }
    } else {
      const driver = (this.modelClass as any).connection || 'mysql';
      if (value === undefined) {
        const serialized = serializeDatabaseValue(opOrValue, driver);
        this.sqlQuery = this.sqlQuery.where(column, '=', serialized);
      } else {
        const serialized = serializeDatabaseValue(value, driver);
        this.sqlQuery = this.sqlQuery.where(column, opOrValue as any, serialized);
      }
    }
    return this;
  }

  whereBetween(column: string, range: [unknown, unknown]): this {
    if (this.isMongo()) {
      const driver = 'mongodb';
      this.mongoWhere[column] = {
        $gte: serializeDatabaseValue(range[0], driver),
        $lte: serializeDatabaseValue(range[1], driver),
      };
    } else {
      const driver = (this.modelClass as any).connection || 'mysql';
      const min = serializeDatabaseValue(range[0], driver);
      const max = serializeDatabaseValue(range[1], driver);
      this.sqlQuery = this.sqlQuery.where(column, '>=', min).where(column, '<=', max);
    }
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    if (this.isMongo()) {
      this.mongoOrderBy = { column, direction };
    } else {
      this.sqlQuery = this.sqlQuery.orderBy(column, direction);
    }
    return this;
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

    const instances = rows.map((row) => this.modelClass.hydrate<InstanceType<M>>(row));

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

  /**
   * Execute query and return first instance or throw error if missing.
   */
  async firstOrFail(): Promise<InstanceType<M>> {
    const instance = await this.first();
    if (!instance) {
      throw new Error(`[ForgeTS Resource Not Found] Resource not found for model ${this.modelClass.name}`);
    }
    return instance;
  }

  private async loadEagerRelations(instances: InstanceType<M>[]): Promise<void> {
    const metadata = (this.modelClass as any)[Symbol.metadata];
    if (!metadata) return;

    const relations = (metadata[MODEL_RELATIONS] as RelationDefinition[]) ?? [];

    for (const relName of this.eagerRelations) {
      const relDef = relations.find((r) => String(r.propertyKey) === relName);
      if (!relDef) continue;

      const TargetClass = relDef.targetModelGetter();
      const primaryKey = this.modelClass.getPrimaryKey();

      if (relDef.type === 'hasMany') {
        const ids = instances.map((inst) => (inst as any)[primaryKey]).filter(Boolean);
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
          (inst as any)[relDef.propertyKey] = matching;
        }
      } else if (relDef.type === 'belongsTo') {
        const foreignIds = instances
          .map((inst) => (inst as any)[relDef.foreignKey])
          .filter(Boolean);
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
          (inst as any)[relDef.propertyKey] = matching ?? null;
        }
      }
    }
  }
}
