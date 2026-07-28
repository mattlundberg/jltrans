/**
 * Secret access, isolated in one module.
 *
 * Two sources, because dev and production differ:
 *   - `process.env` — Netlify Functions run on Node, and site environment
 *     variables (and anything in a local `.env` read by `netlify dev`) arrive
 *     here at request time.
 *   - `import.meta.env` — Vite's view of `.env`, which is what `astro dev`
 *     serves the route from.
 *
 * Kept async so callers do not change if this ever needs to await a real secret
 * store.
 */

export interface Secrets {
  password: string | undefined;
  authSecret: string | undefined;
}

export async function getSecrets(): Promise<Secrets> {
  // Guarded: the prerender pass and any future non-Node runtime have no
  // `process`, and a bare reference would throw rather than fall through.
  const runtimeEnv: Record<string, string | undefined> =
    typeof process !== 'undefined' && process.env ? process.env : {};

  return {
    password: runtimeEnv.DO_I_WORK_PASSWORD ?? import.meta.env.DO_I_WORK_PASSWORD,
    authSecret: runtimeEnv.AUTH_SECRET ?? import.meta.env.AUTH_SECRET,
  };
}
