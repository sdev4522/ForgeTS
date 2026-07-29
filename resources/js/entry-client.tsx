// resources/js/entry-client.tsx
// ─────────────────────────────────────────────────────────────────────
// Universal Client-Side Hydration Entry Point for ForgeTS React SSR.
// Deserializes initial server props and hydrates the DOM tree.
// ─────────────────────────────────────────────────────────────────────

import React from 'react';
import { hydrateRoot } from 'react-dom/client';

// Dynamically glob all React pages under resources/js/pages/
const pages = import.meta.glob([
  '/resources/js/pages/**/*.tsx',
  '/resources/pages/**/*.tsx',
]);

async function hydrate() {
  const dataEl = document.getElementById('__FORGETS_DATA__');
  if (!dataEl || !dataEl.textContent) return;

  try {
    const { page, props } = JSON.parse(dataEl.textContent);

    const candidates = [
      `/resources/js/pages/${page}.tsx`,
      `/resources/js/pages/${page}/index.tsx`,
      `/resources/pages/${page}.tsx`,
      `/resources/pages/${page}/index.tsx`,
    ];

    let pageLoader: (() => Promise<any>) | undefined;
    for (const key of candidates) {
      if (pages[key]) {
        pageLoader = pages[key];
        break;
      }
    }

    if (!pageLoader) {
      console.error(`[ForgeTS Hydration] Page component loader not found for page: '${page}'`);
      return;
    }

    const mod: any = await pageLoader();
    const PageComponent = mod.default || mod[Object.keys(mod)[0]];

    const container = document.getElementById('root');
    if (container && PageComponent) {
      hydrateRoot(container, React.createElement(PageComponent, props));
      console.log(`⚡ [ForgeTS Hydration] Hydrated page '${page}' successfully.`);
    }
  } catch (err) {
    console.error('[ForgeTS Hydration Error]', err);
  }
}

hydrate();
