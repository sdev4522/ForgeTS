// tests/unit/Aliases.test.ts
// ─────────────────────────────────────────────────────────────────────
// Unit tests for ForgeTS First-Class Application Import Aliases.
// Verifies resolution across TypeScript, Bun runtime, and ESM conventions.
// ─────────────────────────────────────────────────────────────────────

import { describe, expect, test } from '../harness.js';

describe('ForgeTS First-Class Application Import Aliases', () => {
  test('1. Controller alias: @/controllers and @app/controllers resolve correctly', async () => {
    const fromAtSlash = await import('@/controllers/WelcomeController.js');
    const fromAtApp = await import('@app/controllers/WelcomeController.js');

    expect(fromAtSlash.WelcomeController).toBeDefined();
    expect(fromAtApp.WelcomeController).toBeDefined();
    expect(fromAtSlash.WelcomeController).toBe(fromAtApp.WelcomeController);
  });

  test('2. Model alias: @/models and @app/models resolve correctly', async () => {
    const fromAtSlash = await import('@/models/User.js');
    const fromAtApp = await import('@app/models/User.js');

    expect(fromAtSlash.User).toBeDefined();
    expect(fromAtApp.User).toBeDefined();
    expect(fromAtSlash.User).toBe(fromAtApp.User);
  });

  test('3. Config alias: @/config and @config resolve correctly', async () => {
    const fromAtSlash = await import('@/config/app.js');
    const fromAtConfig = await import('@config/app.js');

    expect(fromAtSlash.default).toBeDefined();
    expect(fromAtConfig.default).toBeDefined();
    expect(fromAtSlash.default.name).toBe(fromAtConfig.default.name);
  });

  test('4. Routes alias: @/routes and @routes resolve correctly', async () => {
    const fromAtSlashWeb = await import('@/routes/web.js');
    const fromAtRoutesWeb = await import('@routes/web.js');

    expect(fromAtSlashWeb.default).toBeDefined();
    expect(fromAtRoutesWeb.default).toBeDefined();

    const fromAtSlashApi = await import('@/routes/api.js');
    const fromAtRoutesApi = await import('@routes/api.js');

    expect(fromAtSlashApi.default).toBeDefined();
    expect(fromAtRoutesApi.default).toBeDefined();
  });

  test('5. Frontend Types alias: @/types and @types resolve correctly', async () => {
    const fromAtSlash = await import('@/types');
    const fromAtTypes = await import('@types');

    expect(fromAtSlash).toBeDefined();
    expect(fromAtTypes).toBeDefined();
  });

  test('6. Framework internals: @forge/core and @forge/database remain intact', async () => {
    const core = await import('@forge/core');
    const database = await import('@forge/database');

    expect(core.Application).toBeDefined();
    expect(core.Router).toBeDefined();
    expect(core.ForgeResponse).toBeDefined();
    expect(database.Model).toBeDefined();
    expect(database.Column).toBeDefined();
  });

  test('7. ESM .js specifiers map transparently to .ts source files', async () => {
    const controller = await import('@/controllers/WelcomeController.js');
    expect(controller.WelcomeController).toBeDefined();
  });
});
