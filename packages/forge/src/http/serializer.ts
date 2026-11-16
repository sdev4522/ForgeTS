// packages/forge/src/http/serializer.ts
// ─────────────────────────────────────────────────────────────────────
// View Data Serializer for ForgeTS HTTP / SSR Boundary.
// Recursively unwraps ORM Model instances, collections, and custom objects
// (implementing toJSON) into plain, serializable JavaScript structures.
// ─────────────────────────────────────────────────────────────────────

/**
 * Recursively serialize view data into plain JavaScript objects and primitives.
 *
 * Ensures that:
 * 1. Active Record Model instances are unwrapped via their `toJSON()` method.
 * 2. Arrays of models (e.g. `User.all()`) become plain object arrays.
 * 3. Nested objects/arrays containing models or serializable values are deeply unwrapped.
 * 4. Internal state (`_attributes`, active-record methods) never leaks into React SSR or ViewEngine.
 * 5. SSR props and client hydration payloads remain 100% deterministic and aligned.
 */
export function serializeViewData<T = any>(value: unknown): T {
  return serialize(value, new WeakSet(), 0) as T;
}

const MAX_DEPTH = 100;

function serialize(value: unknown, ancestors: WeakSet<object>, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    // Functions, symbols and bigints cannot cross the JSON hydration boundary
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (typeof value === 'bigint') return value.toString();
    return value;
  }

  // Circular references and runaway nesting would otherwise overflow the stack
  if (ancestors.has(value) || depth > MAX_DEPTH) {
    return '[Circular]';
  }
  ancestors.add(value);

  try {
    // If value provides a custom toJSON method (e.g. Model, ForgeDate, Date), unwrap it first
    if (typeof (value as any).toJSON === 'function') {
      const unwrapped = (value as any).toJSON();
      return unwrapped === value ? '[Circular]' : serialize(unwrapped, ancestors, depth + 1);
    }

    if (Array.isArray(value)) {
      return value.map((item) => serialize(item, ancestors, depth + 1));
    }

    if (value instanceof RegExp) {
      return value;
    }
    if (value instanceof Map) {
      return serialize(Object.fromEntries(value), ancestors, depth + 1);
    }
    if (value instanceof Set) {
      return serialize([...value], ancestors, depth + 1);
    }

    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serialize(val, ancestors, depth + 1);
    }
    return result;
  } finally {
    // Only true cycles are flagged; the same object may appear in sibling branches
    ancestors.delete(value);
  }
}
