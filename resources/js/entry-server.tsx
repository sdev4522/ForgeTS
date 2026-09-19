// resources/js/entry-server.tsx
// ─────────────────────────────────────────────────────────────────────
// Server-Side Rendering Entry Point for Production Build.
// Framework-managed SSR entrypoint: developers do not need to modify
// this file. Create or edit pages under resources/js/pages/ instead.
// ─────────────────────────────────────────────────────────────────────

import React from 'react';
import ReactDOMServer from 'react-dom/server';

// Eagerly glob all React pages into the SSR bundle
const pages = import.meta.glob('/resources/js/pages/**/*.tsx', { eager: true });

export async function render(pageName: string, props: Record<string, any>): Promise<string> {
  const candidates = [
    `/resources/js/pages/${pageName}.tsx`,
    `/resources/js/pages/${pageName}/index.tsx`,
  ];

  let mod: any;
  for (const key of candidates) {
    if (pages[key]) {
      mod = pages[key];
      break;
    }
  }

  if (!mod) {
    throw new Error(`[ForgeTS SSR Bundle] Page '${pageName}' not found in SSR bundle.`);
  }

  const PageComponent = mod.default || mod[Object.keys(mod)[0]];
  if (!PageComponent) {
    throw new Error(`[ForgeTS SSR Bundle] Page '${pageName}' has no default export.`);
  }

  const element = React.createElement(PageComponent, props);
  return ReactDOMServer.renderToString(element);
}
