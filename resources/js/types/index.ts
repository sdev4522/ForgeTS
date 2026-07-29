// resources/js/types/index.ts
// ─────────────────────────────────────────────────────────────────────
// Shared TypeScript interface definitions for React SSR pages & components.
// ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface PageProps<T = Record<string, unknown>> {
  csrf_token?: string;
  csrf_field?: string;
  auth?: {
    user?: User;
  };
  flash?: Record<string, string>;
  props?: T;
}
