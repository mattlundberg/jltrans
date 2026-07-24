/**
 * Secret access, isolated in one module.
 *
 * Two sources, because dev and production differ:
 *   - `cloudflare:workers` `env` — the current Workers API, populated from
 *     `.dev.vars` locally and from `wrangler secret put` in production.
 *   - `import.meta.env` — fallback for any context where the Workers module is
 *     unavailable.
 *
 * Note: `Astro.locals.runtime` is NOT used. It is deprecated in
 * @astrojs/cloudflare v14, where `Runtime` narrowed to `{ cfContext }`.
 */

export interface Secrets {
  password: string | undefined;
  authSecret: string | undefined;
}

export async function getSecrets(): Promise<Secrets> {
  let workersEnv: Partial<Cloudflare.Env> = {};

  try {
    // Dynamic import: this module only resolves inside the Workers runtime, and
    // a static import would break any non-workerd context.
    const mod = await import('cloudflare:workers');
    workersEnv = (mod.env ?? {}) as Partial<Cloudflare.Env>;
  } catch {
    // Not running under workerd — fall through to import.meta.env.
  }

  return {
    password: workersEnv.DO_I_WORK_PASSWORD ?? import.meta.env.DO_I_WORK_PASSWORD,
    authSecret: workersEnv.AUTH_SECRET ?? import.meta.env.AUTH_SECRET,
  };
}
