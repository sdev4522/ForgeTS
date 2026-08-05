#!/usr/bin/env bun
// bin/forge.ts
// ─────────────────────────────────────────────────────────────────────
// ForgeTS CLI Scaffolding Tool (artisan equivalent).
// ─────────────────────────────────────────────────────────────────────

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, rmSync } from 'node:fs';
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

function createFileSafe(filePath: string, content: string, description: string): boolean {
  if (existsSync(filePath)) {
    console.warn(`⚠️  [ForgeTS CLI] ${description} already exists: ${filePath.replace(ROOT_DIR + '/', '')} (skipping)`);
    return false;
  }
  ensureDir(join(filePath, '..'));
  writeFileSync(filePath, content.trimStart(), 'utf-8');
  console.log(`✅ [ForgeTS CLI] Created ${description}: ${filePath.replace(ROOT_DIR + '/', '')}`);
  return true;
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

function getResourceNames(input: string) {
  let clean = input.trim();
  clean = clean.replace(/Controller$/i, '');
  let singular = clean;
  let plural = clean;

  if (clean.toLowerCase().endsWith('s') && clean.length > 3) {
    singular = clean.slice(0, -1);
    plural = clean;
  } else {
    singular = clean;
    plural = clean + 's';
  }

  const singularPascal = toPascalCase(singular);
  const pluralPascal = toPascalCase(plural);
  const singularSnake = toSnakeCase(singular);
  const pluralSnake = toSnakeCase(plural);

  return {
    singularPascal,
    pluralPascal,
    singularSnake,
    pluralSnake,
    controllerName: `${singularPascal}Controller`,
  };
}

function registerWebRouteController(controllerName: string) {
  const webRoutesPath = join(ROOT_DIR, 'routes', 'web.ts');
  if (!existsSync(webRoutesPath)) return;

  let content = readFileSync(webRoutesPath, 'utf-8');
  if (content.includes(controllerName)) {
    console.log(`ℹ️  [ForgeTS CLI] ${controllerName} already registered in routes/web.ts`);
    return;
  }

  const importStatement = `import { ${controllerName} } from '../app/controllers/${controllerName}.js';\n`;
  const routerControllerCall = `router.controller(${controllerName});\n`;

  if (content.includes('const router = new Router')) {
    content = content.replace(/(const router = new Router)/, `${importStatement}$1`);
  } else {
    content = importStatement + content;
  }

  if (content.includes('export default router;')) {
    content = content.replace(/(export default router;)/, `${routerControllerCall}$1`);
  } else {
    content += `\n${routerControllerCall}`;
  }

  writeFileSync(webRoutesPath, content, 'utf-8');
  console.log(`✅ [ForgeTS CLI] Registered ${controllerName} in routes/web.ts`);
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

    case 'make:page': {
      if (!targetName) {
        console.error('❌ Usage: forge make:page <PageName> [--crud]');
        process.exit(1);
      }

      const isCrud = args.includes('--crud');
      const names = getResourceNames(targetName);
      const { singularPascal, pluralPascal, pluralSnake, controllerName } = names;

      const pageDir = join(ROOT_DIR, 'resources', 'js', 'pages', pluralSnake);
      ensureDir(pageDir);

      if (isCrud) {
        // 1. Model (overwrite safe)
        const modelPath = join(ROOT_DIR, 'app', 'models', `${singularPascal}.ts`);
        const modelTemplate = `import { Model } from '@forge/database';

export class ${singularPascal} extends Model {
  static override table = '${pluralSnake}';
  static override timestamps = false;
  static override fillable = ['title', 'content', 'created_at'];
}
`;
        createFileSafe(modelPath, modelTemplate, 'Model');

        // 2. Migration (overwrite safe)
        const migDir = join(ROOT_DIR, 'database', 'migrations');
        ensureDir(migDir);
        const existingMigFiles = readdirSync(migDir);
        const targetMigSuffix = `_create_${pluralSnake}_table.ts`;
        const foundMig = existingMigFiles.find((f) => f.endsWith(targetMigSuffix));

        if (foundMig) {
          console.warn(`⚠️  [ForgeTS CLI] Migration already exists: database/migrations/${foundMig} (skipping)`);
        } else {
          const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
          const migName = `${timestamp}_create_${pluralSnake}_table.ts`;
          const migPath = join(ROOT_DIR, 'database', 'migrations', migName);
          const migTemplate = `import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('${pluralSnake}')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('content', 'text')
    .addColumn('created_at', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('${pluralSnake}').execute();
}
`;
          createFileSafe(migPath, migTemplate, 'Migration');
        }

        // 3. Controller (overwrite safe)
        const controllerPath = join(ROOT_DIR, 'app', 'controllers', `${controllerName}.ts`);
        const controllerTemplate = `import { Controller, Get, Post, Request, ForgeResponse, now } from '@forge/core';
import { ${singularPascal} } from '../models/${singularPascal}.js';

@Controller('/${pluralSnake}')
export class ${controllerName} {

  /** GET /${pluralSnake} — Render index page (React SSR) */
  @Get('/')
  async index(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const rawItems = await ${singularPascal}.all();
    const items = rawItems.map((item) => item.toJSON());
    return res.view('${pluralSnake}/index', { items, title: 'All ${pluralPascal}' });
  }

  /** GET /${pluralSnake}/create — Render create form page (React SSR) */
  @Get('/create')
  async create(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    return res.view('${pluralSnake}/create', { title: 'Create ${singularPascal}' });
  }

  /** GET /${pluralSnake}/:id — Render show page (React SSR) */
  @Get('/:id')
  async show(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const item = await ${singularPascal}.find(req.param('id'));
    if (!item) return res.status(404).html('<h1>${singularPascal} Not Found</h1>');
    return res.view('${pluralSnake}/show', { item: item.toJSON(), title: \`${singularPascal} #\${req.param('id')}\` });
  }

  /** GET /${pluralSnake}/:id/edit — Render edit form page (React SSR) */
  @Get('/:id/edit')
  async edit(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const item = await ${singularPascal}.find(req.param('id'));
    if (!item) return res.status(404).html('<h1>${singularPascal} Not Found</h1>');
    return res.view('${pluralSnake}/edit', { item: item.toJSON(), title: \`Edit ${singularPascal} #\${req.param('id')}\` });
  }

  /** POST /${pluralSnake} — Store new item */
  @Post('/')
  async store(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const body = await req.body<{ title?: string; content?: string }>();
    if (body && body.title && body.title.trim()) {
      await ${singularPascal}.create({
        title: body.title.trim(),
        content: (body.content || '').trim(),
        created_at: now().toDateTimeString(),
      });
    }
    return res.redirect('/${pluralSnake}');
  }

  /** POST /${pluralSnake}/:id/update — Update item */
  @Post('/:id/update')
  async updateForm(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const id = req.param('id');
    const item = await ${singularPascal}.find(id);
    if (item) {
      const body = await req.body<{ title?: string; content?: string }>();
      item.fill({
        title: (body.title || '').trim(),
        content: (body.content || '').trim(),
      });
      await item.save();
    }
    return res.redirect(\`/${pluralSnake}/\${id}\`);
  }

  /** POST /${pluralSnake}/:id/delete — Delete item */
  @Post('/:id/delete')
  async destroyForm(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const id = req.param('id');
    const item = await ${singularPascal}.find(id);
    if (item) {
      await item.delete();
    }
    return res.redirect('/${pluralSnake}');
  }
}
`;
        createFileSafe(controllerPath, controllerTemplate, 'Controller');

        // 4. React Pages: index.tsx, create.tsx, edit.tsx, show.tsx
        const indexPagePath = join(pageDir, 'index.tsx');
        const indexPageTemplate = `import React from 'react';

export interface ${singularPascal}Item {
  id: number;
  title: string;
  content?: string;
  created_at?: string;
}

export interface ${singularPascal}IndexProps {
  items?: ${singularPascal}Item[];
  csrf_token?: string;
}

export default function ${singularPascal}Index({ items = [], csrf_token = '' }: ${singularPascal}IndexProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', color: '#f8fafc', backgroundColor: '#090d16', padding: '2rem', borderRadius: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>⚡ ${pluralPascal}</h2>
        <a href="/${pluralSnake}/create" style={{ background: '#6366f1', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>+ New ${singularPascal}</a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No ${pluralSnake} found. Create your first ${singularPascal.toLowerCase()} above!</p>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <a href={\`/${pluralSnake}/\${item.id}\`} style={{ color: '#818cf8', fontWeight: 600, fontSize: '1.1rem', textDecoration: 'none' }}>{item.title}</a>
                {item.content && <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>{item.content}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href={\`/${pluralSnake}/\${item.id}/edit\`} style={{ color: '#cbd5e1', fontSize: '0.85rem', textDecoration: 'none' }}>Edit</a>
                <form action={\`/${pluralSnake}/\${item.id}/delete\`} method="POST" style={{ display: 'inline' }}>
                  {csrf_token && <input type="hidden" name="_token" value={csrf_token} />}
                  <button type="submit" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}>Delete</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
`;
        createFileSafe(indexPagePath, indexPageTemplate, 'React Index Page');

        const createPagePath = join(pageDir, 'create.tsx');
        const createPageTemplate = `import React from 'react';

export interface ${singularPascal}CreateProps {
  csrf_token?: string;
}

export default function ${singularPascal}Create({ csrf_token = '' }: ${singularPascal}CreateProps) {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', color: '#f8fafc', backgroundColor: '#090d16', padding: '2rem', borderRadius: '1rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Create ${singularPascal}</h2>
      <form action="/${pluralSnake}" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {csrf_token && <input type="hidden" name="_token" value={csrf_token} />}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Title</label>
          <input type="text" name="title" required placeholder="Enter ${singularPascal.toLowerCase()} title..." style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#fff' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Content</label>
          <textarea name="content" rows={4} placeholder="Enter ${singularPascal.toLowerCase()} content..." style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="submit" style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>Save ${singularPascal}</button>
          <a href="/${pluralSnake}" style={{ color: '#94a3b8', textDecoration: 'none', padding: '0.75rem 1rem' }}>Cancel</a>
        </div>
      </form>
    </div>
  );
}
`;
        createFileSafe(createPagePath, createPageTemplate, 'React Create Page');

        const editPagePath = join(pageDir, 'edit.tsx');
        const editPageTemplate = `import React from 'react';

export interface ${singularPascal}EditProps {
  item: { id: number; title: string; content?: string };
  csrf_token?: string;
}

export default function ${singularPascal}Edit({ item, csrf_token = '' }: ${singularPascal}EditProps) {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', color: '#f8fafc', backgroundColor: '#090d16', padding: '2rem', borderRadius: '1rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Edit ${singularPascal} #{item?.id}</h2>
      <form action={\`/${pluralSnake}/\${item?.id}/update\`} method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {csrf_token && <input type="hidden" name="_token" value={csrf_token} />}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Title</label>
          <input type="text" name="title" defaultValue={item?.title} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#fff' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Content</label>
          <textarea name="content" rows={4} defaultValue={item?.content} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="submit" style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>Update ${singularPascal}</button>
          <a href={\`/${pluralSnake}/\${item?.id}\`} style={{ color: '#94a3b8', textDecoration: 'none', padding: '0.75rem 1rem' }}>Cancel</a>
        </div>
      </form>
    </div>
  );
}
`;
        createFileSafe(editPagePath, editPageTemplate, 'React Edit Page');

        const showPagePath = join(pageDir, 'show.tsx');
        const showPageTemplate = `import React from 'react';

export interface ${singularPascal}ShowProps {
  item: { id: number; title: string; content?: string; created_at?: string };
  csrf_token?: string;
}

export default function ${singularPascal}Show({ item, csrf_token = '' }: ${singularPascal}ShowProps) {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', color: '#f8fafc', backgroundColor: '#090d16', padding: '2rem', borderRadius: '1rem' }}>
      <h2 style={{ color: '#818cf8', marginBottom: '0.5rem' }}>{item?.title}</h2>
      {item?.created_at && <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Created: {item.created_at}</p>}
      <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', minHeight: '100px' }}>
        <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>{item?.content || 'No content provided.'}</p>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <a href={\`/${pluralSnake}/\${item?.id}/edit\`} style={{ background: '#6366f1', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>Edit ${singularPascal}</a>
        <a href="/${pluralSnake}" style={{ color: '#94a3b8', padding: '0.5rem 1rem', textDecoration: 'none' }}>Back to ${pluralPascal}</a>
      </div>
    </div>
  );
}
`;
        createFileSafe(showPagePath, showPageTemplate, 'React Show Page');

        // 5. Append route to routes/web.ts
        registerWebRouteController(controllerName);
      } else {
        const singlePagePath = join(pageDir, 'index.tsx');
        const singlePageTemplate = `import React from 'react';

export default function ${singularPascal}Page() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#f8fafc' }}>
      <h1>${pluralPascal} Page</h1>
    </div>
  );
}
`;
        createFileSafe(singlePagePath, singlePageTemplate, 'React Page');
      }
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

    case 'cache:clear':
    case 'clear:cache': {
      const cacheDir = join(ROOT_DIR, 'storage', 'framework', 'cache');
      if (existsSync(cacheDir)) {
        const files = readdirSync(cacheDir);
        for (const file of files) {
          try {
            const filePath = join(cacheDir, file);
            if (existsSync(filePath)) {
              unlinkSync(filePath);
            }
          } catch {}
        }
      }
      console.log('✅ [ForgeTS CLI] Application cache cleared successfully.');
      break;
    }

    case 'config:clear':
    case 'config:cache': {
      const configCache = join(ROOT_DIR, 'storage', 'framework', 'config.json');
      if (existsSync(configCache)) {
        unlinkSync(configCache);
      }
      console.log('✅ [ForgeTS CLI] Configuration cache cleared successfully.');
      break;
    }

    case 'optimize:clear': {
      const frameworkDir = join(ROOT_DIR, 'storage', 'framework');
      if (existsSync(frameworkDir)) {
        try {
          rmSync(frameworkDir, { recursive: true, force: true });
        } catch {}
      }
      console.log('✅ [ForgeTS CLI] All caches (config, routes, views) cleared successfully.');
      break;
    }

    default: {
      console.log(`
⚡ ForgeTS CLI Scaffolding Tool v0.1.0

Available Commands:
  forge serve                            Start dev server with Bun hot reload
  forge make:controller <ControllerName> Scaffold an HTTP controller
  forge make:model <ModelName>           Scaffold an Active Record model [--migration]
  forge make:page <PageName> [--crud]    Scaffold React page(s) + full CRUD flow
  forge make:service <ServiceName>       Scaffold an @Injectable() business service
  forge make:middleware <Name>           Scaffold an HTTP middleware
  forge make:migration <name>            Scaffold a database migration file
  forge routes:list                      Display all registered routes
  forge cache:clear                      Clear application cache
  forge config:clear                     Clear configuration cache
  forge optimize:clear                   Clear all cached files (config, routes, views)
`);
      break;
    }
  }
}

runCommand().catch((err) => {
  console.error('❌ [ForgeTS CLI] Error:', err);
  process.exit(1);
});
