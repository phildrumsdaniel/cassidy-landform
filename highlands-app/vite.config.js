import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base path for GitHub Pages. The app is deployed to a sub-path so it lives
// completely separately from the existing landform site in this repo.
// Override at build time with VITE_BASE=/ for local/other hosting.
const base = process.env.VITE_BASE || '/cassidy-landform/highlands/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'route-static.svg',
        'images/**/*',
        'icons/**/*'
      ],
      workbox: {
        // Precache every built asset AND all images so the app is fully
        // usable with no internet once it has been opened once.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,ico,woff,woff2}'],
        // Photos can be large; lift the default 2 MiB per-file cache limit.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // OpenStreetMap tiles: cache-on-use so recently viewed areas
            // remain available offline. Online-only for new areas.
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: 'Highlands Adventure',
        short_name: 'Highlands',
        description: 'Phil & Tracey’s 16-day Scottish Highlands motorhome tour, 8–23 August 2026.',
        theme_color: '#14343f',
        background_color: '#0d232b',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
