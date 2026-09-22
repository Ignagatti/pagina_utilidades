import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/dist-electron/**', '**/build/**', '**/*.nupkg', '**/*.exe']
    }
  }
});
