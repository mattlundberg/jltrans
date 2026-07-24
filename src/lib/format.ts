/**
 * Small formatting helpers. Pure functions, no markup, no imports from Astro.
 */

/** `(602) 278-9192` -> `+16022789192`, for `tel:` links. */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  // Unrecognised shape (including an unresolved [NEEDS: …] placeholder) —
  // return as-is rather than emit a broken tel: URI.
  return phone;
}

/** Initials for the avatar fallback used until real team photos arrive. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 1 && /^[A-Za-z]/.test(part))
    .slice(0, 2)
    .map((part) => (part[0] as string).toUpperCase())
    .join('');
}

/** `2016-05-17` -> `May 17, 2016`. Fixed to en-US so build and runtime agree. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** ISO date for `<time datetime>`. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Joins a list as prose: `['a','b','c']` -> `a, b and c`. */
export function joinProse(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Human-readable file size for download links. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
