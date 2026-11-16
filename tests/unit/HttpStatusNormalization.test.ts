import { describe, it, expect } from '../harness.js';
import {
  ForgeResponse,
  isValidHttpStatus,
  normalizeHttpStatus,
} from '../../packages/forge/src/http/Response.js';

describe('HTTP Status Normalization & Contract', () => {
  describe('isValidHttpStatus()', () => {
    it('accepts valid HTTP status codes', () => {
      expect(isValidHttpStatus(101)).toBe(true);
      expect(isValidHttpStatus(200)).toBe(true);
      expect(isValidHttpStatus(201)).toBe(true);
      expect(isValidHttpStatus(204)).toBe(true);
      expect(isValidHttpStatus(301)).toBe(true);
      expect(isValidHttpStatus(302)).toBe(true);
      expect(isValidHttpStatus(400)).toBe(true);
      expect(isValidHttpStatus(404)).toBe(true);
      expect(isValidHttpStatus(422)).toBe(true);
      expect(isValidHttpStatus(500)).toBe(true);
      expect(isValidHttpStatus(503)).toBe(true);
      expect(isValidHttpStatus(599)).toBe(true);
    });

    it('rejects invalid status values (0, negatives, out-of-range, NaN, non-numbers)', () => {
      expect(isValidHttpStatus(0)).toBe(false);
      expect(isValidHttpStatus(-1)).toBe(false);
      expect(isValidHttpStatus(100)).toBe(false);
      expect(isValidHttpStatus(199)).toBe(false);
      expect(isValidHttpStatus(600)).toBe(false);
      expect(isValidHttpStatus(999)).toBe(false);
      expect(isValidHttpStatus(NaN)).toBe(false);
      expect(isValidHttpStatus(Infinity)).toBe(false);
      expect(isValidHttpStatus(undefined)).toBe(false);
      expect(isValidHttpStatus(null)).toBe(false);
      expect(isValidHttpStatus('200')).toBe(false);
      expect(isValidHttpStatus({})).toBe(false);
      expect(isValidHttpStatus([200])).toBe(false);
    });
  });

  describe('normalizeHttpStatus()', () => {
    it('preserves valid statuses unchanged', () => {
      expect(normalizeHttpStatus(200)).toBe(200);
      expect(normalizeHttpStatus(201)).toBe(201);
      expect(normalizeHttpStatus(302)).toBe(302);
      expect(normalizeHttpStatus(404)).toBe(404);
      expect(normalizeHttpStatus(500)).toBe(500);
    });

    it('converts valid string status codes into numbers', () => {
      expect(normalizeHttpStatus('200')).toBe(200);
      expect(normalizeHttpStatus('404')).toBe(404);
      expect(normalizeHttpStatus('500')).toBe(500);
    });

    it('replaces invalid statuses with the provided default', () => {
      expect(normalizeHttpStatus(0, 500)).toBe(500);
      expect(normalizeHttpStatus(NaN, 500)).toBe(500);
      expect(normalizeHttpStatus(null, 500)).toBe(500);
      expect(normalizeHttpStatus(undefined, 500)).toBe(500);
      expect(normalizeHttpStatus(-1, 500)).toBe(500);
      expect(normalizeHttpStatus(600, 500)).toBe(500);
      expect(normalizeHttpStatus('invalid', 500)).toBe(500);
      expect(normalizeHttpStatus({}, 500)).toBe(500);
    });

    it('falls back to 200 if the provided defaultStatus is itself invalid', () => {
      expect(normalizeHttpStatus(0, 0 as any)).toBe(200);
      expect(normalizeHttpStatus(NaN, NaN as any)).toBe(200);
      expect(normalizeHttpStatus(null, -1 as any)).toBe(200);
    });
  });

  describe('ForgeResponse status handling', () => {
    it('normalizes invalid status in res.status() to safe 200', () => {
      const res = new ForgeResponse().status(0 as any);
      const native = res.toNativeResponse();
      expect(native.status).toBe(200);
    });

    it('normalizes NaN status in res.status() to safe 200', () => {
      const res = new ForgeResponse().status(NaN as any);
      const native = res.toNativeResponse();
      expect(native.status).toBe(200);
    });

    it('safely defaults status to 302 when redirect is called with an options object', () => {
      const res = new ForgeResponse().redirect('/about', { user: { name: 'Alice' } } as any);
      const native = res.toNativeResponse();
      expect(native.status).toBe(302);
      expect(native.headers.get('location')).toBe('/about');
    });

    it('safely defaults status to 302 when redirect is called with status 0', () => {
      const res = new ForgeResponse().redirect('/about', 0 as any);
      const native = res.toNativeResponse();
      expect(native.status).toBe(302);
    });

    it('preserves valid redirect status codes (e.g. 301, 307, 308)', () => {
      const res301 = new ForgeResponse().redirect('/about', 301);
      expect(res301.toNativeResponse().status).toBe(301);

      const res307 = new ForgeResponse().redirect('/about', 307);
      expect(res307.toNativeResponse().status).toBe(307);
    });

    it('normalizes status in res.json() when given an invalid status', () => {
      const res = new ForgeResponse().json({ hello: 'world' }, 0 as any);
      const native = res.toNativeResponse();
      expect(native.status).toBe(200);
    });

    it('never throws RangeError when constructing native Response with corrupted internal status', () => {
      const res = new ForgeResponse();
      (res as any)._status = 0;
      expect(() => res.toNativeResponse()).not.toThrow();
      expect(res.toNativeResponse().status).toBe(200);
    });
  });
});
