#!/usr/bin/env bun
// bin/forge.ts
// ─────────────────────────────────────────────────────────────────────
// ForgeTS CLI Scaffolding Tool (artisan equivalent).
// ─────────────────────────────────────────────────────────────────────

import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const command = args[0];
const targetName = args[1];

const ROOT_DIR = process.cwd();

function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function createFile(filePath: string, content: string, description: string) {
  if (existsSync(filePath)) {
    console.error(`❌ [ForgeTS CLI] File already exists: ${filePath}`);
    process.exit(1);
  }
  ensureDir(join(filePath, '..'));
  writeFileSync(filePath, content.trimStart(), 'utf-8');
  console.log(`✅ [ForgeTS CLI] Created ${description}: ${filePath.replace(ROOT_DIR + '/', '')}`);
}

function toPascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter) => letter.toUpperCase())
    .replace(/[\s-_]+/g, '');
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

async function runCommand() {
  switch (command) {
    case 'serve': {
      console.log('⚡ Starting ForgeTS development server...');
      const proc = Bun.spawn(['bun', '--watch', 'run', 'bin/serve.ts'], {
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
      break;
    }

    case 'make:controller': {
      if (!targetName) {
        console.error('❌ Usage: forge make:controller <ControllerName>');
        process.exit(1);
      }
      const className = toPascalCase(targetName).endsWith('Controller')
        ? toPascalCase(targetName)
        : `${toPascalCase(targetName)}Controller`;

      const routePath = '/' + toSnakeCase(className.replace('Controller', ''));
      const filePath = join(ROOT_DIR, 'app', 'controllers', `${className}.ts`);

      const template = `import { Controller, Get, Post, Put, Delete } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';

@Controller('${routePath}')
export class ${className} {
  @Get('/')
  async index(_req: Request, res: ForgeResponse) {
    return res.json([]);
  }

  @Get('/:id')
  async show(req: Request, res: ForgeResponse) {
    return res.json({ id: req.params.id });
  }

  @Post('/')
  async store(req: Request, res: ForgeResponse) {
    return res.created({});
  }

  @Put('/:id')
  async update(req: Request, res: ForgeResponse) {
    return res.json({ id: req.params.id });
  }

  @Delete('/:id')
  async destroy(_req: Request, res: ForgeResponse) {
    return res.noContent();
  }
}
`;
      createFile(filePath, template, 'Controller');
      break;
    }

    case 'make:model': {
      if (!targetName) {
        console.error('❌ Usage: forge make:model <ModelName> [--migration]');
        process.exit(1);
      }
      const className = toPascalCase(targetName);
      const tableName = toSnakeCase(className) + (toSnakeCase(className).endsWith('s') ? '' : 's');
      const filePath = join(ROOT_DIR, 'app', 'models', `${className}.ts`);

      const template = `import { Model, Column } from '@forge/database';

export class ${className} extends Model {
  static override table = '${tableName}';

  @Column() declare id: number;
  @Column() declare created_at: string;
  @Column() declare updated_at: string;
}
`;
      createFile(filePath, template, 'Model');

      if (args.includes('--migration')) {
        const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
        const migName = `${timestamp}_create_${tableName}_table.ts`;
        const migPath = join(ROOT_DIR, 'database', 'migrations', migName);
        const migTemplate = `import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('${tableName}')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('created_at', 'text')
    .addColumn('updated_at', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('${tableName}').execute();
}
`;
        createFile(migPath, migTemplate, 'Migration');
      }
      break;
    }

    case 'make:service': {
      if (!targetName) {
        console.error('❌ Usage: forge make:service <ServiceName>');
        process.exit(1);
      }
      const className = toPascalCase(targetName).endsWith('Service')
        ? toPascalCase(targetName)
        : `${toPascalCase(targetName)}Service`;
      const filePath = join(ROOT_DIR, 'app', 'services', `${className}.ts`);

      const template = `import { Injectable } from '@forge/core';

@Injectable({ lifetime: 'singleton' })
export class ${className} {
  async execute() {
    // Business logic goes here
  }
}
`;
      createFile(filePath, template, 'Service');
      break;
    }

    case 'make:middleware': {
      if (!targetName) {
        console.error('❌ Usage: forge make:middleware <MiddlewareName>');
        process.exit(1);
      }
      const className = toPascalCase(targetName).endsWith('Middleware')
        ? toPascalCase(targetName)
        : `${toPascalCase(targetName)}Middleware`;
      const filePath = join(ROOT_DIR, 'app', 'middleware', `${className}.ts`);

      const template = `import type { Middleware, Request, ForgeResponse, NextFunction } from '@forge/core';

export class ${className} implements Middleware {
  async handle(req: Request, next: NextFunction): Promise<ForgeResponse> {
    // Pre-processing logic (e.g. Auth check, CORS header)
    const response = await next();
    // Post-processing logic
    return response;
  }
}
`;
      createFile(filePath, template, 'Middleware');
      break;
    }

    case 'make:migration': {
      if (!targetName) {
        console.error('❌ Usage: forge make:migration <migration_name>');
        process.exit(1);
      }
      const snakeName = toSnakeCase(targetName);
      const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
      const migName = `${timestamp}_${snakeName}.ts`;
      const migPath = join(ROOT_DIR, 'database', 'migrations', migName);

      const template = `import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Schema creation logic
}

export async function down(db: Kysely<any>): Promise<void> {
  // Schema rollback logic
}
`;
      createFile(migPath, template, 'Migration');
      break;
    }

    case 'routes:list': {
      const appModule = await import(join(ROOT_DIR, 'bootstrap', 'app.js'));
      const app = appModule.default;
      const routes = app.getRoutes();

      console.log('\n  ⚡ Registered Routes');
      console.log('  ┌────────┬───────────────────────────────┬──────────────────────────────┐');
      console.log('  │ Method │ Path                          │ Handler                      │');
      console.log('  ├────────┼───────────────────────────────┼──────────────────────────────┤');
      for (const route of routes) {
        const method = route.method.padEnd(6);
        const path = route.fullPath.padEnd(29);
        const handler = `${route.controllerClass.name}@${String(route.handlerName)}`.padEnd(28);
        console.log(`  │ ${method} │ ${path} │ ${handler} │`);
      }
      console.log('  └────────┴───────────────────────────────┴──────────────────────────────┘\n');
      break;
    }

    default: {
      console.log(`
⚡ ForgeTS CLI Scaffolding Tool v0.1.0

Available Commands:
  forge serve                            Start dev server with Bun hot reload
  forge make:controller <ControllerName> Scaffold an HTTP controller
  forge make:model <ModelName>           Scaffold an Active Record model [--migration]
  forge make:service <ServiceName>       Scaffold an @Injectable() business service
  forge make:middleware <Name>           Scaffold an HTTP middleware
  forge make:migration <name>            Scaffold a database migration file
  forge routes:list                      Display all registered routes
`);
      break;
    }
  }
}

runCommand().catch((err) => {
  console.error('❌ [ForgeTS CLI] Error:', err);
  process.exit(1);
});
