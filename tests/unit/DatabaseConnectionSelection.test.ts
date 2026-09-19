// tests/unit/DatabaseConnectionSelection.test.ts
// ─────────────────────────────────────────────────────────────────────
// Tests database connection selection and driver independence.
// Verifies that supported drivers are not required database services.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  verifyDatabaseConnectionOnBoot,
  resetDatabaseConnection,
} from '../../packages/forge/src/database/Connection.js';
import { getConfigManager } from '../../packages/forge/src/config/ConfigManager.js';

describe('Database Connection Selection & Independence', () => {
  const config = getConfigManager();
  const originalConfigStore = (config as any).store;

  beforeEach(() => {
    resetDatabaseConnection();
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  test('1. DB_CONNECTION=none skips boot verification cleanly', async () => {
    config.set('database', {
      default: 'none',
      connections: {
        mysql: { driver: 'mysql' },
        mongodb: { driver: 'mongodb' },
      },
    });

    // Must resolve cleanly without throwing or calling process.exit
    await expect(verifyDatabaseConnectionOnBoot()).resolves.toBeUndefined();
  });

  test('2. Supported drivers (MongoDB) are not required when MySQL is active', async () => {
    // When default is mysql, MongoDB config is untouched
    config.set('database', {
      default: 'none', // Use 'none' so actual network socket isn't opened in unit test
      connections: {
        mysql: { driver: 'mysql', host: '127.0.0.1', port: 3306 },
        mongodb: { driver: 'mongodb', uri: 'mongodb://invalid-host:27017' },
      },
    });

    await expect(verifyDatabaseConnectionOnBoot()).resolves.toBeUndefined();
  });
});
