// tests/harness.ts
// ─────────────────────────────────────────────────────────────────────
// Test harness for Node's built-in test runner (node:test).
// Re-exports the runner primitives under the names the suites use,
// plus Jest-compatible `expect` matchers.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import { expect } from 'expect';

expect.extend({
  toBeArray(received: unknown) {
    const pass = Array.isArray(received);
    return {
      pass,
      message: () => `expected ${String(received)} ${pass ? 'not ' : ''}to be an array`,
    };
  },
});

declare module 'expect' {
  interface Matchers<R> {
    toBeArray(): R;
  }
}

const beforeAll = before;
const afterAll = after;

export { describe, test, it, beforeAll, afterAll, beforeEach, afterEach, mock, expect };
