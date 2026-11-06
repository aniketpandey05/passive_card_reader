import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from a subdirectory, so the build needs to know
// its own path. The workflow sets BASE_PATH; local development keeps the root.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'WordFlow - passive vocabulary review',
        short_name: 'WordFlow',
        description: 'Hands-free flashcards from any dictionary.',
        theme_color: '#faf9f7',
        background_color: '#faf9f7',
        display: 'standalone',
        orientation: 'portrait',
        // Both must sit under the deployed path or the installed app opens a
        // blank page: it would look for the start URL at the domain root.
        scope: base,
        start_url: base,
        // Puts WordFlow in the system share sheet, so a passage from a browser
        // or a reader can be sent straight here. The action is the start URL
        // rather than a path of its own: this is a static host with no router,
        // and anything else would be a 404 the moment someone shared to it.
        // GET, because a POST target needs a service worker route that the
        // generated worker has no way to add.
        share_target: {
          action: base,
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // The PDF reader is the one thing here that was never going to work
        // offline: its engine is a .mjs worker the precache does not match,
        // so installing the screen without it only ever bought a spinner.
        // Both are fetched when a PDF is actually opened - which is a
        // deliberate act, usually online - and kept from then on.
        globIgnores: ['**/PdfImport-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(PdfImport|pdf\.worker)[^/]*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wordflow-pdf',
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
