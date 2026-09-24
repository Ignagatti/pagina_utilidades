import { defineConfig } from 'vite';
import { resolve } from 'path';

const currentDir = import.meta.dirname || process.cwd();

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(currentDir, 'index.html'),
        privacy: resolve(currentDir, 'privacy.html'),
        terms: resolve(currentDir, 'terms.html'),
        notfound: resolve(currentDir, '404.html')
      }
    }
  },
  plugins: [
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '');
      }
    }
  ],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/release-installer/**', '**/dist-electron/**', '**/build/**', '**/*.nupkg', '**/*.exe']
    }
  }
});
