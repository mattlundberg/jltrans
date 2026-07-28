import { defineConfig, envField } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// The site is static by default. Exactly one route (/do-i-work) opts out with
// `export const prerender = false` so its protected content is rendered on
// demand and never emitted into dist/. The adapter exists solely to enable
// that: it builds those routes into a single Netlify Function and leaves every
// other page as a plain file in dist/.
export default defineConfig({
  site: 'https://jltrans.com',
  output: 'static',
  adapter: netlify({
    // Resize images at build time with Sharp rather than deferring to Netlify
    // Image CDN. Every image lives on a prerendered page, so the work belongs
    // in the build, and the served URLs stay ordinary static paths.
    imageCDN: false,
  }),
  // The two secrets behind /do-i-work.
  //
  // `access: 'secret'` is load-bearing, not decoration: it makes Astro read the
  // value from the environment at request time. Reading them through
  // `import.meta.env` instead let Vite statically replace the references, which
  // baked both literals into the built function bundle — see src/lib/env.ts.
  //
  // Optional so a missing value arrives as `undefined` and the route renders its
  // "Not configured" state. A required secret throws, turning a misconfiguration
  // into a 500.
  env: {
    schema: {
      /** Shared password handed out by J&L for the "Do I Work" page. */
      DO_I_WORK_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      /** Independent key used to sign the session cookie. Not the password. */
      AUTH_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
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
