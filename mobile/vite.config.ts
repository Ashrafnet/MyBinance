import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      // Bypass browser CORS for signed exchange REST during local/dev PWA use.
      '/proxy/binance': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/binance/, ''),
      },
      '/proxy/okx': {
        target: 'https://www.okx.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/okx/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/proxy/binance': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/binance/, ''),
      },
      '/proxy/okx': {
        target: 'https://www.okx.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/okx/, ''),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MyExchanges',
        short_name: 'MyExchanges',
        description: 'Offline-first Binance + OKX Spot portfolio',
        theme_color: '#1F6FD6',
        background_color: '#F3F5F8',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.binance\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'binance-api', networkTimeoutSeconds: 8 },
          },
          {
            urlPattern: /^https:\/\/www\.okx\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'okx-api', networkTimeoutSeconds: 8 },
          },
        ],
      },
    }),
  ],
})

