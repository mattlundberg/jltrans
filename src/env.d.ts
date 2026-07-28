/// <reference types="astro/client" />

/**
 * The two secrets behind /do-i-work are NOT declared here.
 *
 * They live in the `env.schema` block in astro.config.mjs, which is what makes
 * them runtime secrets rather than build-time inlined literals, and Astro
 * generates their types from that. `src/lib/env.ts` is the only module that
 * reads them.
 */
