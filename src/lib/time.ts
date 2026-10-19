/**
 * Pure time helpers shared by the server and the browser.
 *
 * Kept apart from `schedule.ts` on purpose: that module imports the Netlify
 * Blobs client, and the schedule editor's browser script must not pull a
 * server SDK into the page bundle just to format "7:00a".
 */

/** `HH:MM`, optionally with seconds — what `<input type="time">` submits. */
const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/;

/** A valid time as `HH:MM`, or null. */
export function normaliseTime(value: string): string | null {
  const match = TIME.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h as number) * 60 + (m as number);
}

/** "07:00" → "7:00a", "12:30" → "12:30p", "00:15" → "12:15a". */
export function formatTime(time: string): string {
  const minutes = toMinutes(time);
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  return `${h % 12 || 12}:${m}${h < 12 ? 'a' : 'p'}`;
}

export function formatShift(shift: { start: string; end: string }): string {
  return `${formatTime(shift.start)} – ${formatTime(shift.end)}`;
}
