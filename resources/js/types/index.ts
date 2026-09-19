// resources/js/types/index.ts
// ─────────────────────────────────────────────────────────────────────
// Shared TypeScript interface definitions for React SSR pages & components.
// ─────────────────────────────────────────────────────────────────────

export interface PageProps<T = Record<string, unknown>> {
  csrf_token?: string;
  csrf_field?: string;
  auth?: {
    user?: Record<string, unknown>;
  };
  flash?: Record<string, string>;
  props?: T;
}
