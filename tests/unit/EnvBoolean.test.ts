// tests/unit/EnvBoolean.test.ts
// ─────────────────────────────────────────────────────────────────────
// Unit tests for hardened env.boolean environment parsing.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { env } from '../../packages/forge/src/config/env.js';

describe('env.boolean — Environment Variable Boolean Parser', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.TEST_BOOL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('parses standard truthy strings to boolean true', () => {
    for (const val of ['true', '1', 'yes', 'on', 'TRUE', 'True', '1', 'YES', 'ON']) {
      process.env.TEST_BOOL = val;
      expect(env.boolean('TEST_BOOL', false)).toBe(true);
    }
  });

  test('parses trimmed truthy strings with whitespace', () => {
    process.env.TEST_BOOL = '  true  ';
    expect(env.boolean('TEST_BOOL', false)).toBe(true);

    process.env.TEST_BOOL = ' 1 ';
    expect(env.boolean('TEST_BOOL', false)).toBe(true);
  });

  test('parses standard falsy strings to boolean false', () => {
    for (const val of ['false', '0', 'no', 'off', 'FALSE', 'False', '0', 'NO', 'OFF']) {
      process.env.TEST_BOOL = val;
      expect(env.boolean('TEST_BOOL', true)).toBe(false);
    }
  });

  test('parses trimmed falsy strings with whitespace', () => {
    process.env.TEST_BOOL = '  false  ';
    expect(env.boolean('TEST_BOOL', true)).toBe(false);

    process.env.TEST_BOOL = ' 0 ';
    expect(env.boolean('TEST_BOOL', true)).toBe(false);
  });

  test('never performs unsafe Boolean("false") coercion', () => {
    process.env.TEST_BOOL = 'false';
    // Unsafe: Boolean("false") === true
    // Safe ForgeTS: env.boolean("TEST_BOOL") === false
    expect(env.boolean('TEST_BOOL', true)).toBe(false);
    expect(env.boolean('TEST_BOOL', false)).toBe(false);
  });

  test('returns defaultValue when variable is undefined / unset', () => {
    delete process.env.TEST_BOOL;
    expect(env.boolean('TEST_BOOL', false)).toBe(false);
    expect(env.boolean('TEST_BOOL', true)).toBe(true);
  });

  test('returns defaultValue when variable is an unrecognized string', () => {
    process.env.TEST_BOOL = 'invalid_bool_value';
    expect(env.boolean('TEST_BOOL', false)).toBe(false);
    expect(env.boolean('TEST_BOOL', true)).toBe(true);
  });
});
