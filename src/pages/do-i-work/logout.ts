import type { APIRoute } from 'astro';
import { sessionCookie } from '../../lib/auth';

export const prerender = false;

/** Clears the session cookie and returns to the gate. */
export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(sessionCookie.name, { path: sessionCookie.options.path });
  return redirect('/do-i-work', 303);
};

/** A GET here is a stray link, not a sign-out. Send it to the gate. */
export const GET: APIRoute = ({ redirect }) => redirect('/do-i-work', 303);
