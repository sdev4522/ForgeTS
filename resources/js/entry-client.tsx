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
    const cleanPage = String(page || '').replace(/^pages\//, '');

    const candidates = [
      `/resources/js/pages/${cleanPage}.tsx`,
      `/resources/js/pages/${cleanPage}/index.tsx`,
      `/resources/js/pages/${page}.tsx`,
      `/resources/js/pages/${page}/index.tsx`,
      `/resources/pages/${cleanPage}.tsx`,
      `/resources/pages/${cleanPage}/index.tsx`,
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
      const element = React.createElement(PageComponent, props);

      const isDev = Boolean(import.meta.env?.DEV || process.env.NODE_ENV !== 'production');
      if (isDev) {
        let hydrationMismatchDetected = false;
        const originalError = console.error;
        const originalWarn = console.warn;

        const isHydrationMessage = (msg: unknown) => {
          const str = String(msg ?? '');
          return (
            str.includes('Hydration failed') ||
            str.includes('Text content does not match') ||
            str.includes('did not match') ||
            str.includes('Expected server HTML to contain') ||
            str.includes('error occurred during hydration')
          );
        };

        const logGuidance = () => {
          if (!hydrationMismatchDetected) {
            hydrationMismatchDetected = true;
            console.warn(
              `⚡ [ForgeTS Hydration Warning] Hydration mismatch on page: '${page}'\n` +
                `   This usually means server-rendered props/HTML differ from client props.\n` +
                `   Common causes: non-deterministic values like Date.now() or Math.random(),\n` +
                `   browser-only APIs (window/localStorage) rendered during SSR, or mismatched props.`
            );
          }
        };

        console.error = (...args: any[]) => {
          originalError.apply(console, args);
          if (isHydrationMessage(args[0])) {
            logGuidance();
          }
        };

        console.warn = (...args: any[]) => {
          originalWarn.apply(console, args);
          if (isHydrationMessage(args[0])) {
            logGuidance();
          }
        };

        try {
          hydrateRoot(container, element);
        } finally {
          setTimeout(() => {
            console.error = originalError;
            console.warn = originalWarn;
          }, 100);
        }
      } else {
        hydrateRoot(container, element);
      }

      console.log(`⚡ [ForgeTS Hydration] Hydrated page '${page}' successfully.`);
    }
  } catch (err) {
    console.error('[ForgeTS Hydration Error]', err);
  }
}

hydrate();
