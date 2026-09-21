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
  if (value === null || value === undefined) {
    return value as unknown as T;
  }

  // If value provides a custom toJSON method (e.g. Model, ForgeDate), unwrap it first
  if (typeof (value as any).toJSON === 'function') {
    return serializeViewData((value as any).toJSON());
  }

  // Handle arrays recursively
  if (Array.isArray(value)) {
    return value.map((item) => serializeViewData(item)) as unknown as T;
  }

  // Handle objects recursively
  if (typeof value === 'object') {
    // Non-plain objects that shouldn't be traversed
    if (value instanceof RegExp) {
      return value as unknown as T;
    }

    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeViewData(val);
    }
    return result as T;
  }

  return value as unknown as T;
}
