/// <reference types="astro/client" />

/**
 * Secrets used by /do-i-work.
 *
 * Declared here so both are documented and type-checked in the repo while their
 * values stay out of it. In production they are Netlify environment variables
 * reached through `process.env`; locally they come from `.env` — see
 * `src/lib/env.ts`, which is the only module that reads either.
 */
interface ImportMetaEnv {
  /** Shared password handed out by J&L for the "Do I Work" page. */
  readonly DO_I_WORK_PASSWORD?: string;
  /** Independent key used to sign the session cookie. Not the password. */
  readonly AUTH_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
