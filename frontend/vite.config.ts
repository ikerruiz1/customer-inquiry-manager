import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// <https://vite.dev/config/>
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Handle offline backend gracefully without spamming terminal
          });
        },
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Handle offline backend gracefully
          });
        },
      },
    },
  },
})