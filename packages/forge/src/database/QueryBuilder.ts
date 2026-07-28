// packages/forge/src/database/QueryBuilder.ts
// ─────────────────────────────────────────────────────────────────────
// Active Record Query Builder wrapping Kysely.
// Maps raw database rows into hydrated Model instances with eager loading support.
// ─────────────────────────────────────────────────────────────────────

import type { Model } from './Model.js';
import { getDatabaseConnection } from './Connection.js';
import { MODEL_RELATIONS, type RelationDefinition } from './decorators.js';

export class QueryBuilder<M extends typeof Model> {
  private query: any;
  private eagerRelations: string[] = [];

  constructor(private modelClass: M) {
    const db = getDatabaseConnection();
    this.query = db.selectFrom(modelClass.getTable()).selectAll();
  }

  where(column: string, value: unknown): this;
  where(column: string, op: string, value: unknown): this;
  where(column: string, opOrValue: unknown, value?: unknown): this {
    if (value === undefined) {
      this.query = this.query.where(column, '=', opOrValue);
    } else {
      this.query = this.query.where(column, opOrValue as any, value);
    }
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.query = this.query.orderBy(column, direction);
    return this;
  }

  limit(count: number): this {
    this.query = this.query.limit(count);
    return this;
  }

  offset(count: number): this {
    this.query = this.query.offset(count);
    return this;
  }

  /**
   * Eager load a relationship.
   *
   * @example
   * ```ts
   * const users = await User.query().with('posts').get();
   * ```
   */
  with(relationName: string): this {
    this.eagerRelations.push(relationName);
    return this;
  }

  /**
   * Execute query and return an array of hydrated Model instances.
   */
  async get(): Promise<InstanceType<M>[]> {
    const rows: any[] = await this.query.execute();
    const instances = rows.map((row) => this.modelClass.hydrate<InstanceType<M>>(row));

    if (this.eagerRelations.length > 0 && instances.length > 0) {
      await this.loadEagerRelations(instances);
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
      throw new Error(`[ForgeTS] Resource not found for model ${this.modelClass.name}`);
    }
    return instance;
  }

  /**
   * Eager load specified relations on hydrated instances.
   */
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
