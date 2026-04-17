import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isLocal = mode === 'development';

  return {
    plugins: [react()],
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['mqtt'],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,

      origin: env.VITE_SERVER_ORIGIN,

      hmr: {
        protocol: isLocal ? 'ws' : 'wss',
        host: env.VITE_SERVER_HOST,
        port: 8084,
      },
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['*'],
      },

      allowedHosts: [env.VITE_SERVER_HOST],
    },
  }
})
