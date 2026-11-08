import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // In development the API runs on :3001; the proxy keeps requests same-origin so cookies work.
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/api\//], // never serve the app shell for API paths
        runtimeCaching: [
          {
            urlPattern: /\/food\/.*\.jpg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'food-photos',
              expiration: { maxEntries: 200 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'EmsMeals',
        short_name: 'EmsMeals',
        description: 'Weekly meal plans, macro tracking and pantry-based recipe ideas.',
        theme_color: '#14281D',
        background_color: '#F6F9EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
