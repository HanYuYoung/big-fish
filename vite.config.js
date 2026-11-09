import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  // the archived project has its own index.html; keep dependency scanning on this one
  optimizeDeps: { entries: ['index.html'] },
  server: { open: false, watch: { ignored: ['**/_old_sakura_valley/**'] } },
});
