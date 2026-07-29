// resources/js/lib/utils.ts
// ─────────────────────────────────────────────────────────────────────
// Utility functions for classnames and DOM helpers.
// ─────────────────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
