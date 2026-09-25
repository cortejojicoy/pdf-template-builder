import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);

// Ship pdf.js's worker beside the bundle so the canvas loads it same-origin at
// exactly the version it was built against. A CDN copy can be blocked by CSP or
// an offline host, and pdf.js then silently falls back to any worker a host page
// left on globalThis — which is a version mismatch the moment the host bundles
// its own pdf.js.
//
// Published as .js although the contents are an ES module: pdf.js spawns it with
// { type: 'module' }, so the browser judges it by Content-Type, not extension —
// and stock nginx has no mime.types entry for .mjs, serving it as
// application/octet-stream, which a module worker refuses.
function copyPdfWorker() {
  return {
    name: 'copy-pdf-worker',
    closeBundle() {
      const build = dirname(require.resolve('pdfjs-dist/package.json')) + '/build';
      copyFileSync(`${build}/pdf.worker.min.mjs`, 'resources/dist/pdf.worker.min.js');
    },
  };
}

// Single self-contained IIFE bundle published to public/vendor/pdf-template-builder/
export default defineConfig({
  plugins: [react(), copyPdfWorker()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'resources/dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'resources/js/src/main.jsx'),
      name: 'PdfTemplateBuilder',
      fileName: () => 'pdf-builder.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        assetFileNames: 'pdf-builder.[ext]',
      },
    },
  },
});
