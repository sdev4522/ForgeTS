// packages/forge/src/polyfills.ts
// ─────────────────────────────────────────────────────────────────────
// Runtime polyfills. Must be imported BEFORE any decorator or driver code runs.
// ─────────────────────────────────────────────────────────────────────

// Symbol.metadata polyfill for TC39 Stage 3 Decorators
// @ts-ignore — Symbol.metadata may not exist yet in the type system
Symbol.metadata ??= Symbol('Symbol.metadata');

// Node v8 startupSnapshot polyfill for Bun compatibility with bson / mongodb driver
if (typeof process !== 'undefined') {
  try {
    Object.defineProperty(process, 'getBuiltinModule', {
      value: function (name: string) {
        if (name === 'v8') {
          return {
            startupSnapshot: {
              isBuildingSnapshot: () => false,
            },
          };
        }
        return undefined;
      },
      writable: true,
      configurable: true,
    });
  } catch (e) {}
}
