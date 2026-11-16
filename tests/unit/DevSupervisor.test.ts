// tests/unit/DevSupervisor.test.ts
// ─────────────────────────────────────────────────────────────────────
// Unit tests for the ForgeTS Development Supervisor.
// Validates source file matching, frontend exclusion, debounce coalescing,
// and process lifecycle management.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from '../harness.js';
import { DevSupervisor } from '../../bin/dev.js';

describe('DevSupervisor — Source File Filter & Watch Logic', () => {
  const supervisor = new DevSupervisor();

  it('triggers restart for backend application controllers, models, and services', () => {
    expect(supervisor.shouldWatchFile('app/controllers/WelcomeController.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('app/controllers/ApiController.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('app/models/User.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('app/services/PaymentService.ts')).toBe(true);
  });

  it('triggers restart for route definitions and configuration files', () => {
    expect(supervisor.shouldWatchFile('routes/web.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('routes/api.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('config/app.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('config/database.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('bootstrap/app.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('bootstrap/env.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('.env')).toBe(true);
  });

  it('triggers restart for framework core source files during framework development', () => {
    expect(supervisor.shouldWatchFile('packages/forge/src/core/Application.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('packages/forge/src/routing/Router.ts')).toBe(true);
    expect(supervisor.shouldWatchFile('packages/forge/src/http/Response.ts')).toBe(true);
  });

  it('ignores frontend React pages, components, and CSS (handled by Vite HMR & SSR)', () => {
    expect(supervisor.shouldWatchFile('resources/js/pages/welcome.tsx')).toBe(false);
    expect(supervisor.shouldWatchFile('resources/js/pages/dashboard.tsx')).toBe(false);
    expect(supervisor.shouldWatchFile('resources/js/components/Button.tsx')).toBe(false);
    expect(supervisor.shouldWatchFile('resources/js/entry-client.tsx')).toBe(false);
    expect(supervisor.shouldWatchFile('resources/css/app.css')).toBe(false);
    expect(supervisor.shouldWatchFile('resources/views/app.html')).toBe(false);
  });

  it('ignores public static files, build artifacts, storage, and node_modules', () => {
    expect(supervisor.shouldWatchFile('public/favicon.ico')).toBe(false);
    expect(supervisor.shouldWatchFile('public/robots.txt')).toBe(false);
    expect(supervisor.shouldWatchFile('dist/client/manifest.json')).toBe(false);
    expect(supervisor.shouldWatchFile('dist/server/entry-server.js')).toBe(false);
    expect(supervisor.shouldWatchFile('storage/logs/app.log')).toBe(false);
    expect(supervisor.shouldWatchFile('node_modules/vite/dist/node/index.js')).toBe(false);
  });

  it('ignores temporary, swap, and gitkeep files', () => {
    expect(supervisor.shouldWatchFile('app/controllers/WelcomeController.ts.swp')).toBe(false);
    expect(supervisor.shouldWatchFile('app/controllers/WelcomeController.ts.tmp')).toBe(false);
    expect(supervisor.shouldWatchFile('app/controllers/WelcomeController.ts~')).toBe(false);
    expect(supervisor.shouldWatchFile('app/models/.gitkeep')).toBe(false);
  });
});

describe('DevSupervisor — Debounce and Lifecycle', () => {
  it('coalesces multiple rapid restart calls within debounce window', async () => {
    let restartCount = 0;
    const supervisor = new DevSupervisor({
      debounceMs: 50,
    });

    // Spy on stopChild to count restarts
    supervisor.stopChild = async () => {
      restartCount++;
    };
    supervisor.startChild = () => {};

    supervisor.restart('app/controllers/WelcomeController.ts');
    supervisor.restart('app/controllers/WelcomeController.ts');
    supervisor.restart('app/controllers/WelcomeController.ts');

    expect(restartCount).toBe(0);

    // Await debounce interval
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(restartCount).toBe(1);

    await supervisor.stop();
  });

  it('cleans up resources and watchers when stopped', async () => {
    const supervisor = new DevSupervisor();
    let stopped = false;
    supervisor.stopChild = async () => {
      stopped = true;
    };

    await supervisor.stop();
    expect(stopped).toBe(true);
  });
});
