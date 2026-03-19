import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
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

    origin: 'https://a8ae-103-48-0-195.ngrok-free.app',

    hmr: {
      protocol: 'wss',
      host: 'a8ae-103-48-0-195.ngrok-free.app',
      clientPort: 443,
    },
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['*'],
    },

    allowedHosts: ['a8ae-103-48-0-195.ngrok-free.app']
  },
})