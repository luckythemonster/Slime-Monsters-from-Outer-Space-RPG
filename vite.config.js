import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the built site works from any path (GitHub Pages sub-path, file://, etc).
  base: './',

  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },

  build: {
    outDir: 'dist',
    // Never inline assets as data: URIs - keeps fonts/images as real files (and keeps the HTML small).
    assetsInlineLimit: 0,
  },
});
