// tests/unit/ViewDataSerialization.test.ts
// ─────────────────────────────────────────────────────────────────────
// Unit tests for HTTP/SSR View Data Serialization and Model Proxy Traps.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Model } from '../../packages/forge/src/database/Model.js';
import { serializeViewData } from '../../packages/forge/src/http/serializer.js';
import { ForgeResponse } from '../../packages/forge/src/http/Response.js';
import { ViewEngine } from '../../packages/forge/src/view/ViewEngine.js';
import { ReactEngine } from '../../packages/forge/src/ssr/ReactEngine.js';

class MockUser extends Model {
  static override table = 'users';
  static override guarded = [];
}

describe('Model Proxy Object Reflection & Traps', () => {
  test('1. Object.keys(model) returns column attributes, never exposing _attributes', () => {
    const user = new MockUser({ id: 1, name: 'Alice', email: 'alice@example.com' });
    const keys = Object.keys(user);

    expect(keys).toContain('id');
    expect(keys).toContain('name');
    expect(keys).toContain('email');
    expect(keys).not.toContain('_attributes');
  });

  test('2. Object spread { ...model } copies attributes directly without _attributes nesting', () => {
    const user = new MockUser({ id: 1, name: 'Alice', email: 'alice@example.com' });
    const spread = { ...user } as any;

    expect(spread.id).toBe(1);
    expect(spread.name).toBe('Alice');
    expect(spread.email).toBe('alice@example.com');
    expect(spread._attributes).toBeUndefined();
  });

  test('3. in operator verifies attribute existence correctly', () => {
    const user = new MockUser({ id: 1, name: 'Alice' });

    expect('name' in user).toBe(true);
    expect('id' in user).toBe(true);
    expect('nonexistent' in user).toBe(false);
  });

  test('4. Object.getOwnPropertyDescriptor returns enumerable descriptor for attributes', () => {
    const user = new MockUser({ id: 42, name: 'Bob' });
    const desc = Object.getOwnPropertyDescriptor(user, 'name');

    expect(desc).toBeDefined();
    expect(desc?.value).toBe('Bob');
    expect(desc?.enumerable).toBe(true);
  });
});

describe('serializeViewData HTTP / SSR Boundary Utility', () => {
  test('1. Serializes single Model instance into plain object with attributes', () => {
    const user = new MockUser({ id: 1, name: 'Alice', email: 'alice@example.com' });
    const serialized = serializeViewData(user);

    expect(serialized).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(serialized instanceof Model).toBe(false);
    expect((serialized as any)._attributes).toBeUndefined();
  });

  test('2. Serializes array of Model instances (User.all() structure)', () => {
    const users = [
      new MockUser({ id: 1, name: 'Alice' }),
      new MockUser({ id: 2, name: 'Bob' }),
    ];
    const serialized = serializeViewData(users);

    expect(Array.isArray(serialized)).toBe(true);
    expect(serialized).toHaveLength(2);
    expect(serialized[0]).toEqual({ id: 1, name: 'Alice' });
    expect(serialized[1]).toEqual({ id: 2, name: 'Bob' });
    expect(serialized[0] instanceof Model).toBe(false);
  });

  test('3. Serializes nested objects and arrays containing Models', () => {
    const user = new MockUser({ id: 10, name: 'Charlie' });
    const payload = {
      userData: [user],
      meta: {
        author: new MockUser({ id: 99, name: 'Author' }),
      },
      count: 1,
      tag: 'test',
    };

    const serialized = serializeViewData(payload);

    expect(serialized.userData[0]).toEqual({ id: 10, name: 'Charlie' });
    expect(serialized.meta.author).toEqual({ id: 99, name: 'Author' });
    expect(serialized.count).toBe(1);
    expect(serialized.tag).toBe('test');
  });

  test('4. Preserves primitives, null, and undefined untouched', () => {
    expect(serializeViewData(null)).toBeNull();
    expect(serializeViewData(undefined)).toBeUndefined();
    expect(serializeViewData('test')).toBe('test');
    expect(serializeViewData(123)).toBe(123);
    expect(serializeViewData(true)).toBe(true);
  });
});

describe('ForgeResponse.view() and ReactEngine Serialization Integration', () => {
  test('1. res.view() serializes array of Models into React page props without _attributes', async () => {
    const reactEngine = new ReactEngine(process.cwd());
    const viewEngine = new ViewEngine(process.cwd());
    const res = new ForgeResponse(viewEngine, reactEngine);

    const users = [
      new MockUser({ id: 1, name: 'Alice', email: 'alice@example.com' }),
      new MockUser({ id: 2, name: 'Bob', email: 'bob@example.com' }),
    ];

    const response = await res.view('user', { userData: users });
    const native = response.toNativeResponse();
    const html = await native.text();

    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('Users Page');
    // Ensure __FORGETS_DATA__ contains serialized JSON props
    expect(html).toContain('__FORGETS_DATA__');
    expect(html).toContain('alice@example.com');
    expect(html).not.toContain('_attributes');
  });

  test('2. res.view() handles direct Model instance as view data root', async () => {
    const reactEngine = new ReactEngine(process.cwd());
    const viewEngine = new ViewEngine(process.cwd());
    const res = new ForgeResponse(viewEngine, reactEngine);

    const user = new MockUser({ id: 42, name: 'RootModel', email: 'root@example.com' });
    const response = await res.view('user', user as any);
    const native = response.toNativeResponse();
    const html = await native.text();

    expect(html).toContain('__FORGETS_DATA__');
    expect(html).not.toContain('_attributes');
  });

  test('3. res.json() and res.view() produce equivalent model serialization', async () => {
    const user = new MockUser({ id: 1, name: 'Alice', email: 'alice@example.com' });

    // res.json()
    const resJson = new ForgeResponse().json(user);
    const jsonBody = JSON.parse(await resJson.toNativeResponse().text());

    // serializeViewData()
    const viewData = serializeViewData(user);

    expect(viewData).toEqual(jsonBody);
  });

  test('4. React SSR renders without React child errors when Model instances are passed', () => {
    function SimpleUserList({ userData = [] }: any) {
      return React.createElement(
        'ul',
        null,
        userData.map((u: any) =>
          React.createElement('li', { key: u.id }, `${u.name} - ${u.email}`)
        )
      );
    }

    const users = [
      new MockUser({ id: 1, name: 'Alice', email: 'alice@test.com' }),
      new MockUser({ id: 2, name: 'Bob', email: 'bob@test.com' }),
    ];

    const safeProps = serializeViewData({ userData: users });
    const html = ReactDOMServer.renderToString(React.createElement(SimpleUserList, safeProps));

    expect(html).toBe('<ul><li>Alice - alice@test.com</li><li>Bob - bob@test.com</li></ul>');
  });
});
