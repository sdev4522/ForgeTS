// packages/forge/src/view/ViewEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Lightweight template engine.
// Reads .html files from resources/views/ and interpolates {{ variables }}.
//
// PERFORMANCE: Templates are cached in memory after first read.
// Only file I/O happens once per template per process lifetime.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { escapeHtml } from '../http/Response.js';
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
    // 1. Process partials: {{@ partialName }} (nested partials supported, depth-limited)
    const template = this.expandPartials(this.loadTemplate(name), 0);

    // 2. Interpolate in a SINGLE pass, so substituted values are never re-scanned
    //    for template syntax:
    //      {{{ variable }}} — raw/unescaped
    //      {{ variable }}   — HTML-escaped
    return template.replace(
      /\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g,
      (_match, rawKey: string | undefined, escapedKey: string | undefined) => {
        if (rawKey !== undefined) {
          return String(this.resolveValue(rawKey, data) ?? '');
        }
        return this.escapeHtml(String(this.resolveValue(escapedKey as string, data) ?? ''));
      },
    );
  }

  private expandPartials(template: string, depth: number): string {
    if (depth > 10) {
      throw new Error('[ForgeTS] View partials are nested too deeply (possible circular include).');
    }
    return template.replace(/\{\{@\s*(\w[\w/.-]*)\s*\}\}/g, (_match, partialName: string) => {
      return this.expandPartials(this.loadTemplate(partialName.trim()), depth + 1);
    });
  }

  /**
   * Load a template file from the views directory.
   * Results are cached in memory — only reads from disk once.
   */
  private loadTemplate(name: string): string {
    // Templates are cached in production only, so edits show up immediately in development
    const useCache = process.env.NODE_ENV === 'production';
    if (useCache) {
      const cached = this.cache.get(name);
      if (cached !== undefined) return cached;
    }

    const viewsRoot = resolve(this.viewsDir);

    // Try with and without .html extension
    const candidates = [
      join(this.viewsDir, name),
      join(this.viewsDir, `${name}.html`),
    ];

    for (const filePath of candidates) {
      const resolved = resolve(filePath);
      // Template names must never escape resources/views (e.g. '../../.env')
      if (!resolved.startsWith(viewsRoot + sep)) continue;
      if (existsSync(resolved) && statSync(resolved).isFile()) {
        const content = readFileSync(resolved, 'utf-8');
        if (useCache) this.cache.set(name, content);
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
      // Own properties only: templates cannot reach `constructor`, `__proto__`, etc.
      if (!Object.hasOwn(current, part)) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Escape HTML special characters to prevent XSS.
   */
  private escapeHtml(str: string): string {
    return escapeHtml(str);
  }

  /**
   * Clear the template cache (useful for development hot-reload).
   */
  clearCache(): void {
    this.cache.clear();
  }
}
