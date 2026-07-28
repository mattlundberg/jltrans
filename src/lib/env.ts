/**
 * Secret access, isolated in one module.
 *
 * Reads through `astro:env`, and that choice is load-bearing. Vite statically
 * REPLACES `import.meta.env.X` at build time, so with these variables present in
 * Netlify's build environment — which they must be, for the route to work — both
 * secrets were being written as literals into the built function bundle. That
 * trips Netlify's secrets scanning, and it freezes the values into every deploy
 * artifact, so rotating one in the Netlify UI would not fully take effect.
 *
 * Declared `access: 'secret'` in astro.config.mjs, the values are instead read
 * from the environment where the route actually runs: Netlify's environment
 * variables in production, `.env` under `astro dev`.
 *
 * Kept async so callers do not change if this ever needs a real secret store.
 */
import { AUTH_SECRET, DO_I_WORK_PASSWORD } from 'astro:env/server';

export interface Secrets {
  password: string | undefined;
  authSecret: string | undefined;
}

export async function getSecrets(): Promise<Secrets> {
  return {
    password: DO_I_WORK_PASSWORD,
    authSecret: AUTH_SECRET,
  };
}
