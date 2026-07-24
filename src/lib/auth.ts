/**
 * Shared-password gate for /do-i-work.
 *
 * THREAT MODEL AND WHY IT LOOKS LIKE THIS
 * ---------------------------------------
 * The old site used WordPress post-password protection: one password handed out
 * by J&L, gating one page. We reproduce that user experience, but on a static
 * site a client-side password check is theatre — the protected content would
 * ship to every visitor inside the bundle where anyone can read it.
 *
 * So the route sets `export const prerender = false`. It renders at the edge,
 * the content never enters dist/, and CI asserts that.
 *
 * Uses Web Crypto only (no Node built-ins) because this runs on Cloudflare
 * Workers.
 *
 * Scope note: this protects one page with one shared secret. It is NOT suitable
 * for per-person data. If the page turns out to hold individual records, the
 * access model needs to change to real accounts rather than be stretched.
 */

const COOKIE_NAME = 'jl_diw';
const SESSION_SECONDS = 8 * 60 * 60; // one working day

const encoder = new TextEncoder();

/* -------------------------------------------------------------------------- */
/* Constant-time comparison                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Compares two strings without leaking length or content through timing.
 *
 * A plain `a === b` short-circuits on the first differing byte, which in
 * principle lets an attacker recover a secret one character at a time. We hash
 * both sides first so the compared values are always the same length, then diff
 * every byte unconditionally.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i++) {
    diff |= (ha[i] as number) ^ (hb[i] as number);
  }
  return diff === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return new Uint8Array(digest);
}

/* -------------------------------------------------------------------------- */
/* Signed session cookie                                                      */
/* -------------------------------------------------------------------------- */

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(new Uint8Array(sig));
}

/**
 * Builds a cookie value of `expiry.signature`.
 *
 * The expiry is inside the signed payload, so a client cannot extend its own
 * session by editing the cookie — any change invalidates the signature.
 */
export async function createSessionToken(authSecret: string, now = Date.now()): Promise<string> {
  const expiry = Math.floor(now / 1000) + SESSION_SECONDS;
  const signature = await hmac(authSecret, String(expiry));
  return `${expiry}.${signature}`;
}

/** Verifies signature first, then expiry. Any malformed input is simply invalid. */
export async function verifySessionToken(
  authSecret: string,
  token: string | undefined,
  now = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const expiryPart = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(expiryPart)) return false;

  const expected = await hmac(authSecret, expiryPart);
  if (!(await timingSafeEqual(signature, expected))) return false;

  return Number(expiryPart) > Math.floor(now / 1000);
}

export const sessionCookie = {
  name: COOKIE_NAME,
  /** Attributes for Astro's `cookies.set`. HttpOnly keeps it away from any script. */
  options: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/do-i-work',
    maxAge: SESSION_SECONDS,
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

/**
 * In-memory per-IP attempt throttle.
 *
 * Deliberately simple: it blunts casual brute forcing of a single shared
 * password. Being per-isolate, it is not a distributed guarantee — an attacker
 * spread across many edge locations gets more attempts. Upgrade to Durable
 * Objects or KV if this page ever protects something whose exposure would
 * actually hurt.
 */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

interface Attempts {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, Attempts>();

export function checkRateLimit(ip: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const record = attempts.get(ip);

  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function recordFailedAttempt(ip: string, now = Date.now()): void {
  const record = attempts.get(ip);
  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  record.count += 1;

  // Bound the map so a spray of unique IPs cannot grow it without limit.
  if (attempts.size > 5_000) {
    for (const [key, value] of attempts) {
      if (now > value.resetAt) attempts.delete(key);
    }
  }
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}
