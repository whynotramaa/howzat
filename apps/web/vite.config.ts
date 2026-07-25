import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  // The repo keeps one .env at the root, so point Vite there instead of
  // duplicating VITE_ variables into apps/web.
  const rootEnvDir = fileURLToPath(new URL('../../', import.meta.url));
  const env = loadEnv(mode, rootEnvDir, 'VITE_');

  return {
    envDir: rootEnvDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@howzat/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
      },
    },
    // The shared package ships TypeScript source; pre-bundling it would skip
    // the TS transform and break on the first type-only import.
    optimizeDeps: { exclude: ['@howzat/shared'] },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        // Same-origin in dev means the refresh cookie is first-party and CORS
        // never enters the picture.
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:4000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // Same-origin websockets in dev, so the socket needs no CORS handling
        // and behaves the way it will behind one domain in production.
        '/socket.io': {
          target: env.VITE_SOCKET_URL || 'http://localhost:4000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
