// tests/unit/AuditRegression.test.ts
// ─────────────────────────────────────────────────────────────────────
// Regression suite for the security / logic defects fixed during the
// Node.js migration audit. Each test pins one previously broken behaviour.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect, beforeAll, afterAll } from '../harness.js';
import {
  Application,
  Router,
  CsrfMiddleware,
  Validator,
  ForgeResponse,
  Redactor,
  ErrorNormalizer,
  HtmlErrorRenderer,
  SourceFrameReader,
  Hash,
  Get,
  parseEnv,
  serializeViewData,
  today,
  createRateLimitMiddleware,
  RateLimiter,
  type Request,
} from '@forge/core';
import { Model, QueryBuilder, setMongoDriver, MongoDriver } from '@forge/database';
import { ROUTES_META } from '../../packages/forge/src/routing/decorators.js';

const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

describe('Audit regressions', () => {
  let app: Application;
  let handlerHits = 0;
  const originalDebug = process.env.APP_DEBUG;
  const originalNodeEnv = process.env.NODE_ENV;

  const call = (path: string, init: RequestInit = {}, remoteAddress = '10.0.0.1') =>
    app.handle(new globalThis.Request(`http://app.test${path}`, init), { remoteAddress });

  beforeAll(() => {
    process.env.APP_DEBUG = 'false';
    process.env.NODE_ENV = 'production';

    app = new Application(process.cwd());
    app.configure('app', { debug: false, timezone: 'UTC', trustProxy: false });

    const web = new Router();
    web.middleware(CsrfMiddleware);
    web.get('/form', (_req: Request, res: ForgeResponse) => res.json({ ok: true }));
    web.post('/transfer', (_req: Request, res: ForgeResponse) => {
      handlerHits++;
      return res.json({ ok: true });
    });
    web.post('/zod', async (req: Request, res: ForgeResponse) => {
      const schema: any = {
        safeParse: () => ({
          success: false,
          error: { issues: [{ path: ['email'], message: 'Invalid email' }] },
        }),
      };
      await req.validate(schema);
      return res.json({});
    });
    web.get('/users/:id', (req: Request, res: ForgeResponse) => res.json(req.params));
    web.get('/users/:userId/posts', (req: Request, res: ForgeResponse) => res.json(req.params));
    web.get('/files/*path', (req: Request, res: ForgeResponse) => res.json(req.params));
    web.get('/query', (req: Request, res: ForgeResponse) =>
      res.json({
        plainPrototype: Object.getPrototypeOf(req.query) === null,
        keys: Object.keys(req.query),
      }),
    );
    web.get('/ip', (req: Request, res: ForgeResponse) => res.json({ ip: req.ip() }));
    web.get('/limited', (_req: Request, res: ForgeResponse) => res.json({ ok: true }), [
      createRateLimitMiddleware(2, 60),
    ]);
    web.get('/native', () => {
      const headers = new Headers();
      headers.append('Set-Cookie', 'a=1');
      headers.append('Set-Cookie', 'b=2');
      return new globalThis.Response('ok', { headers });
    });
    app.registerRoutes(web, { type: 'web' });

    const api = new Router();
    api.middleware(CsrfMiddleware);
    api.post('/ping', (_req: Request, res: ForgeResponse) => res.json({ pong: true }));
    app.registerRoutes(api, { prefix: '/api', type: 'api' });
  });

  afterAll(() => {
    process.env.APP_DEBUG = originalDebug;
    process.env.NODE_ENV = originalNodeEnv;
    RateLimiter.clear();
  });

  // ─── Validation ───

  test('max: rejects long strings and accepts short ones', () => {
    expect(() => Validator.validate({ n: 'x'.repeat(500) }, { n: 'max:10' })).toThrow();
    expect(Validator.validate({ n: 'abc' }, { n: 'max:10' })).toEqual({ n: 'abc' });
  });

  test('numeric fields compare min/max by value, even as form strings', () => {
    expect(() => Validator.validate({ age: '5' }, { age: 'numeric|min:18' })).toThrow();
    expect(Validator.validate({ age: '21' }, { age: 'numeric|min:18' })).toEqual({ age: '21' });
    expect(() => Validator.validate({ age: '200' }, { age: 'numeric|max:120' })).toThrow();
  });

  test('Zod validation failures return 422 with an errors bag, not 500', async () => {
    const page = await call('/form');
    const token = /forge_session=([a-f0-9]+)/.exec(page.headers.get('set-cookie') ?? '')![1];
    const res = await call('/zod', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        cookie: `forge_session=${token}`,
        'x-csrf-token': token,
      },
      body: '{}',
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors).toEqual({ email: ['Invalid email'] });
  });

  // ─── CSRF ───

  test('CSRF: a state-changing request WITHOUT the cookie is rejected', async () => {
    handlerHits = 0;
    const res = await call('/transfer', {
      method: 'POST',
      headers: { accept: BROWSER_ACCEPT, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'amount=1',
    });
    expect(res.status).toBe(419);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(handlerHits).toBe(0);
  });

  test('CSRF: an attacker-chosen cookie + matching token pair is not accepted unless well-formed', async () => {
    const res = await call('/transfer', {
      method: 'POST',
      headers: { cookie: 'forge_session=abc', 'x-csrf-token': 'abc', accept: 'application/json' },
    });
    expect(res.status).toBe(419);
  });

  test('CSRF: the query string is not a token source; header/body token passes', async () => {
    const page = await call('/form');
    const token = /forge_session=([a-f0-9]+)/.exec(page.headers.get('set-cookie') ?? '')![1];

    const viaQuery = await call(`/transfer?_token=${token}`, {
      method: 'POST',
      headers: { cookie: `forge_session=${token}` },
    });
    expect(viaQuery.status).toBe(419);

    const viaBody = await call('/transfer', {
      method: 'POST',
      headers: { cookie: `forge_session=${token}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: `_token=${token}`,
    });
    expect(viaBody.status).toBe(200);
  });

  test('CSRF: routes registered as type "api" are exempt', async () => {
    const res = await call('/api/ping', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  test('a malformed cookie does not crash the request', async () => {
    const res = await call('/form', { headers: { cookie: 'theme=%E0%A4%A' } });
    expect(res.status).toBe(200);
  });

  // ─── Routing ───

  test('sibling routes keep their own parameter names', async () => {
    expect(await (await call('/users/7')).json()).toEqual({ id: '7' });
    expect(await (await call('/users/7/posts')).json()).toEqual({ userId: '7' });
  });

  test('route parameters are URL-decoded', async () => {
    expect(await (await call('/users/John%20Doe')).json()).toEqual({ id: 'John Doe' });
    expect(await (await call('/files/a%20b/c.txt')).json()).toEqual({ path: 'a b/c.txt' });
  });

  test('wrong method on an existing path returns 405 with an Allow header', async () => {
    const res = await call('/form', { method: 'DELETE', headers: { accept: 'application/json' } });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('GET');
  });

  test('query keys like __proto__ and toString are plain data', async () => {
    const body = await (await call('/query?__proto__=x&toString=1')).json();
    expect(body.plainPrototype).toBe(true);
    expect(body.keys).toEqual(['__proto__', 'toString']);
  });

  test('a subclass controller does not add routes to its parent', () => {
    // Mirrors the TC39 rule: a subclass metadata object inherits from its parent's
    const parentMeta: any = {};
    Get('/a')(() => {}, { metadata: parentMeta, name: 'a' } as any);
    const childMeta: any = Object.create(parentMeta);
    Get('/b')(() => {}, { metadata: childMeta, name: 'b' } as any);

    expect(parentMeta[ROUTES_META].map((r: any) => r.path)).toEqual(['/a']);
    expect(childMeta[ROUTES_META].map((r: any) => r.path)).toEqual(['/a', '/b']);
  });

  // ─── Client IP / rate limiting ───

  test('X-Forwarded-For is ignored unless the app trusts its proxy', async () => {
    const res = await call('/ip', { headers: { 'x-forwarded-for': '1.2.3.4' } }, '10.9.8.7');
    expect((await res.json()).ip).toBe('10.9.8.7');
  });

  test('rate limiting cannot be bypassed by rotating X-Forwarded-For', async () => {
    RateLimiter.clear();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await call('/limited', { headers: { 'x-forwarded-for': `9.9.9.${i}` } }, '10.1.1.1');
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 429, 429]);
    // A different client has its own bucket
    expect((await call('/limited', {}, '10.2.2.2')).status).toBe(200);
  });

  // ─── Responses ───

  test('meta() escapes values and ignores $-replacement patterns', () => {
    const res: any = new ForgeResponse()
      .html('<head><title>x</title></head>')
      .meta({ title: 'Price $& </title><script>alert(1)</script>' });
    expect(res._body).toBe(
      '<head><title>Price $&amp; &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title></head>',
    );
  });

  test('native Response passthrough keeps every Set-Cookie header', async () => {
    const res = await call('/native');
    expect(res.headers.getSetCookie().slice(0, 2)).toEqual(['a=1', 'b=2']);
  });

  test('serializeViewData survives circular references', () => {
    const a: any = { name: 'a' };
    a.self = a;
    expect(serializeViewData(a)).toEqual({ name: 'a', self: '[Circular]' });
  });

  // ─── Models ───

  test('fillable models do not accept the primary key from input', () => {
    class Account extends Model {
      static override fillable = ['name'];
    }
    const account: any = new Account({ id: 999, _id: 'x', name: 'n' });
    expect(account._attributes).toEqual({ name: 'n' });
  });

  test('default guard blocks the primary key and _id', () => {
    class Note extends Model {}
    const note: any = new Note({ id: 5, _id: 'x', title: 't' });
    expect(note._attributes).toEqual({ title: 't' });
  });

  test('hidden attributes are omitted from toJSON but still persisted', () => {
    class Member extends Model {
      static override fillable = ['name', 'password'];
      static override hidden = ['password'];
    }
    const member = new Member({ name: 'n', password: 'hash' });
    expect(member.toJSON()).toEqual({ name: 'n' });
    expect(member.getAttributes()).toEqual({ name: 'n', password: 'hash' });
  });

  test('loaded relations are serialized but never treated as columns', () => {
    class Author extends Model {
      static override fillable = ['name'];
    }
    const author: any = new Author({ name: 'n' });
    author.setRelation('posts', [{ title: 'p' }]);
    expect(author.posts).toEqual([{ title: 'p' }]);
    expect(author.toJSON()).toEqual({ name: 'n', posts: [{ title: 'p' }] });
    expect(author.getAttributes()).toEqual({ name: 'n' });
  });

  test('hydrated rows are marked as existing; new instances are not', () => {
    class Item extends Model {}
    expect((Item.hydrate({ id: 1 }) as any)._exists).toBe(true);
    expect((new Item({ title: 't' }) as any)._exists).toBe(false);
  });

  test('table names are snake_cased and pluralized', () => {
    class UserProfile extends Model {}
    class Category extends Model {}
    expect(UserProfile.getTable()).toBe('user_profiles');
    expect(Category.getTable()).toBe('categories');
  });

  test('MongoDB filters reject operator objects from input', () => {
    class LogEntry extends Model {
      static override connection = 'mongodb';
    }
    setMongoDriver(new MongoDriver({ uri: 'mongodb://127.0.0.1:1', database: 'x' }));
    try {
      expect(() => new QueryBuilder(LogEntry).where('email', { $ne: null })).toThrow(/operator/);
      const qb: any = new QueryBuilder(LogEntry).where('level', 'info').where('n', '>=', 1).where('n', '<', 5);
      expect(qb.mongoWhere).toEqual({ level: 'info', n: { $gte: 1, $lt: 5 } });
    } finally {
      setMongoDriver(null);
    }
  });

  // ─── Error engine ───

  test('redactor leaves non-secret env values alone and hides real secrets', () => {
    const saved = { u: process.env.DB_USERNAME, p: process.env.DB_PASSWORD };
    process.env.DB_USERNAME = 'root';
    process.env.DB_PASSWORD = 'sup3r-s3cret-pw';
    try {
      expect(Redactor.redactString("getElementById('root')")).toBe("getElementById('root')");
      expect(Redactor.redactString('auth failed: sup3r-s3cret-pw')).toBe('auth failed: [REDACTED]');
    } finally {
      if (saved.u === undefined) delete process.env.DB_USERNAME; else process.env.DB_USERNAME = saved.u;
      if (saved.p === undefined) delete process.env.DB_PASSWORD; else process.env.DB_PASSWORD = saved.p;
    }
  });

  test('redactor matches camelCase and compound sensitive keys', () => {
    expect(
      Redactor.sanitizeData({ newPassword: 'a', accessToken: 'b', apiKey: 'c', user_password: 'd', name: 'e' }),
    ).toEqual({
      newPassword: '[REDACTED]',
      accessToken: '[REDACTED]',
      apiKey: '[REDACTED]',
      user_password: '[REDACTED]',
      name: 'e',
    });
  });

  test('source snippets are confined to the project directory', () => {
    expect(SourceFrameReader.getCodeSnippet('/etc/hostname', 1)).toBeNull();
    expect(SourceFrameReader.getCodeSnippet(`${process.cwd()}/.env.example`, 1)).toBeNull();
    expect(SourceFrameReader.getCodeSnippet(import.meta.filename, 1)).not.toBeNull();
  });

  test('a failed third-party HTTP call is not reported as a database outage', () => {
    const apiDown = Object.assign(new Error('connect ECONNREFUSED 93.184.216.34:443'), {
      code: 'ECONNREFUSED',
      port: 443,
    });
    expect(ErrorNormalizer.normalize(apiDown).statusCode).toBe(500);

    const dbDown = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), {
      code: 'ECONNREFUSED',
      port: 3306,
    });
    expect(ErrorNormalizer.normalize(dbDown).statusCode).toBe(503);
  });

  test('non-debug normalization skips stack parsing and source reads', () => {
    const normalized = ErrorNormalizer.normalize(new Error('boom'), { diagnostics: false });
    expect(normalized.stackFrames).toEqual([]);
    expect(normalized.statusCode).toBe(500);
  });

  test('production error pages describe 4xx statuses correctly', () => {
    const html = HtmlErrorRenderer.renderProduction(429);
    expect(html).toContain('Too Many Requests');
    expect(html).not.toContain('Internal Server Error');
    expect(HtmlErrorRenderer.renderProduction(500)).toContain('500 | Internal Server Error');
  });

  // ─── Runtime helpers ───

  test('Hash makes and verifies Argon2id PHC strings, including ones created by Bun', async () => {
    const hashed = await Hash.make('secret123');
    expect(hashed.startsWith('$argon2id$v=19$m=65536,t=3,p=1$')).toBe(true);
    expect(await Hash.verify('secret123', hashed)).toBe(true);
    expect(await Hash.verify('wrong', hashed)).toBe(false);
    expect(Hash.needsRehash(hashed)).toBe(false);

    // Produced by Bun.password.hash('secret123', { algorithm: 'argon2id', timeCost: 3, memoryCost: 65536 })
    const fromBun =
      '$argon2id$v=19$m=65536,t=3,p=1$uLFFu8dtZa159xyANWMkrFfjn3Hs3jCyvay2ukCi00M$G1sVrLRgAk2QEYExQUMlFhIHkS9RX1oxvLzaTdCMN9U';
    expect(await Hash.verify('secret123', fromBun)).toBe(true);

    // Malformed input never throws
    expect(await Hash.verify('x', 'scrypt:salt:abcd')).toBe(false);
    expect(await Hash.verify('x', '$argon2id$garbage')).toBe(false);
  });

  test('parseEnv handles quotes, export prefixes and inline comments', () => {
    expect(
      parseEnv('A=1 # note\nexport B="two words"\nC=\'#notacomment\'\n# skip\nD=a#b\n'),
    ).toEqual({ A: '1', B: 'two words', C: '#notacomment', D: 'a#b' });
  });

  test('today(timezone) is midnight in that timezone, independent of process TZ', () => {
    const tokyo = today('Asia/Tokyo');
    expect(tokyo.toDateTimeString().slice(11)).toBe('00:00:00');
    // Tokyo is UTC+9 with no DST: local midnight is 15:00 UTC the previous day
    expect(tokyo.toISOString().slice(11, 19)).toBe('15:00:00');
  });
});
