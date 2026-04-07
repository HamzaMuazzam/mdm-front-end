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

    // origin: 'http://10.10.11.101',
    origin: 'https://mdm.dspl.pk',

    hmr: {
      // protocol: 'ws',
      protocol: 'wss',
      // host: '10.10.11.101',
      host: 'mdm.dspl.pk',
      port: 5173,
    },
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['*'],
    },

    // allowedHosts: ['10.10.11.101']
    allowedHosts: ['mdm.dspl.pk']
  },
})

// in all above urls these are react web urls.