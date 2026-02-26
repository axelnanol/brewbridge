import { defineConfig } from 'vite';
import { readFileSync, copyFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
const rawVersion = String(rootPkg.version);
if (!/^\d{4}$/.test(rawVersion)) {
  throw new Error(
    `Invalid version "${rawVersion}" in package.json. Expected a 4-digit string for versioned HTML filename.`,
  );
}
const version = rawVersion;

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
    {
      // Each release gets a version-stamped entry-point (e.g. index-0004.html)
      // so that jsdelivr, which caches by URL, always serves a fresh file for
      // every new version rather than a stale cached copy of the previous one.
      name: 'versioned-html',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        // Remove stale index-*.html files left over from previous builds.
        if (existsSync(distDir)) {
          readdirSync(distDir)
            .filter(f => /^index-\d{4}\.html$/.test(f))
            .forEach(f => unlinkSync(resolve(distDir, f)));
        }
        // Copy index.html → index-{version}.html (index.html kept for GitHub Pages).
        const indexHtmlPath = resolve(distDir, 'index.html');
        if (existsSync(indexHtmlPath)) {
          copyFileSync(
            indexHtmlPath,
            resolve(distDir, `index-${version}.html`),
          );
        } else {
          console.warn(
            `[versioned-html] Skipping versioned HTML copy: "${indexHtmlPath}" does not exist.`,
          );
        }
      },
    },
  ],
});
