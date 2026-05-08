import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Single self-contained IIFE bundle published to public/vendor/pdf-template-builder/
export default defineConfig({
  plugins: [react()],
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
