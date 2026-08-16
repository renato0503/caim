import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2017',
    sourcemap: false,
    rollupOptions: {
      // S21: multi-page — index.html = landing pública, app.html = IDE (SPA).
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      },
      output: {
        // S10: só o Framework7 vira chunk fixo. O resto usa code-splitting
        // nativo (dinâmico) — langs, marked, xlsx, firebase, isomorphic-git
        // já são lazy e não podem ser forçados para um vendor único.
        manualChunks(id) {
          if (id.includes('node_modules/framework7')) return 'framework7';
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['assets/icons/favicon.ico'],
      manifest: {
        name: 'CAIM',
        short_name: 'CAIM',
        description: 'Mobile-first AI coding agent interface',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app',
        scope: '/',
        icons: [
          {
            src: '/assets/icons/logo_caim.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/assets/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/icons/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/assets/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: '/app.html',
        navigateFallbackAllowlist: [/^\/app/],
        cleanupOutdatedCaches: true,
        // S10: fonte pixel (Press Start 2P) cacheada para o modo avião
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        // S10: hoje o core está abaixo do limite do Workbox (2 MiB)
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});