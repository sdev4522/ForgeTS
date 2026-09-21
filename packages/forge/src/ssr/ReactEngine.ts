// packages/forge/src/ssr/ReactEngine.ts
// ─────────────────────────────────────────────────────────────────────
// React Server-Side Rendering Engine.
// Handles both Vite dev middleware mode and production bundle rendering.
// ─────────────────────────────────────────────────────────────────────

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getViteDevServer } from './ViteDevServer.js';
import { serializeViewData } from '../http/serializer.js';
import { ViewNotFoundException } from '../errors/index.js';

export class ReactEngine {
  private rootDir: string;
  private pagesDir: string;
  private appHtmlPath: string;
  private clientManifest: Record<string, any> | null = null;
  private ssrModule: any = null;

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
          this.ssrModule = await import(ssrPath);
        }
      }

      if (this.ssrModule && typeof this.ssrModule.render === 'function') {
        bodyHtml = await this.ssrModule.render(name, safeProps);
      } else {
        const pagePath = this.resolvePagePath(name);
        if (!pagePath) throw new ViewNotFoundException(name, this.pagesDir);
        const mod = await import(pagePath);
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
      if (vite) {
        const relPath = pagePath.replace(this.rootDir, '');
        const mod = await vite.ssrLoadModule(relPath);
        PageComponent = mod.default || mod[Object.keys(mod)[0]];
      } else {
        const mod = await import(pagePath);
        PageComponent = mod.default || mod[Object.keys(mod)[0]];
      }

      if (!PageComponent) {
        throw new Error(`[ForgeTS React SSR] Page '${name}' has no default export.`);
      }

      bodyHtml = ReactDOMServer.renderToString(React.createElement(PageComponent, safeProps));
    }

    const title = safeProps.title || 'ForgeTS — React SSR';
    const cleanPageName = name.replace(/^pages\//, '');
    const initialPayload = {
      page: cleanPageName,
      props: safeProps,
    };
    const jsonPayload = JSON.stringify(initialPayload).replace(/</g, '\\u003c');

    const vitePreamble = process.env.NODE_ENV !== 'production'
      ? `<script type="module">
  import RefreshRuntime from "/@react-refresh"
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>`
      : '';

    if (existsSync(this.appHtmlPath)) {
      let template = readFileSync(this.appHtmlPath, 'utf-8');
      template = template.replace('<!-- FORGETS_TITLE -->', title);
      template = template.replace('<!-- FORGETS_APP -->', bodyHtml);
      template = template.replace('<!-- FORGETS_DATA -->', jsonPayload);
      if (preloadTag) {
        template = template.replace('</head>', `${preloadTag}\n</head>`);
      }
      if (vitePreamble) {
        template = template.replace(
          '<script type="module" src="/resources/js/entry-client.tsx"></script>',
          `${vitePreamble}\n  <script type="module" src="${clientScriptSrc}"></script>`
        );
      } else {
        template = template.replace('/resources/js/entry-client.tsx', clientScriptSrc);
      }
      return template;
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
