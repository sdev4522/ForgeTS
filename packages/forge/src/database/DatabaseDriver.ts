// packages/forge/src/database/DatabaseDriver.ts
// ─────────────────────────────────────────────────────────────────────
// Abstract Database Driver Interface for ForgeTS ORM.
// Defines unified CRUD and query capabilities for both SQL and NoSQL stores.
// ─────────────────────────────────────────────────────────────────────

export interface FindOptions {
  where?: Record<string, any>;
  orderBy?: { column: string; direction?: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

export interface DatabaseDriver {
  /**
   * Connect to database. Fails loudly on connection error.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from database.
   */
  disconnect(): Promise<void>;

  /**
   * Find a single record by primary key / ID.
   */
  find(collectionName: string, id: string | number): Promise<any | null>;

  /**
   * Query records with filter, sort, limit, offset.
   */
  findMany(collectionName: string, options?: FindOptions): Promise<any[]>;

  /**
   * Insert a new record into collection/table.
   */
  create(collectionName: string, data: Record<string, any>): Promise<any>;

  /**
   * Update an existing record by ID.
   */
  update(collectionName: string, id: string | number, data: Record<string, any>): Promise<any>;

  /**
   * Delete a record by ID.
   */
  delete(collectionName: string, id: string | number): Promise<boolean>;

  /**
   * Raw driver escape hatch (e.g. Mongo aggregation pipeline or raw SQL query).
   */
  raw<T = any>(collectionName: string, extra?: any): Promise<T>;
}
