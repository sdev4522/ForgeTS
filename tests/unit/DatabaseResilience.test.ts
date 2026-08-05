// tests/unit/DatabaseResilience.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';
import { verifyDatabaseConnectionOnBoot } from '../../packages/forge/src/database/Connection.js';
import app from '../../bootstrap/app.ts';
import { initConfig } from '../../packages/forge/src/config/ConfigManager.js';
import appConfig from '../../config/app.js';
import dbConfig from '../../config/database.ts';

describe('Database Failure Resilience & Fail-Fast Auditing', () => {
  beforeAll(() => {
    const configManager = initConfig(process.cwd());
    configManager.set('app', appConfig);
    configManager.set('database', dbConfig);
  });

  test('Scenario 1: Boot-Time Fail-Fast Check logs error details and throws/exits on bad connection', async () => {
    const configManager = initConfig(process.cwd());
    const dbConfigCopy = JSON.parse(JSON.stringify(dbConfig));
    dbConfigCopy.connections.mysql.port = 29999;
    configManager.set('database', dbConfigCopy);

    let errorThrown = false;
    let loggedError = '';
    const origConsoleError = console.error;
    console.error = (...args: any[]) => {
      loggedError += args.join(' ') + '\n';
    };

    const origExit = process.exit;
    (process as any).exit = (code: number) => {
      errorThrown = true;
      throw new Error(`Process exited with code ${code}`);
    };

    try {
      await verifyDatabaseConnectionOnBoot();
    } catch (e: any) {
      errorThrown = true;
    } finally {
      console.error = origConsoleError;
      (process as any).exit = origExit;
    }

    expect(errorThrown).toBe(true);
    expect(loggedError).toContain('🚨 [ForgeTS Database Boot Failure]');
    expect(loggedError).toContain("Driver:          'mysql'");
  });

  test('Scenario 2: Request-time DB Connection Outage returns HTTP 503 Service Unavailable', async () => {
    process.env.APP_DEBUG = 'true';
    process.env.DB_CONNECTION = 'mysql';

    // Simulate database network outage error during request
    const dbErr = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), {
      code: 'ECONNREFUSED',
      errno: -4078,
      syscall: 'connect',
      address: '127.0.0.1',
      port: 3306,
    });

    const req = new globalThis.Request('http://localhost:3000/api/todos', {
      headers: { accept: 'application/json' },
    });

    const response = (app as any).handleError(dbErr, req);

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.statusCode).toBe(503);
    expect(json.error).toContain('Service Unavailable');
    expect(json.error).toContain('ECONNREFUSED');
  });
});
