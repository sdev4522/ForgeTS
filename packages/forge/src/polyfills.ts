// packages/forge/src/polyfills.ts
// ─────────────────────────────────────────────────────────────────────
// Runtime polyfills. Must be imported BEFORE any decorator or driver code runs.
// ─────────────────────────────────────────────────────────────────────

// Symbol.metadata polyfill for TC39 Stage 3 Decorators.
// Uses the global symbol registry so it is the SAME symbol the TypeScript
// transpiler's decorator helpers fall back to, regardless of module load order.
// @ts-ignore — Symbol.metadata may not exist yet in the type system
Symbol.metadata ??= Symbol.for('Symbol.metadata');
