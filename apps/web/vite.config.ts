import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
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
    optimizeDeps: { exclude: ['@howzat/shared'] },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api/socket.io': {
          target: env.VITE_SOCKET_URL || 'http://localhost:4000',
          ws: true,
          changeOrigin: true,
        },
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:4000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
