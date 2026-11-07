import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The component pack folders sit next to src/ and are deliberately outside the Vite root.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // three.js is its own lazy chunk, loaded behind the logo animation.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'src/index.html'),
        inspire: resolve(import.meta.dirname, 'src/inspire.html'),
      },
    },
  },
});
