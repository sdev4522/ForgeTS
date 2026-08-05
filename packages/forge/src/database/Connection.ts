// packages/forge/src/database/Connection.ts
// ─────────────────────────────────────────────────────────────────────
// Database Connection Manager for SQL (MySQL) and NoSQL (MongoDB).
// Provides singleton drivers, connection pooling, and boot-time fail-fast health checks.
// ─────────────────────────────────────────────────────────────────────

import { Kysely, MysqlDialect } from 'kysely';
import mysql from 'mysql2';
import { config } from '../config/ConfigManager.js';
import { MongoDriver } from './MongoDriver.js';
import { ErrorDisplayEngine } from '../http/ErrorDisplayEngine.js';

let _kyselyInstance: Kysely<any> | null = null;
let _mongoDriverInstance: MongoDriver | null = null;

export function getDatabaseConnection(): Kysely<any> {
  if (_kyselyInstance) {
    return _kyselyInstance;
  }

  const defaultConnectionName = config<string>('database.default', 'mysql');
  const connConfig = config<any>(`database.connections.${defaultConnectionName}`);

  if (!connConfig) {
    throw new Error(`[ForgeTS Database Error] Database connection '${defaultConnectionName}' is not defined in config/database.ts.`);
  }

  if (connConfig.driver === 'mysql') {
    const pool = mysql.createPool({
      host: connConfig.host ?? '127.0.0.1',
      port: connConfig.port ?? 3306,
      database: connConfig.database,
      user: connConfig.username ?? connConfig.user ?? 'root',
      password: connConfig.password ?? '',
      connectionLimit: 10,
      connectTimeout: 2000,
    });

    _kyselyInstance = new Kysely<any>({
      dialect: new MysqlDialect({ pool: pool as any }),
    });
  } else if (connConfig.driver === 'mongodb') {
    throw new Error('[ForgeTS Database Error] Default connection is configured as MongoDB. Use getMongoDriver() or model-specific Mongo connection.');
  } else {
    throw new Error(`[ForgeTS Database Error] Unsupported or unconfigured database driver: '${connConfig.driver}'.`);
  }

  return _kyselyInstance;
}

export function getMongoDriver(): MongoDriver {
  if (_mongoDriverInstance) {
    return _mongoDriverInstance;
  }

  const mongoConfig = config<any>('database.connections.mongodb');
  const uri = mongoConfig?.uri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const database = mongoConfig?.database || process.env.MONGO_DB_NAME || 'forgets';

  _mongoDriverInstance = new MongoDriver({ uri, database });
  return _mongoDriverInstance;
}

export function setDatabaseConnection(db: Kysely<any>): void {
  _kyselyInstance = db;
}

export function setMongoDriver(driver: MongoDriver): void {
  _mongoDriverInstance = driver;
}

/**
 * Fail-Fast Database Boot Check.
 * Verifies active database connection during server startup.
 * Exits process with code 1 if unreachable, logging clear error details with secrets redacted.
 */
export async function verifyDatabaseConnectionOnBoot(): Promise<void> {
  const defaultConn = config<string>('database.default', 'mysql');
  const connConfig = config<any>(`database.connections.${defaultConn}`);

  if (!connConfig) {
    console.error(`\n[ForgeTS Database Boot Error] Database connection '${defaultConn}' is not defined in config/database.ts.`);
    process.exit(1);
  }

  const sanitizedConfig = {
    connectionName: defaultConn,
    driver: connConfig.driver,
    host: connConfig.host ?? '127.0.0.1',
    port: connConfig.port,
    database: connConfig.database,
    uri: connConfig.uri ? ErrorDisplayEngine.redactSecrets(connConfig.uri) : undefined,
  };

  try {
    if (connConfig.driver === 'mysql') {
      const db = getDatabaseConnection();
      await (db as any).executeQuery({ sql: 'SELECT 1;', parameters: [], query: {} });

      // Auto-ensure default app schema tables (todos, notes) exist on MySQL startup
      try {
        await (db as any).executeQuery({
          sql: `CREATE TABLE IF NOT EXISTS todos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            completed TINYINT(1) DEFAULT 0,
            created_at VARCHAR(255)
          );`,
          parameters: [],
          query: {},
        });

        await (db as any).executeQuery({
          sql: `CREATE TABLE IF NOT EXISTS notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            created_at VARCHAR(255)
          );`,
          parameters: [],
          query: {},
        });
      } catch {}
    } else if (connConfig.driver === 'mongodb') {
      const mongo = getMongoDriver();
      await mongo.connect();
    }
  } catch (err: any) {
    console.error('\n' + '─'.repeat(70));
    console.error(`🚨 [ForgeTS Database Boot Failure] Unreachable Database Connection.`);
    console.error(`   - Connection Name: '${defaultConn}'`);
    console.error(`   - Driver:          '${connConfig.driver}'`);
    console.error(`   - Config:          ${JSON.stringify(sanitizedConfig)}`);
    console.error(`   - Error Details:   ${ErrorDisplayEngine.redactSecrets(err.message)}`);
    console.error('─'.repeat(70) + '\n');
    process.exit(1);
  }
}
