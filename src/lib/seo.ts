/**
 * SEO helpers.
 *
 * The old site shipped a single bare `<title>JL Transportation</title>` across
 * every page and no meta description at all. Every page here supplies both.
 */

import { site, memberships, isUnresolved } from '../data/site';

export interface SeoInput {
  title: string;
  description: string;
  /** Path only, e.g. `/about`. Resolved against `site.url`. */
  pathname: string;
  /** Set on the password-gated route. */
  noindex?: boolean;
}

export interface SeoOutput {
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
}

export function buildSeo({ title, description, pathname, noindex = false }: SeoInput): SeoOutput {
  // Home already reads as the company name; inner pages get suffixed.
  const fullTitle = pathname === '/' ? `${site.shortName} — ${site.tagline}` : `${title} | ${site.shortName}`;

  return {
    title: fullTitle,
    description,
    canonical: new URL(pathname, site.url).href,
    noindex,
  };
}

/**
 * Organization + LocalBusiness JSON-LD.
 *
 * A carrier benefits from local search, and the old site had no structured data
 * whatsoever. Fields still awaiting client answers are omitted rather than
 * emitted containing a `[NEEDS: …]` placeholder — publishing a placeholder as
 * structured data would be worse than publishing nothing.
 */
export function organizationJsonLd(): string {
  const { street, city, state, zip, country } = site.address;

  const address: Record<string, string> = {
    '@type': 'PostalAddress',
    addressLocality: city,
    addressRegion: state,
    addressCountry: country,
  };
  if (!isUnresolved(street)) address.streetAddress = street;
  if (!isUnresolved(zip)) address.postalCode = zip;

  // Explicitly typed: `site` is `as const`, so an inferred array would take the
  // literal type of the first entry's telephone and reject the second.
  const contactPoints: Record<string, unknown>[] = [
    {
      '@type': 'ContactPoint',
      telephone: site.phone,
      contactType: 'customer service',
      areaServed: ['US-AZ', 'US-NV', 'MX'],
      availableLanguage: ['en', 'es'],
    },
  ];
  if (!isUnresolved(site.afterHours)) {
    contactPoints.push({
      '@type': 'ContactPoint',
      telephone: site.afterHours,
      contactType: 'emergency',
      areaServed: ['US-AZ', 'US-NV', 'MX'],
      availableLanguage: ['en', 'es'],
    });
  }

  const data = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness', 'MovingCompany'],
    name: site.name,
    alternateName: site.shortName,
    description: site.description,
    url: site.url,
    telephone: site.phone,
    faxNumber: site.fax,
    foundingDate: String(site.founded),
    address,
    contactPoint: contactPoints,
    areaServed: [...site.serviceAreas.drayage, ...site.serviceAreas.truckload]
      .filter((area, index, all) => all.indexOf(area) === index)
      .map((name) => ({ '@type': 'Place', name })),
    memberOf: memberships.map((m) => ({
      '@type': 'Organization',
      name: m.name,
      url: m.href,
    })),
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '00:00',
      closes: '23:59',
    },
  };

  return JSON.stringify(data);
}

/** FAQPage JSON-LD built from the FAQ collection. */
export function faqJsonLd(faqs: readonly { question: string; answer: string }[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  });
}
