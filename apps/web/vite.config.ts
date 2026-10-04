import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'licenses/*.txt'],
      manifest: {
        id: '/',
        name: 'LipiFlow',
        short_name: 'LipiFlow',
        description: 'Private, offline Manglish to Malayalam typing.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#171717',
        background_color: '#fafafa',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,woff2,json,map,png,svg,txt,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  worker: { format: 'es' },
  build: {
    assetsInlineLimit: 0,
    outDir: process.env.VITE_LIPIFLOW_EDITION === 'hosted' ? 'dist-hosted' : 'dist',
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
