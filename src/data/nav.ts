/**
 * Navigation structure.
 *
 * The old site was a single page whose nav items were anchor links (#about,
 * #team). These are now real routes, which is better for search and lets
 * someone link to a specific section.
 *
 * `/news` is deliberately absent from the primary nav: the only post dates from
 * May 2016, and a visibly dormant blog in the header is worse than no blog. It
 * stays reachable from the footer and keeps working the moment a second post is
 * added.
 */

export interface NavItem {
  label: string;
  href: string;
  /** Short description used by the footer sitemap column. */
  blurb?: string;
}

export const primaryNav: readonly NavItem[] = [
  { label: 'About', href: '/about/', blurb: 'History, operations and mission' },
  { label: 'Who We Are', href: '/who-we-are/', blurb: 'Values and philosophy' },
  { label: 'Team', href: '/team/', blurb: 'The people behind J&L' },
  { label: 'Forms', href: '/forms/', blurb: 'Applications and documents' },
  { label: 'Contact', href: '/contact/', blurb: 'Phone, email and FAQs' },
] as const;

export const secondaryNav: readonly NavItem[] = [
  { label: 'News', href: '/news/', blurb: 'Company updates' },
  { label: 'Do I Work', href: '/do-i-work', blurb: 'Password required' },
] as const;

/** True when `href` is the current page, tolerating trailing-slash differences. */
export function isCurrent(href: string, pathname: string): boolean {
  const normalise = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  return normalise(href) === normalise(pathname);
}
