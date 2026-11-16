// packages/forge/src/inspect/commands.ts
// ─────────────────────────────────────────────────────────────────────
// Single source of truth for the CLI command catalogue.
// Rendered by `forge help` and included in the application manifest.
// ─────────────────────────────────────────────────────────────────────

export interface CommandDefinition {
  name: string;
  usage: string;
  description: string;
  /** True when the command changes the database or deletes data. */
  destructive?: boolean;
}

export const COMMANDS: CommandDefinition[] = [
  { name: 'serve', usage: 'forge serve', description: 'Start the dev server with auto-restart' },
  { name: 'inspect', usage: 'forge inspect [section] [--json] [--db]', description: 'Describe the application: routes, models, config, events, migrations' },
  { name: 'routes:list', usage: 'forge routes:list', description: 'Display all registered routes' },
  { name: 'migrate', usage: 'forge migrate [--json]', description: 'Run all pending database migrations', destructive: true },
  { name: 'migrate:status', usage: 'forge migrate:status [--json]', description: 'Show which migrations have run' },
  { name: 'migrate:rollback', usage: 'forge migrate:rollback [--step=N] [--json]', description: 'Revert the last batch of migrations', destructive: true },
  { name: 'migrate:reset', usage: 'forge migrate:reset [--force] [--json]', description: 'Revert every migration', destructive: true },
  { name: 'migrate:fresh', usage: 'forge migrate:fresh [--seed] [--force] [--json]', description: 'Drop all tables and re-run every migration', destructive: true },
  { name: 'db:seed', usage: 'forge db:seed [SeederName]', description: 'Run database seeders', destructive: true },
  { name: 'make:controller', usage: 'forge make:controller <Name> [--api]', description: 'Scaffold an HTTP controller' },
  { name: 'make:model', usage: 'forge make:model <Name> [--migration]', description: 'Scaffold an Active Record model' },
  { name: 'make:page', usage: 'forge make:page <Name> [--crud]', description: 'Scaffold React page(s) + full CRUD flow' },
  { name: 'make:service', usage: 'forge make:service <Name>', description: 'Scaffold an @Injectable() business service' },
  { name: 'make:middleware', usage: 'forge make:middleware <Name>', description: 'Scaffold an HTTP middleware' },
  { name: 'make:migration', usage: 'forge make:migration <name>', description: 'Scaffold a database migration file' },
  { name: 'make:seeder', usage: 'forge make:seeder <Name>', description: 'Scaffold a database seeder' },
  { name: 'cache:clear', usage: 'forge cache:clear', description: 'Clear application cache' },
  { name: 'config:clear', usage: 'forge config:clear', description: 'Clear configuration cache' },
  { name: 'optimize:clear', usage: 'forge optimize:clear', description: 'Clear all cached files' },
];
