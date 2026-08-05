// packages/forge/src/database/index.ts
// ─────────────────────────────────────────────────────────────────────
// Public API barrel export for @forge/database.
// ─────────────────────────────────────────────────────────────────────

export { Model } from './Model.js';
export { QueryBuilder } from './QueryBuilder.js';
export { getDatabaseConnection, setDatabaseConnection, getMongoDriver, setMongoDriver } from './Connection.js';
export { MongoDriver } from './MongoDriver.js';
export type { DatabaseDriver, FindOptions } from './DatabaseDriver.js';
export { Column, HasMany, BelongsTo, HasOne } from './decorators.js';
