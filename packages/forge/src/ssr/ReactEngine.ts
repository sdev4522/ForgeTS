// packages/forge/src/ssr/ReactEngine.ts
// ─────────────────────────────────────────────────────────────────────
// React Server-Side Rendering Engine.
// Handles both Vite dev middleware mode and production bundle rendering.
// ─────────────────────────────────────────────────────────────────────

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeHtml } from '../http/Response.js';
import { getViteDevServer } from './ViteDevServer.js';
import { serializeViewData } from '../http/serializer.js';
import { ViewNotFoundException } from '../errors/index.js';

export class ReactEngine {
  private rootDir: string;
  private pagesDir: string;
  private appHtmlPath: string;
  private clientManifest: Record<string, any> | null = null;
  private ssrModule: any = null;
  private appHtmlCache: string | null = null;
  private pagePathCache: Map<string, string | null> = new Map();

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.pagesDir = join(rootDir, 'resources', 'js', 'pages');
    this.appHtmlPath = join(rootDir, 'resources', 'views', 'app.html');
  }

  /**
   * Check if a React page component exists for the given name.
   */
  hasPage(name: string): boolean {
    return this.resolvePagePath(name) !== null;
  }

  /**
   * Resolve page file path.
   */
  resolvePagePath(name: string): string | null {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && this.pagePathCache.has(name)) {
      return this.pagePathCache.get(name) ?? null;
    }
    const found = this.findPagePath(name);
    if (isProduction) this.pagePathCache.set(name, found);
    return found;
  }

  private findPagePath(name: string): string | null {
    const pagesRoot = resolve(this.pagesDir);
    const cleanName = name.replace(/^pages\//, '');
    const candidates = [
      join(this.pagesDir, `${cleanName}.tsx`),
      join(this.pagesDir, `${cleanName}.jsx`),
      join(this.pagesDir, cleanName, 'index.tsx'),
      join(this.pagesDir, cleanName, 'index.jsx'),
      join(this.pagesDir, `${name}.tsx`),
      join(this.pagesDir, `${name}.jsx`),
    ];

    for (const path of candidates) {
      const resolved = resolve(path);
      // Page names must never escape resources/js/pages
      if (!resolved.startsWith(pagesRoot + sep)) continue;
      if (existsSync(resolved)) {
        return resolved;
      }
    }
    return null;
  }

  /**
   * Load production client manifest.
   */
  private getClientManifest(): Record<string, any> {
    if (this.clientManifest) return this.clientManifest;

    const manifestPaths = [
      join(this.rootDir, 'dist', 'client', '.vite', 'manifest.json'),
      join(this.rootDir, 'dist', 'client', 'manifest.json'),
    ];

    for (const p of manifestPaths) {
      if (existsSync(p)) {
        try {
          this.clientManifest = JSON.parse(readFileSync(p, 'utf-8'));
          return this.clientManifest!;
        } catch {
          // ignore
        }
      }
    }
    return {};
  }

  /**
   * Load the HTML shell (resources/views/app.html). Cached in production.
   */
  private loadAppHtml(): string | null {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && this.appHtmlCache !== null) return this.appHtmlCache;
    if (!existsSync(this.appHtmlPath)) return null;
    const html = readFileSync(this.appHtmlPath, 'utf-8');
    if (isProduction) this.appHtmlCache = html;
    return html;
  }

  /**
   * Render a React page component to an HTML document string with SSR markup.
   *
   * Architectural Design:
   * 1. Development Mode: Executes via ViteDevServer's ssrLoadModule, supporting instant
   *    Hot Module Replacement (HMR) and fast component compilation on the fly.
   * 2. Production Mode: Executes via precompiled dist/server/entry-server.js bundle,
   *    consults dist/client/manifest.json for hashed asset URLs, and emits targeted
   *    `<link rel="modulepreload">` tags for page-specific code chunks.
   * 3. Hydration Handshake: Serializes page name and props into an escaped JSON payload
   *    inside `<script id="__FORGETS_DATA__">` to ensure deterministic client hydration.
   */
  async renderPage(name: string, props: Record<string, any> = {}): Promise<string> {
    const safeProps = serializeViewData(props);
    let bodyHtml = '';
    let clientScriptSrc = '/resources/js/entry-client.tsx';
    let preloadTag = '';

    if (process.env.NODE_ENV === 'production') {
      // Load compiled SSR entry module from dist/server/entry-server.js
      if (!this.ssrModule) {
        const ssrPath = join(this.rootDir, 'dist', 'server', 'entry-server.js');
        if (existsSync(ssrPath)) {
          this.ssrModule = await import(pathToFileURL(ssrPath).href);
        }
      }

      if (this.ssrModule && typeof this.ssrModule.render === 'function') {
        bodyHtml = await this.ssrModule.render(name, safeProps);
      } else {
        const pagePath = this.resolvePagePath(name);
        if (!pagePath) throw new ViewNotFoundException(name, this.pagesDir);
        const mod = await import(pathToFileURL(pagePath).href);
        const PageComponent = mod.default || mod[Object.keys(mod)[0]];
        bodyHtml = ReactDOMServer.renderToString(React.createElement(PageComponent, safeProps));
      }

      // Resolve hashed client asset filename from production manifest
      const manifest = this.getClientManifest();
      const entryKey = 'resources/js/entry-client.tsx';
      if (manifest[entryKey] && manifest[entryKey].file) {
        clientScriptSrc = `/${manifest[entryKey].file}`;
      }

      // Preload targeted page chunk only
      const pageKeys = [
        `resources/js/pages/${name}.tsx`,
        `resources/js/pages/${name}/index.tsx`,
      ];
      for (const pKey of pageKeys) {
        if (manifest[pKey] && manifest[pKey].file) {
          preloadTag = `<link rel="modulepreload" href="/${manifest[pKey].file}">`;
          break;
        }
      }
    } else {
      // Dev mode: use Vite ssrLoadModule
      const pagePath = this.resolvePagePath(name);
      if (!pagePath) {
        throw new ViewNotFoundException(name, this.pagesDir);
      }

      let PageComponent: React.ComponentType<any>;
      const vite = await getViteDevServer();
      try {
        if (vite) {
          const relPath = pagePath.startsWith(this.rootDir) ? pagePath.slice(this.rootDir.length) : pagePath;
          const mod = await vite.ssrLoadModule(relPath);
          PageComponent = mod.default || mod[Object.keys(mod)[0]];
        } else {
          const mod = await import(pathToFileURL(pagePath).href);
          PageComponent = mod.default || mod[Object.keys(mod)[0]];
        }

        if (!PageComponent) {
          throw new Error(`[ForgeTS React SSR] Page '${name}' has no default export.`);
        }

        bodyHtml = ReactDOMServer.renderToString(React.createElement(PageComponent, safeProps));
      } catch (err) {
        // Map Vite-transformed stack frames back to original source lines
        if (vite && err instanceof Error) {
          try {
            vite.ssrFixStacktrace(err);
          } catch {}
        }
        throw err;
      }
    }

    const title = escapeHtml(safeProps.title || 'ForgeTS — React SSR');
    const cleanPageName = name.replace(/^pages\//, '');
    const initialPayload = {
      page: cleanPageName,
      props: safeProps,
    };
    const jsonPayload = JSON.stringify(initialPayload)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

    const vitePreamble = process.env.NODE_ENV !== 'production'
      ? `<script type="module">
  import RefreshRuntime from "/@react-refresh"
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>`
      : '';

    const shell = this.loadAppHtml();
    if (shell !== null) {
      // Structural edits run first, on the pristine shell. Content is inserted last
      // and through replacer functions, so `$&`-style sequences in rendered markup
      // or props are never interpreted as replacement patterns.
      let template = shell;
      if (preloadTag) {
        template = template.replace('</head>', () => `${preloadTag}\n</head>`);
      }
      if (vitePreamble) {
        template = template.replace(
          '<script type="module" src="/resources/js/entry-client.tsx"></script>',
          () => `${vitePreamble}\n  <script type="module" src="${clientScriptSrc}"></script>`,
        );
      } else {
        template = template.replace('/resources/js/entry-client.tsx', () => clientScriptSrc);
      }
      const slots: Record<string, string> = {
        '<!-- FORGETS_TITLE -->': title,
        '<!-- FORGETS_APP -->': bodyHtml,
        '<!-- FORGETS_DATA -->': jsonPayload,
      };
      return template.replace(
        /<!-- FORGETS_(?:TITLE|APP|DATA) -->/g,
        (marker) => slots[marker] ?? marker,
      );
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${preloadTag}
</head>
<body>
  <div id="root">${bodyHtml}</div>
  <script type="application/json" id="__FORGETS_DATA__">${jsonPayload}</script>
  ${vitePreamble ? `${vitePreamble}\n  ` : ''}<script type="module" src="${clientScriptSrc}"></script>
</body>
</html>`;
  }
}
