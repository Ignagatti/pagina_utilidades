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
        notfound: resolve(currentDir, '404.html'),
        qr: resolve(currentDir, 'generador-qr.html'),
        editorPdf: resolve(currentDir, 'editor-pdf.html'),
        compressPdf: resolve(currentDir, 'comprimir-pdf.html'),
        mergePdf: resolve(currentDir, 'unir-pdf.html'),
        splitPdf: resolve(currentDir, 'separar-pdf.html'),
        imagesToPdf: resolve(currentDir, 'imagenes-a-pdf.html'),
        diffPdf: resolve(currentDir, 'comparar-pdf.html'),
        redactPdf: resolve(currentDir, 'censurar-pdf.html'),
        heicImage: resolve(currentDir, 'convertir-heic-a-jpg.html'),
        audioText: resolve(currentDir, 'transcribir-audio-a-texto.html'),
        securityAes: resolve(currentDir, 'cifrar-archivos-aes256.html'),
        archiveZip: resolve(currentDir, 'crear-archivos-zip.html')
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
