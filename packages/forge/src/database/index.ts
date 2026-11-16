import '../polyfills.js';
// packages/forge/src/database/index.ts
// ─────────────────────────────────────────────────────────────────────
// Public API barrel export for @forge/database.
// ─────────────────────────────────────────────────────────────────────

export { Model } from './Model.js';
export { QueryBuilder, type Paginated } from './QueryBuilder.js';
export { getDatabaseConnection, setDatabaseConnection, getMongoDriver, setMongoDriver, resetDatabaseConnection, closeDatabaseConnections } from './Connection.js';
export { MongoDriver } from './MongoDriver.js';
export type { DatabaseDriver, FindOptions } from './DatabaseDriver.js';
export { Column, HasMany, BelongsTo, HasOne, MODEL_COLUMNS, MODEL_RELATIONS } from './decorators.js';
export { formatMysqlDateTime, serializeDatabaseValue, serializeModelAttributes } from './serializer.js';
export {
  Migrator,
  type MigrationModule,
  type MigrationStatus,
  type MigrationResult,
  type MigratorOptions,
} from './Migrator.js';
