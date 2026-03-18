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
    host: true,              // ✅ allow external access
    port: 5173,
    strictPort: true,

    origin: 'https://logicaldevs.com', // 🔥 VERY IMPORTANT

    hmr: {
      protocol: 'wss',
      host: 'logicaldevs.com',
      clientPort: 443,
    },

    allowedHosts: ['logicaldevs.com'],
  },
})