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
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
    }),
  ],
})
