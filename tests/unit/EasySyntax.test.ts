// tests/unit/EasySyntax.test.ts
// ─────────────────────────────────────────────────────────────────────
// The short developer syntax: helpers, return values, input helpers,
// validation rules, resource routes, function middleware, model shortcuts.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect, beforeAll, afterAll } from '../harness.js';
import type { Kysely } from 'kysely';
import {
  Application,
  Router,
  Validator,
  view,
  json,
  created,
  redirect,
  back,
  abort,
  request,
  type MiddlewareHandler,
  type Request,
} from '@forge/core';
import { Model, setDatabaseConnection } from '@forge/database';
import { createTestDatabase } from '../sqlite.js';

class Post extends Model {
  static override fillable = ['title', 'status', 'views'];

  declare id: number;
  declare title: string;
  declare status: string;
  declare views: number;
}

class PostController {
  index() {
    return Post.orderBy('id').get();
  }
  async show(req: Request) {
    return (await Post.find(req.params.id)) ?? abort(404, 'Post not found');
  }
  async store(req: Request) {
    return created(await Post.create(await req.validate({ title: 'required|min:3', status: 'in:draft,live' })));
  }
  async update(req: Request) {
    const post = (await Post.find(req.params.id)) ?? abort(404);
    return post.update(req.only('title', 'status'));
  }
  async destroy(req: Request) {
    await Post.destroy(req.params.id);
    return null;
  }
}

describe('Easy syntax', () => {
  let app: Application;
  let db: Kysely<any>;

  const call = (path: string, init: RequestInit = {}) =>
    app.handle(new globalThis.Request(`http://app.test${path}`, init));
  const send = (method: string, path: string, body: unknown) =>
    call(path, { method, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });

  beforeAll(async () => {
    db = createTestDatabase();
    await db.schema
      .createTable('posts')
      .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
      .addColumn('title', 'varchar(100)')
      .addColumn('status', 'varchar(20)')
      .addColumn('views', 'integer')
      .addColumn('created_at', 'varchar(30)')
      .addColumn('updated_at', 'varchar(30)')
      .execute();
    setDatabaseConnection(db);

    app = new Application(process.cwd());
    app.configure('app', { debug: false, timezone: 'UTC' });

    const tag: MiddlewareHandler = async (_req, next) => (await next()).header('X-Tagged', 'yes');

    const api = new Router();
    api.get('/hello', () => ({ hello: 'world' }));
    api.get('/text', () => 'plain <b>text</b>');
    api.get('/helper-json', () => json({ ok: true }, 202));
    api.get('/go', () => redirect('/hello'));
    api.get('/back', () => back('/fallback'));
    api.get('/who', () => ({ path: request().path, q: request().input('q', 'none') }));
    api.get('/tagged', () => ({ ok: true }), [tag]);
    api.get('/page', () => view('welcome', { version: 'test' }));
    api.post('/input', (req: Request) => ({
      all: req.all(),
      only: req.only('a'),
      except: req.except('a', 'page'),
      nested: req.input('user.name'),
      missing: req.input('nope', 'default'),
      has: [req.has('a'), req.has('zzz')],
      filled: req.filled('empty'),
      flag: req.boolean('flag'),
      page: req.integer('page', 1),
    }));
    api.apiResource('/posts', PostController);
    app.registerRoutes(api, { prefix: '/api', type: 'api' });
  });

  afterAll(async () => {
    setDatabaseConnection(null);
    await db.destroy();
  });

  // ─── Handlers ───

  test('handlers can return objects, strings, helpers and null', async () => {
    expect(await (await call('/api/hello')).json()).toEqual({ hello: 'world' });

    const text = await call('/api/text');
    expect(text.headers.get('content-type')).toContain('text/plain');
    expect(await text.text()).toBe('plain <b>text</b>');

    expect((await call('/api/helper-json')).status).toBe(202);

    const go = await call('/api/go');
    expect([go.status, go.headers.get('location')]).toEqual([302, '/hello']);
  });

  test('request() and view() work without passing req/res', async () => {
    expect(await (await call('/api/who?q=forge')).json()).toEqual({ path: '/api/who', q: 'forge' });

    const page = await call('/api/page');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
  });

  test('helpers that need a request explain themselves outside one', () => {
    expect(() => request()).toThrow(/outside of a request/);
  });

  test('back() only follows same-site referrers', async () => {
    const same = await call('/api/back', { headers: { referer: 'http://app.test/posts?page=2' } });
    expect(same.headers.get('location')).toBe('/posts?page=2');
    const foreign = await call('/api/back', { headers: { referer: 'https://evil.example/phish' } });
    expect(foreign.headers.get('location')).toBe('/fallback');
  });

  test('plain functions work as middleware', async () => {
    expect((await call('/api/tagged')).headers.get('x-tagged')).toBe('yes');
  });

  // ─── Input ───

  test('input helpers read body + query', async () => {
    const res = await send('POST', '/api/input?page=3&a=fromQuery', {
      a: 1,
      b: 2,
      empty: '',
      flag: 'on',
      user: { name: 'Ada' },
    });
    expect(await res.json()).toEqual({
      all: { page: '3', a: 1, b: 2, empty: '', flag: 'on', user: { name: 'Ada' } },
      only: { a: 1 },
      except: { b: 2, empty: '', flag: 'on', user: { name: 'Ada' } },
      nested: 'Ada',
      missing: 'default',
      has: [true, false],
      filled: false,
      flag: true,
      page: 3,
    });
  });

  // ─── Validation ───

  test('new validation rules', () => {
    const ok = Validator.validate(
      {
        role: 'admin', password: 'secret12', password_confirmation: 'secret12', site: 'https://forge.dev',
        qty: '4', slug: 'my-post', tags: ['a'], born: '2000-01-31', code: 'AB12',
      },
      {
        role: 'required|in:admin,editor', password: 'required|min:8|confirmed', site: 'url',
        qty: 'integer|between:1,5', slug: 'regex:/^[a-z0-9-]+$/', tags: ['array', 'max:3'],
        born: 'date', code: 'alpha_num|size:4', nickname: 'nullable|string',
      },
    );
    expect(Object.keys(ok).sort()).toEqual(['born', 'code', 'password', 'qty', 'role', 'site', 'slug', 'tags']);

    const errors = (data: any, rules: any, messages?: any) => {
      try {
        Validator.validate(data, rules, messages);
        return null;
      } catch (e: any) {
        return e.errors;
      }
    };
    expect(errors({ role: 'root' }, { role: 'in:admin,editor' })).toEqual({ role: ['The selected role is invalid.'] });
    expect(errors({ password: 'secret12', password_confirmation: 'nope' }, { password: 'confirmed' }))
      .toEqual({ password: ['The password confirmation does not match.'] });
    expect(errors({ qty: '4.5' }, { qty: 'integer' })).toEqual({ qty: ['The qty must be an integer.'] });
    expect(errors({ site: 'javascript:alert(1)' }, { site: 'url' })).toEqual({ site: ['The site must be a valid URL.'] });
    expect(errors({ a: 'x' }, { a: 'bail|email|min:5' })).toEqual({ a: ['The a must be a valid email address.'] });
  });

  test('custom messages and custom rules', () => {
    Validator.extend('even', ({ field, value }) => (Number(value) % 2 === 0 ? null : `The ${field} must be even.`));
    try {
      Validator.validate({ n: 3 }, { n: 'even', email: 'required' }, { 'email.required': 'We need your email.' });
      throw new Error('should have failed');
    } catch (e: any) {
      expect(e.errors).toEqual({ n: ['The n must be even.'], email: ['We need your email.'] });
    }
  });

  test('a misspelled rule fails loudly instead of being ignored', () => {
    expect(() => Validator.validate({ a: 'x' }, { a: 'requierd|emial' })).toThrow(/Unknown validation rule 'requierd'/);
  });

  // ─── Resource routes + models ───

  test('apiResource wires REST routes to a plain controller class', async () => {
    const made = await send('POST', '/api/posts', { title: 'First post', status: 'draft' });
    expect(made.status).toBe(201);
    const { id } = await made.json();

    expect((await send('POST', '/api/posts', { title: 'x' })).status).toBe(422);
    expect((await (await call(`/api/posts/${id}`)).json()).title).toBe('First post');
    expect((await call('/api/posts/9999', { headers: { accept: 'application/json' } })).status).toBe(404);

    const updated = await send('PATCH', `/api/posts/${id}`, { status: 'live', views: 999 });
    expect((await updated.json()).status).toBe('live');

    expect((await call('/api/posts')).status).toBe(200);
    expect((await call(`/api/posts/${id}`, { method: 'DELETE' })).status).toBe(204);
    expect(await Post.find(id)).toBeNull();

    // create / edit form pages are not part of an API resource
    expect((await call('/api/posts/create', { headers: { accept: 'application/json' } })).status).toBe(404);
  });

  test('model shortcuts', async () => {
    await db.deleteFrom('posts').execute();
    for (let i = 1; i <= 5; i++) {
      await Post.create({ title: `Post ${i}`, status: i % 2 ? 'draft' : 'live', views: i * 10 });
    }

    expect(await Post.count()).toBe(5);
    expect(await Post.where('status', 'live').count()).toBe(2);
    expect(await Post.where('status', 'gone').exists()).toBe(false);
    expect((await Post.findBy('title', 'Post 3'))?.views).toBe(30);
    expect(await Post.whereIn('views', [10, 50]).pluck('title')).toEqual(['Post 1', 'Post 5']);
    expect(await Post.whereIn('views', []).count()).toBe(0);
    expect((await Post.orderBy('views', 'desc').first())?.title).toBe('Post 5');
    expect(await Post.query().whereNotNull('title').whereNull('status').count()).toBe(0);

    const page = await Post.orderBy('id').paginate(2, 2);
    expect(page.data.map((p: any) => p.title)).toEqual(['Post 3', 'Post 4']);
    expect([page.total, page.perPage, page.currentPage, page.lastPage, page.from, page.to]).toEqual([5, 2, 2, 3, 3, 4]);

    expect(await Post.where('status', 'draft').update({ status: 'archived' })).toBe(3);
    expect(await Post.where('status', 'archived').count()).toBe(3);
    expect(await Post.where('status', 'live').delete()).toBe(2);
    expect(await Post.count()).toBe(3);

    await expect(Post.query().delete()).rejects.toThrow(/Refusing to delete every row/);

    const first = await Post.firstOrCreate({ title: 'Unique' }, { status: 'draft' });
    const again = await Post.firstOrCreate({ title: 'Unique' }, { status: 'other' });
    expect(again.id).toBe(first.id);
    expect((again as any).status).toBe('draft');

    const changed = await Post.updateOrCreate({ title: 'Unique' }, { status: 'live' });
    expect([changed.id, (changed as any).status]).toEqual([first.id, 'live']);

    await db.updateTable('posts').set({ views: 77 }).where('id', '=', first.id).execute();
    expect(((await first.refresh()) as any).views).toBe(77);
  });
});
