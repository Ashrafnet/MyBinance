import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MyExchanges',
        short_name: 'MyExchanges',
        description: 'Offline-first Binance + OKX Spot portfolio',
        theme_color: '#F3F6FA',
        background_color: '#F3F6FA',
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

