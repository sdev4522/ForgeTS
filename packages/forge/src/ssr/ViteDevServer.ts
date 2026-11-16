// packages/forge/src/ssr/ViteDevServer.ts
// ─────────────────────────────────────────────────────────────────────
// Vite Dev Server singleton manager for middleware mode in development.
// ─────────────────────────────────────────────────────────────────────

import { createServer, type ViteDevServer as ViteServer } from 'vite';

let viteInstance: ViteServer | null = null;

/**
 * Get or initialize the Vite dev server singleton in middleware mode.
 * Returns null in production environments.
 */
export async function getViteDevServer(): Promise<ViteServer | null> {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  if (!viteInstance) {
    viteInstance = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }

  return viteInstance;
}

/**
 * Close the Vite dev server if one was started. Never starts one.
 */
export async function closeViteDevServer(): Promise<void> {
  if (viteInstance) {
    const instance = viteInstance;
    viteInstance = null;
    await instance.close();
  }
}

/**
 * Check if an incoming request path is a Vite asset or HMR request.
 */
export function isViteAssetRequest(path: string): boolean {
  return (
    path.startsWith('/@vite/') ||
    path.startsWith('/@fs/') ||
    path.startsWith('/@react-refresh') ||
    path.startsWith('/resources/') ||
    path.startsWith('/node_modules/') ||
    /\.(tsx|ts|jsx|js|css|scss|json|svg|png|jpg|jpeg|gif|webp|ico)($|\?)/.test(path)
  );
}
