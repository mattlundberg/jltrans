import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// The site is static by default. Exactly one route (/do-i-work) opts out with
// `export const prerender = false` so its protected content is rendered at the
// edge and never emitted into dist/. The adapter exists solely to enable that.
export default defineConfig({
  site: 'https://jltrans.com',
  output: 'static',
  adapter: cloudflare({
    // Resize images at build time. Cloudflare Workers have no Sharp at runtime,
    // and every image lives on a prerendered page, so 'compile' is correct here.
    imageService: 'compile',
  }),
  integrations: [
    sitemap({
      // The password-gated page must never be advertised to crawlers.
      filter: (page) => !page.includes('/do-i-work'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Emit /about/index.html rather than /about.html so old-style trailing-slash
    // inbound links resolve without a redirect hop.
    format: 'directory',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
