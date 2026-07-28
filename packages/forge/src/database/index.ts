// packages/forge/src/database/index.ts
// ─────────────────────────────────────────────────────────────────────
// Public API barrel export for @forge/database.
// ─────────────────────────────────────────────────────────────────────

export { Model } from './Model.js';
export { QueryBuilder } from './QueryBuilder.js';
export { getDatabaseConnection, setDatabaseConnection, ForgeBunSqliteDialect } from './Connection.js';
export { Column, HasMany, BelongsTo, HasOne } from './decorators.js';
