import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Auto-update when new version available
      includeAssets: ['favicon.ico', 'icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Area 51 CRM',
        short_name: 'Area 51',
        description: 'Banquet Hall CRM - Manage leads, bookings, and sales',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#10b981',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ],
        categories: ['business', 'productivity'],
        lang: 'en-US'
      },
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache API calls with network-first strategy
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 10
            }
          }
        ],
        // Clean old caches on new deployment
        cleanupOutdatedCaches: true,
        // Skip waiting - activate new SW immediately
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: false // Disable in dev mode
      }
    })
  ],
  server: {
    port: 3000,
    host: true,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
