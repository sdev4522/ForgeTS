// vite.config.ts
// ─────────────────────────────────────────────────────────────────────
// Vite configuration for ForgeTS React SSR & Production Build.
// ─────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig((env: any) => {
  const isSSR = Boolean(env?.ssrBuild || env?.isSsrBuild || process.argv.includes('--ssr'));
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@forge/core': resolve(__dirname, 'packages/forge/src/index.ts'),
        '@forge/database': resolve(__dirname, 'packages/forge/src/database/index.ts'),
        '@/controllers': resolve(__dirname, 'app/controllers'),
        '@/models': resolve(__dirname, 'app/models'),
        '@/services': resolve(__dirname, 'app/services'),
        '@/middleware': resolve(__dirname, 'app/middleware'),
        '@/config': resolve(__dirname, 'config'),
        '@/routes': resolve(__dirname, 'routes'),
        '@/bootstrap': resolve(__dirname, 'bootstrap'),
        '@/components': resolve(__dirname, 'resources/js/components'),
        '@/layouts': resolve(__dirname, 'resources/js/layouts'),
        '@/hooks': resolve(__dirname, 'resources/js/hooks'),
        '@/lib': resolve(__dirname, 'resources/js/lib'),
        '@/types': resolve(__dirname, 'resources/js/types'),
        '@/pages': resolve(__dirname, 'resources/js/pages'),
        '@app': resolve(__dirname, 'app'),
        '@config': resolve(__dirname, 'config'),
        '@database': resolve(__dirname, 'database'),
        '@routes': resolve(__dirname, 'routes'),
        '@bootstrap': resolve(__dirname, 'bootstrap'),
        '@resources': resolve(__dirname, 'resources'),
        '@components': resolve(__dirname, 'resources/js/components'),
        '@layouts': resolve(__dirname, 'resources/js/layouts'),
        '@hooks': resolve(__dirname, 'resources/js/hooks'),
        '@lib': resolve(__dirname, 'resources/js/lib'),
        '@types': resolve(__dirname, 'resources/js/types'),
        '@pages': resolve(__dirname, 'resources/js/pages'),
        '@': resolve(__dirname, 'resources/js'),
      },
    },
    build: {
      manifest: true,
      outDir: isSSR ? 'dist/server' : 'dist/client',
      rollupOptions: isSSR
        ? {
            input: resolve(__dirname, 'resources/js/entry-server.tsx'),
          }
        : {
            input: resolve(__dirname, 'resources/js/entry-client.tsx'),
          },
    },
    server: {
      middlewareMode: true,
      hmr: true,
    },
    appType: 'custom',
  };
});
