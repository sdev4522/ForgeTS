// packages/forge/src/view/ViewEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Lightweight template engine.
// Reads .html files from resources/views/ and interpolates {{ variables }}.
//
// PERFORMANCE: Templates are cached in memory after first read.
// Only file I/O happens once per template per process lifetime.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ViewNotFoundException } from '../errors/index.js';

export class ViewEngine {
  private viewsDir: string;
  private cache: Map<string, string> = new Map();

  constructor(rootDir: string) {
    this.viewsDir = join(rootDir, 'resources', 'views');
  }

  /**
   * Render a view template with data interpolation.
   *
   * Supports:
   * - `{{ variable }}` — HTML-escaped variable substitution
   * - `{{{ variable }}}` — raw/unescaped variable substitution
   * - `{{@ partial }}` — include another template file
   *
   * @param name Template name (e.g., 'welcome' resolves to resources/views/welcome.html)
   * @param data Key-value pairs to interpolate into the template
   *
   * @example
   * ```ts
   * const html = viewEngine.render('welcome', {
   *   title: 'ForgeTS',
   *   uptime: '5m 30s',
   * });
   * ```
   */
  render(name: string, data: Record<string, unknown> = {}): string {
    let template = this.loadTemplate(name);

    // 1. Process partials: {{@ partialName }}
    template = template.replace(/\{\{@\s*(\w[\w/.-]*)\s*\}\}/g, (_match, partialName: string) => {
      return this.loadTemplate(partialName.trim());
    });

    // 2. Raw/unescaped interpolation: {{{ variable }}}
    template = template.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_match, key: string) => {
      const value = this.resolveValue(key, data);
      return String(value ?? '');
    });

    // 3. Escaped interpolation: {{ variable }}
    template = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
      const value = this.resolveValue(key, data);
      return this.escapeHtml(String(value ?? ''));
    });

    return template;
  }

  /**
   * Load a template file from the views directory.
   * Results are cached in memory — only reads from disk once.
   */
  private loadTemplate(name: string): string {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached) return cached;

    // Try with and without .html extension
    const candidates = [
      join(this.viewsDir, name),
      join(this.viewsDir, `${name}.html`),
    ];

    for (const filePath of candidates) {
      const resolved = resolve(filePath);
      if (existsSync(resolved)) {
        const content = readFileSync(resolved, 'utf-8');
        this.cache.set(name, content);
        return content;
      }
    }

    throw new ViewNotFoundException(name, this.viewsDir);
  }

  /**
   * Resolve a dot-notation key against a data object.
   * 'user.name' → data.user.name
   */
  private resolveValue(key: string, data: Record<string, unknown>): unknown {
    const parts = key.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Escape HTML special characters to prevent XSS.
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Clear the template cache (useful for development hot-reload).
   */
  clearCache(): void {
    this.cache.clear();
  }
}
