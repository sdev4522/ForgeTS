// tests/unit/Manifest.test.ts
// ─────────────────────────────────────────────────────────────────────
// Application manifest: shape, redaction, and actionable warnings.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect, beforeAll, afterAll } from '../harness.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  Application,
  Router,
  CsrfMiddleware,
  buildManifest,
  MANIFEST_VERSION,
  type ApplicationManifest,
  type ForgeResponse,
  type Request,
} from '@forge/core';

describe('Application manifest', () => {
  let root: string;
  let manifest: ApplicationManifest;

  beforeAll(async () => {
    // A throwaway project inside the repo so `@forge/*` aliases resolve
    root = mkdtempSync(join(process.cwd(), 'tests', '.tmp-manifest-'));
    mkdirSync(join(root, 'app', 'models'), { recursive: true });
    mkdirSync(join(root, 'database', 'migrations'), { recursive: true });

    const dbIndex = pathToFileURL(join(process.cwd(), 'packages/forge/src/database/index.ts')).href;
    writeFileSync(
      join(root, 'app', 'models', 'Account.ts'),
      `import { Model, Column, HasMany } from '${dbIndex}';
export class Entry extends Model {
  static override fillable = ['amount'];
  @Column() id!: number;
  @Column() amount!: number;
}
export class Account extends Model {
  @Column() id!: number;
  @Column() email!: string;
  @Column() password!: string;
  @HasMany(() => Entry, 'account_id') entries!: Entry[];
}
`,
    );
    writeFileSync(join(root, 'database', 'migrations', '20260101000000_create_accounts.ts'), 'export async function up() {}');

    const app = new Application(root);
    app.configure('app', { name: 'ManifestApp', debug: false });
    app.configure('database', {
      default: 'mysql',
      connections: { mysql: { driver: 'mysql', host: 'db.internal', password: 'hunter2-secret' } },
    });

    const web = new Router();
    web.middleware(CsrfMiddleware);
    web.get('/accounts/:id', (_req: Request, res: ForgeResponse) => res.json({}));
    app.registerRoutes(web, { type: 'web' });

    const unprotected = new Router();
    unprotected.post('/accounts', (_req: Request, res: ForgeResponse) => res.json({}));
    app.registerRoutes(unprotected, { type: 'web' });

    const api = new Router();
    api.post('/accounts', (_req: Request, res: ForgeResponse) => res.json({}));
    app.registerRoutes(api, { prefix: '/api', type: 'api' });

    class AccountOpened {}
    app.events.listen(AccountOpened, function sendWelcome() {});

    manifest = await buildManifest(app, {
      migrationStatus: [
        { name: '20260101000000_create_accounts', ran: false, batch: null, ranAt: null, missing: false },
      ],
    });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('is versioned and JSON-serializable', () => {
    expect(manifest.manifestVersion).toBe(MANIFEST_VERSION);
    expect(manifest.app.name).toBe('ManifestApp');
    expect(JSON.parse(JSON.stringify(manifest)).routes.length).toBe(3);
  });

  test('describes routes with type, params and middleware', () => {
    const show = manifest.routes.find((r) => r.path === '/accounts/:id')!;
    expect(show).toMatchObject({ method: 'GET', type: 'web', params: ['id'], middleware: ['CsrfMiddleware'], controller: '(closure)' });
    expect(manifest.routes.find((r) => r.path === '/api/accounts')?.type).toBe('api');
  });

  test('describes models with columns, relations and mass-assignment mode', () => {
    const account = manifest.models.find((m) => m.name === 'Account')!;
    expect(account.table).toBe('accounts');
    expect(account.columns).toEqual(['id', 'email', 'password']);
    expect(account.massAssignment).toBe('default');
    expect(account.relations).toEqual([{ name: 'entries', type: 'hasMany', model: 'Entry', foreignKey: 'account_id' }]);
    expect(account.file).toBe(join('app', 'models', 'Account.ts'));

    const entry = manifest.models.find((m) => m.name === 'Entry')!;
    expect(entry.massAssignment).toBe('fillable');
    expect(entry.fillable).toEqual(['amount']);
  });

  test('never exposes configuration secrets', () => {
    const text = JSON.stringify(manifest);
    expect(text).not.toContain('hunter2-secret');
    expect((manifest.config as any).database.connections.mysql.password).toBe('[REDACTED]');
    expect((manifest.config as any).database.connections.mysql.host).toBe('db.internal');
  });

  test('lists events, migrations and commands', () => {
    expect(manifest.events).toEqual([{ event: 'AccountOpened', listeners: ['sendWelcome'] }]);
    expect(manifest.migrations.files).toEqual(['20260101000000_create_accounts']);
    expect(manifest.migrations.pending).toEqual(['20260101000000_create_accounts']);
    expect(manifest.commands.some((c) => c.name === 'migrate')).toBe(true);
  });

  test('emits actionable warnings with stable codes and a fix', () => {
    const codes = manifest.warnings.map((w) => w.code).sort();
    expect(codes).toEqual([
      'MIGRATIONS_PENDING',
      'MODEL_NO_FILLABLE',
      'MODEL_SENSITIVE_NOT_HIDDEN',
      'ROUTE_WEB_WITHOUT_CSRF',
    ]);
    for (const warning of manifest.warnings) {
      expect(warning.fix.length).toBeGreaterThan(10);
    }
    expect(manifest.warnings.find((w) => w.code === 'ROUTE_WEB_WITHOUT_CSRF')?.message).toContain('POST /accounts');
  });
});
