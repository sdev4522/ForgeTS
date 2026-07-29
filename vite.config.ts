// vite.config.ts
// ─────────────────────────────────────────────────────────────────────
// Vite configuration for ForgeTS React SSR & Production Build.
// ─────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ ssrBuild }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@forge/core': resolve(__dirname, 'packages/forge/src/index.ts'),
        '@forge/database': resolve(__dirname, 'packages/forge/src/database/index.ts'),
        '@app': resolve(__dirname, 'app'),
        '@config': resolve(__dirname, 'config'),
        '@resources': resolve(__dirname, 'resources'),
        '@components': resolve(__dirname, 'resources/js/components'),
        '@layouts': resolve(__dirname, 'resources/js/layouts'),
        '@hooks': resolve(__dirname, 'resources/js/hooks'),
        '@lib': resolve(__dirname, 'resources/js/lib'),
        '@types': resolve(__dirname, 'resources/js/types'),
        '@pages': resolve(__dirname, 'resources/js/pages'),
      },
    },
    build: {
      manifest: true,
      outDir: ssrBuild ? 'dist/server' : 'dist/client',
      rollupOptions: ssrBuild
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
