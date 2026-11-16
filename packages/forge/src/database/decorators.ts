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
  targetModelGetter: () => any;
  foreignKey: string;
}

function getOrCreateArray<T>(metadata: DecoratorMetadataObject | undefined, key: symbol): T[] {
  if (!metadata) {
    return [] as T[];
  }
  // Copy-on-write so subclasses never mutate their parent's metadata arrays
  if (!Object.hasOwn(metadata, key)) {
    const inherited = metadata[key] as T[] | undefined;
    metadata[key] = inherited ? [...inherited] : ([] as T[]);
  }
  return metadata[key] as T[];
}

/**
 * Mark a class property as a database column.
 */
export function Column() {
  return function (
    _target: undefined | ClassAccessorDecoratorTarget<any, any>,
    context: ClassFieldDecoratorContext | ClassAccessorDecoratorContext,
  ) {
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
 * posts!: Post[];
 * ```
 */
export function HasMany(targetModelGetter: () => any, foreignKey: string) {
  return function (
    _target: undefined | ClassAccessorDecoratorTarget<any, any>,
    context: ClassFieldDecoratorContext | ClassAccessorDecoratorContext,
  ) {
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
 * author!: User;
 * ```
 */
export function BelongsTo(targetModelGetter: () => any, foreignKey: string) {
  return function (
    _target: undefined | ClassAccessorDecoratorTarget<any, any>,
    context: ClassFieldDecoratorContext | ClassAccessorDecoratorContext,
  ) {
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
export function HasOne(targetModelGetter: () => any, foreignKey: string) {
  return function (
    _target: undefined | ClassAccessorDecoratorTarget<any, any>,
    context: ClassFieldDecoratorContext | ClassAccessorDecoratorContext,
  ) {
    const relations = getOrCreateArray<RelationDefinition>(context.metadata, MODEL_RELATIONS);
    relations.push({
      type: 'hasOne',
      propertyKey: context.name,
      targetModelGetter,
      foreignKey,
    });
  };
}
