import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    // Dual target for improved Tizen compatibility:
    //   'es2015'   → esbuild lowers async/await → generators (Chrome 39+), making
    //                the bundle parse-safe on Chrome 49-54 (pre-2016 Tizen TVs).
    //   'chrome65' → esbuild also lowers ?? (nullish coalescing, Chrome 80+),
    //                ?. (optional chaining, Chrome 80+), and optional catch binding
    //                (Chrome 66+) — the syntax that caused blank screens on 2018-2019
    //                Tizen TVs (Chrome 65-69).
    // Note: const/let and destructuring (Chrome 49+) are not transformed because
    // esbuild does not implement those lowerings; as a result, the true minimum
    // supported Chromium version for this bundle is 49+.
    target: ['chrome65', 'es2015'],
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
          // Strip type="module" (and optional crossorigin) from <script> tags,
          // replacing with defer so the IIFE executes on Tizen's older Chromium.
          // Uses a callback to handle any attribute order Vite may produce.
          return html.replace(
            /<script\b([^>]*?)\btype=["']module["']([^>]*?)>/g,
            (_match, before, after) => {
              const rest = (before + after)
                .replace(/\bcrossorigin(=["'][^"']*["'])?\s*/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              return `<script defer${rest ? ' ' + rest : ''}>`;
            },
          );
        },
      },
    },
  ],
});
