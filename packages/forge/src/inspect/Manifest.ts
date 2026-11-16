// packages/forge/src/inspect/Manifest.ts
// ─────────────────────────────────────────────────────────────────────
// Application Manifest.
//
// A single machine-readable description of a ForgeTS application: routes,
// middleware, models, configuration shape, events, migrations and CLI
// commands — plus actionable warnings. Built for tooling and AI coding
// agents, so they can read one document instead of the whole source tree.
//
// Secrets never appear here: config values pass through the Redactor.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Application } from '../core/Application.js';
import { getConfigManager } from '../config/ConfigManager.js';
import { Redactor } from '../errors/Redactor.js';
import { Model } from '../database/Model.js';
import { MODEL_COLUMNS, MODEL_RELATIONS, type RelationDefinition } from '../database/decorators.js';
import type { MigrationStatus } from '../database/Migrator.js';
import { COMMANDS, type CommandDefinition } from './commands.js';
import { Validator } from '../http/Validator.js';

export const MANIFEST_VERSION = 1;

export interface ManifestRoute {
  method: string;
  path: string;
  type: 'web' | 'api';
  controller: string;
  action: string;
  /** Source file of the controller, relative to the project root (null for closures). */
  file: string | null;
  params: string[];
  middleware: string[];
}

export interface ManifestRelation {
  name: string;
  type: string;
  model: string | null;
  foreignKey: string;
}

export interface ManifestModel {
  name: string;
  file: string;
  table: string;
  connection: string;
  primaryKey: string;
  timestamps: boolean;
  columns: string[];
  /** Which mass-assignment rule applies: explicit allow-list, explicit deny-list, or the default guard. */
  massAssignment: 'fillable' | 'guarded' | 'default';
  fillable: string[] | null;
  guarded: string[] | null;
  hidden: string[];
  relations: ManifestRelation[];
}

export interface ManifestWarning {
  /** Stable machine-readable code. */
  code: string;
  severity: 'error' | 'warning';
  message: string;
  file: string | null;
  /** The concrete change that resolves the warning. */
  fix: string;
}

export interface ManifestMigrations {
  directory: string;
  files: string[];
  /** Present only when the manifest was built with database access. */
  status?: MigrationStatus[];
  pending?: string[];
}

export interface ApplicationManifest {
  manifestVersion: number;
  generatedAt: string;
  framework: { name: string; version: string; runtime: string };
  app: { name: string; environment: string; debug: boolean };
  conventions: {
    directories: Record<string, string>;
    imports: Record<string, string>;
    rules: string[];
  };
  routes: ManifestRoute[];
  middleware: { global: string[] };
  models: ManifestModel[];
  config: Record<string, unknown>;
  events: Array<{ event: string; listeners: string[] }>;
  migrations: ManifestMigrations;
  commands: CommandDefinition[];
  warnings: ManifestWarning[];
}

export interface BuildManifestOptions {
  rootDir?: string;
  /** Supply migration status (requires a database connection) to include it. */
  migrationStatus?: MigrationStatus[];
}

const SENSITIVE_COLUMN = /pass(word|wd)?|secret|token|api[_-]?key/i;

function className(value: unknown): string {
  if (typeof value === 'function') return value.name || '(anonymous)';
  return (value as object)?.constructor?.name ?? '(unknown)';
}

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => /\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
    .sort();
}

/**
 * Import every file under app/models and collect exported Model subclasses.
 */
export async function discoverModels(
  rootDir: string,
): Promise<Array<{ model: typeof Model; file: string }>> {
  const modelsDir = join(rootDir, 'app', 'models');
  const found: Array<{ model: typeof Model; file: string }> = [];
  const seen = new Set<unknown>();

  for (const file of listSourceFiles(modelsDir)) {
    const absolute = join(modelsDir, file);
    const mod = await import(pathToFileURL(absolute).href);
    for (const exported of Object.values(mod)) {
      if (
        typeof exported === 'function' &&
        exported.prototype instanceof Model &&
        !seen.has(exported)
      ) {
        seen.add(exported);
        found.push({ model: exported as unknown as typeof Model, file: relative(rootDir, absolute) });
      }
    }
  }

  return found;
}

function describeModel(model: typeof Model, file: string): ManifestModel {
  const metadata = (model as any)[Symbol.metadata] ?? {};
  const columns = ((metadata[MODEL_COLUMNS] as Array<string | symbol>) ?? []).map(String);
  const relations = ((metadata[MODEL_RELATIONS] as RelationDefinition[]) ?? []).map((rel) => {
    let target: string | null = null;
    try {
      target = className(rel.targetModelGetter());
    } catch {
      target = null;
    }
    return {
      name: String(rel.propertyKey),
      type: rel.type,
      model: target,
      foreignKey: rel.foreignKey,
    };
  });

  const fillable = Array.isArray(model.fillable) ? [...model.fillable] : null;
  const guarded = Array.isArray(model.guarded) ? [...model.guarded] : null;

  return {
    name: model.name,
    file,
    table: model.getTable(),
    connection: model.connection ?? 'default',
    primaryKey: model.getPrimaryKey(),
    timestamps: model.timestamps,
    columns: [...new Set(columns)],
    massAssignment: fillable ? 'fillable' : guarded ? 'guarded' : 'default',
    fillable,
    guarded,
    hidden: Array.isArray(model.hidden) ? [...model.hidden] : [],
    relations,
  };
}

function modelWarnings(model: ManifestModel): ManifestWarning[] {
  const warnings: ManifestWarning[] = [];

  if (model.massAssignment === 'default') {
    warnings.push({
      code: 'MODEL_NO_FILLABLE',
      severity: 'warning',
      message: `Model ${model.name} declares neither 'fillable' nor 'guarded'; every attribute except the primary key and timestamps can be mass-assigned from request input.`,
      file: model.file,
      fix: `Add \`static override fillable = [...]\` to ${model.name} listing only the attributes users may set.`,
    });
  }

  const exposed = model.columns.filter((col) => SENSITIVE_COLUMN.test(col) && !model.hidden.includes(col));
  for (const column of exposed) {
    warnings.push({
      code: 'MODEL_SENSITIVE_NOT_HIDDEN',
      severity: 'error',
      message: `Model ${model.name} serializes sensitive column '${column}' in toJSON() / API responses.`,
      file: model.file,
      fix: `Add '${column}' to \`static override hidden\` on ${model.name}.`,
    });
  }

  return warnings;
}

/**
 * Build the full application manifest.
 */
export async function buildManifest(
  app: Application,
  options: BuildManifestOptions = {},
): Promise<ApplicationManifest> {
  const rootDir = resolve(options.rootDir ?? app.getRootDir());
  const warnings: ManifestWarning[] = [];

  // ─── Routes ───
  const controllersDir = join(rootDir, 'app', 'controllers');
  const controllerFiles = new Map(
    listSourceFiles(controllersDir).map((file) => [
      file.replace(/^.*[\\/]/, '').replace(/\.(ts|js)$/, ''),
      relative(rootDir, join(controllersDir, file)),
    ]),
  );

  const seenRoutes = new Set<string>();
  const routes: ManifestRoute[] = app.getRoutes().map((route) => {
    const controller = route.controllerClass.name || '(anonymous)';
    const isClosure = controller === 'StandaloneController';
    const key = `${route.method} ${route.fullPath}`;
    seenRoutes.add(key);

    return {
      method: route.method,
      path: route.fullPath,
      type: route.type ?? (route.fullPath.startsWith('/api') ? 'api' : 'web'),
      controller: isClosure ? '(closure)' : controller,
      action: isClosure ? '(closure)' : String(route.handlerName),
      file: isClosure ? null : (controllerFiles.get(controller) ?? null),
      params: route.fullPath
        .split('/')
        .filter((segment) => segment.startsWith(':') || segment.startsWith('*'))
        .map((segment) => segment.slice(1) || 'wildcard'),
      middleware: route.middleware.map(className),
    };
  });
  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  for (const route of routes) {
    const writes = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method);
    if (route.type === 'web' && writes && !route.middleware.includes('CsrfMiddleware')) {
      warnings.push({
        code: 'ROUTE_WEB_WITHOUT_CSRF',
        severity: 'error',
        message: `Web route ${route.method} ${route.path} changes state but is not protected by CsrfMiddleware.`,
        file: route.file,
        fix: `Register it on a router that calls \`router.middleware(CsrfMiddleware)\`, or register the router with \`{ type: 'api' }\` if it is a stateless API.`,
      });
    }
  }

  // ─── Models ───
  const models: ManifestModel[] = [];
  try {
    for (const { model, file } of await discoverModels(rootDir)) {
      const described = describeModel(model, file);
      models.push(described);
      warnings.push(...modelWarnings(described));
    }
  } catch (err) {
    warnings.push({
      code: 'MODEL_DISCOVERY_FAILED',
      severity: 'error',
      message: `Could not load app/models: ${Redactor.redactString(err instanceof Error ? err.message : String(err))}`,
      file: 'app/models',
      fix: 'Fix the import or syntax error in the reported model file.',
    });
  }
  models.sort((a, b) => a.name.localeCompare(b.name));

  // ─── Config (redacted) ───
  let config: Record<string, unknown> = {};
  let appName = 'ForgeTS';
  let debug = false;
  try {
    const manager = getConfigManager();
    config = Redactor.sanitizeData(manager.all()) as Record<string, unknown>;
    appName = manager.get<string>('app.name', 'ForgeTS');
    debug = manager.get<boolean>('app.debug', false) === true;
  } catch {
    // Config not initialized: leave empty
  }

  if (debug && process.env.NODE_ENV === 'production') {
    warnings.push({
      code: 'DEBUG_IN_PRODUCTION',
      severity: 'error',
      message: 'APP_DEBUG is enabled while NODE_ENV=production; stack traces and source would be shown to clients.',
      file: '.env',
      fix: 'Set APP_DEBUG=false.',
    });
  }

  // ─── Migrations ───
  const migrationsDir = join(rootDir, 'database', 'migrations');
  const migrationFiles = existsSync(migrationsDir)
    ? readdirSync(migrationsDir)
        .filter((file) => /\.(ts|js|mjs)$/.test(file) && !file.endsWith('.d.ts'))
        .map((file) => file.replace(/\.(ts|js|mjs)$/, ''))
        .sort()
    : [];

  const migrations: ManifestMigrations = {
    directory: 'database/migrations',
    files: migrationFiles,
  };
  if (options.migrationStatus) {
    migrations.status = options.migrationStatus;
    migrations.pending = options.migrationStatus.filter((s) => !s.ran).map((s) => s.name);
    if (migrations.pending.length > 0) {
      warnings.push({
        code: 'MIGRATIONS_PENDING',
        severity: 'warning',
        message: `${migrations.pending.length} migration(s) have not been run: ${migrations.pending.join(', ')}.`,
        file: 'database/migrations',
        fix: 'Run `npm run forge migrate`.',
      });
    }
  }

  return {
    manifestVersion: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    framework: {
      name: 'ForgeTS',
      version: (app.constructor as typeof Application).VERSION,
      runtime: `Node.js ${process.version}`,
    },
    app: {
      name: appName,
      environment: process.env.NODE_ENV ?? 'development',
      debug,
    },
    conventions: {
      directories: {
        controllers: 'app/controllers',
        models: 'app/models',
        services: 'app/services',
        middleware: 'app/middleware',
        config: 'config',
        routes: 'routes',
        migrations: 'database/migrations',
        seeders: 'database/seeders',
        pages: 'resources/js/pages',
        views: 'resources/views',
        tests: 'tests',
      },
      imports: {
        framework: '@forge/core',
        database: '@forge/database',
        controllers: '@/controllers/*',
        models: '@/models/*',
        config: '@/config/*',
        routes: '@/routes/*',
      },
      rules: [
        'Import paths use the .js extension even though sources are .ts.',
        'Web routes go in routes/web.ts (CSRF protected); stateless JSON routes go in routes/api.ts (served under /api).',
        'Controllers are classes decorated with @Controller(prefix) and @Get/@Post/@Put/@Patch/@Delete, registered with router.controller(Class). For plain REST, use an undecorated class with index/show/store/update/destroy and router.resource(path, Class) (router.apiResource for JSON APIs).',
        'Handlers return what should be sent: an object/array/model (JSON), a string (plain text), null (204), or a helper result: view(), json(), created(), redirect(), back(). Use abort(404) to stop with an HTTP error.',
        'Read input with req.input(key, default), req.only(...), req.all(); pages without logic use router.view(path, page).',
        'Validate input with `await req.validate({ field: "required|email|max:255" })` before using it; never pass req.all() or req.body() straight into Model.create(). Available rules: ' + Validator.rules().join(', ') + '.',
        'Query models with Model.find/findBy/where/whereIn/orderBy/latest/paginate/count; write with Model.create, instance.update, Model.firstOrCreate, Model.updateOrCreate, Model.destroy.',
        "Models declare `static override fillable` for mass-assignable attributes and `static override hidden` for attributes kept out of JSON.",
        'Hash passwords with `await Hash.make(password)`; verify with `Hash.verify(plain, hash)`.',
        'Schema changes go in a new migration (`forge make:migration`), then `forge migrate`. Never edit a migration that has already run.',
        'Run `npm run typecheck` and `npm test` before finishing a change.',
      ],
    },
    routes,
    middleware: { global: app.getGlobalMiddleware().map(className) },
    models,
    config,
    events: app.events.describe(),
    migrations,
    commands: COMMANDS,
    warnings,
  };
}
