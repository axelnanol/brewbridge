import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
  plugins: [
    {
      // Tizen TV browsers do not support ES modules (type="module").
      // Convert module script tags to plain deferred scripts so the
      // bundled IIFE executes correctly on older Chromium-based TVs.
      name: 'tizen-compat',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          return html.replace(/<script\s+type="module"\s+crossorigin/g, '<script defer');
        },
      },
    },
  ],
});
