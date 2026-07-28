// packages/forge/src/database/decorators.ts
// ─────────────────────────────────────────────────────────────────────
// Column & Relationship Decorators for Active Record Models.
// TC39 Stage 3 compatible.
// ─────────────────────────────────────────────────────────────────────

export const MODEL_COLUMNS = Symbol.for('forge:model_columns');
export const MODEL_RELATIONS = Symbol.for('forge:model_relations');

export type RelationType = 'hasMany' | 'belongsTo' | 'hasOne';

export interface RelationDefinition {
  type: RelationType;
  propertyKey: string | symbol;
  targetModelGetter: () => new (...args: any[]) => any;
  foreignKey: string;
}

function getOrCreateArray<T>(metadata: DecoratorMetadataObject, key: symbol): T[] {
  if (!metadata[key]) {
    metadata[key] = [] as T[];
  }
  return metadata[key] as T[];
}

/**
 * Mark a class property as a database column.
 */
export function Column() {
  return function (_target: undefined, context: ClassFieldDecoratorContext) {
    const columns = getOrCreateArray<string | symbol>(context.metadata, MODEL_COLUMNS);
    columns.push(context.name);
  };
}

/**
 * Define a HasMany relationship (One to Many).
 *
 * @example
 * ```ts
 * @HasMany(() => Post, 'user_id')
 * declare posts: Post[];
 * ```
 */
export function HasMany(targetModelGetter: () => new (...args: any[]) => any, foreignKey: string) {
  return function (_target: undefined, context: ClassFieldDecoratorContext) {
    const relations = getOrCreateArray<RelationDefinition>(context.metadata, MODEL_RELATIONS);
    relations.push({
      type: 'hasMany',
      propertyKey: context.name,
      targetModelGetter,
      foreignKey,
    });
  };
}

/**
 * Define a BelongsTo relationship (Inverse of HasMany).
 *
 * @example
 * ```ts
 * @BelongsTo(() => User, 'user_id')
 * declare author: User;
 * ```
 */
export function BelongsTo(targetModelGetter: () => new (...args: any[]) => any, foreignKey: string) {
  return function (_target: undefined, context: ClassFieldDecoratorContext) {
    const relations = getOrCreateArray<RelationDefinition>(context.metadata, MODEL_RELATIONS);
    relations.push({
      type: 'belongsTo',
      propertyKey: context.name,
      targetModelGetter,
      foreignKey,
    });
  };
}

/**
 * Define a HasOne relationship (One to One).
 */
export function HasOne(targetModelGetter: () => new (...args: any[]) => any, foreignKey: string) {
  return function (_target: undefined, context: ClassFieldDecoratorContext) {
    const relations = getOrCreateArray<RelationDefinition>(context.metadata, MODEL_RELATIONS);
    relations.push({
      type: 'hasOne',
      propertyKey: context.name,
      targetModelGetter,
      foreignKey,
    });
  };
}
