import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  const proxyTarget = process.env.VITE_DEV_API_PROXY_TARGET?.trim() || 'http://localhost:8080'

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('@yudiel/react-qr-scanner')) {
              return 'scanner-vendor'
            }
            if (id.includes('qrcode.react')) {
              return 'qr-vendor'
            }
            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
              return 'forms-vendor'
            }
            if (id.includes('@tanstack/react-query') || id.includes('axios')) {
              return 'data-vendor'
            }
            if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('/react-dom/')) {
              return 'react-vendor'
            }
            return undefined
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
