// packages/forge/src/polyfills.ts
// ─────────────────────────────────────────────────────────────────────
// Runtime polyfills. Must be imported BEFORE any decorator code runs.
//
// Symbol.metadata is part of the TC39 Decorators proposal but not yet
// shipped in all runtimes. This polyfill ensures it exists.
// ─────────────────────────────────────────────────────────────────────

// @ts-ignore — Symbol.metadata may not exist yet in the type system
Symbol.metadata ??= Symbol('Symbol.metadata');
