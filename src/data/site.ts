/**
 * Single source of truth for company facts.
 *
 * WHY THIS FILE IS THE ONLY PLACE THESE LIVE
 * ------------------------------------------
 * The previous site hardcoded contact details separately in the page body and
 * the footer, and they drifted: the after-hours number rendered as
 * (602) 396-1464 in one place and (601) 396-1464 in the other. CI now fails if
 * a phone number literal appears anywhere else under src/.
 */

/**
 * Marks a fact we are still waiting on from the client.
 *
 * Returns the fallback when we have a probable value, otherwise a loud
 * `[NEEDS: …]` string. It deliberately never returns an empty string: the old
 * site rendered a bare `Address:` label with nothing after it for years,
 * because empty looks fine in a template and invisible in review.
 *
 * `scripts/scan-spam.mjs` reports every remaining call as a warning during
 * development and as a build failure under `--strict` (`npm run build:launch`),
 * so the site cannot reach production with a hole in it.
 */
export function TODO_CLIENT(label: string, fallback?: string): string {
  return fallback ?? `[NEEDS: ${label}]`;
}

/** Returns true for values still awaiting a client answer, so templates can flag them. */
export function isUnresolved(value: string): boolean {
  return value.startsWith('[NEEDS:');
}

/** Incorporated January 1987. Derived, never hardcoded — the old copy said
 *  "27 years" indefinitely because the number was written into the prose. */
export const FOUNDED = 1987;

export const yearsInBusiness = (): number => new Date().getFullYear() - FOUNDED;

export const site = {
  name: 'J & L Transportation, Inc.',
  shortName: 'J&L Transportation',
  tagline: "Arizona's premier intermodal carrier",
  description:
    'J & L Transportation is an Arizona-based intermodal, drayage and ' +
    'truckload carrier serving Arizona, Reno-Sparks Nevada, and Sonora, Mexico ' +
    'since 1987.',
  url: 'https://jltrans.com',
  founded: FOUNDED,

  phone: '(602) 278-9192',
  fax: '(602) 278-4931',

  // The live site contradicts itself: (602) 396-1464 in the contact block vs
  // (601) 396-1464 in the footer. 601 is Mississippi, so 602 is almost
  // certainly correct — but it must be confirmed, not assumed.
  afterHours: TODO_CLIENT('after-hours phone — confirm (602) vs (601) 396-1464', '(602) 396-1464'),

  address: {
    street: '3226 W Durango Street',
    city: 'Phoenix',
    state: 'AZ',
    zip: '85009',
    country: 'US',
  },

  email: {
    general: 'dispatch@jltrans.com',
    reno: 'dispatchreno@jltrans.com',
  },

  hours: {
    /** Office hours, Arizona time. `opens`/`closes` feed the structured data. */
    office: {
      label: 'Monday–Friday | 6:00 AM – 5:00 PM',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '06:00',
      closes: '17:00',
    },
    operations:
      "Flexible scheduling tailored to meet our customers' operational needs, including " +
      'evenings and weekends as needed.',
  },

  /** Service areas, split by the two distinct offerings in J&L's own copy. */
  serviceAreas: {
    drayage: ['Arizona', 'Reno-Sparks, Nevada', 'Sonora, Mexico'],
    truckload: ['Arizona', 'California', 'Texas', 'New Mexico', 'Nevada'],
  },

  /** Intermodal ramps served, per the FAQ. */
  ramps: ['BNSF Phoenix', 'UPRR Phoenix', 'UPRR Tucson'],
} as const;

/**
 * Outstanding items that are not single field values, registered here so they
 * appear in `npm run todos` alongside the inline placeholders. Keeping the whole
 * punch-list in one command is the point — a list that lives in a document gets
 * forgotten.
 */
export const pendingClientItems = [
  TODO_CLIENT('fresh HazMat + Interstate Commerce certificates — the 2015 PDFs may have expired'),
  TODO_CLIENT('confirm all four association memberships are still current'),
  TODO_CLIENT('Do I Work — page contents, audience, and the shared password'),
  TODO_CLIENT('hosted form platform decision (DOT vendor vs general builder)'),
] as const;

/**
 * Industry memberships, cited by name in J&L's own "History" copy.
 * Pending client confirmation that all four are still current.
 */
export const memberships = [
  {
    name: 'American Trucking Associations',
    abbr: 'ATA',
    href: 'https://www.trucking.org',
  },
  {
    name: 'Arizona Trucking Association',
    abbr: 'ATA',
    href: 'https://www.arizonatrucking.com',
  },
  {
    name: 'Intermodal Association of North America',
    abbr: 'IANA',
    href: 'https://www.intermodal.org',
  },
  {
    name: 'Uniform Intermodal Interchange Agreement',
    abbr: 'UIIA',
    href: 'https://www.uiia.org',
  },
] as const;

/**
 * Verifiable proof points, replacing the invented "Skills We Use" percentage
 * bars on the old site (Client Satisfaction 100%, Integrity 100%, and so on).
 * Real numbers persuade; made-up ones read as filler.
 */
export const proofPoints = [
  {
    figure: '<0.1%',
    label: 'Freight claims',
    detail: 'Over the last three years.',
  },
  {
    figure: '24/7',
    label: 'Dispatch and operations',
    detail: 'Seven days a week, every week of the year.',
  },
  {
    figure: `${yearsInBusiness()}`,
    label: 'Years in operation',
    detail: `Incorporated in January ${FOUNDED}.`,
  },
  {
    figure: 'In-house',
    label: 'Shop and mechanics',
    detail: 'Safety and maintenance handled by our own team.',
  },
] as const;

/** Downloadable reference documents. */
export const documents = [
  {
    title: 'Bill of Lading',
    file: '/forms/bill-of-lading.pdf',
    description: 'Standard bill of lading for J&L shipments.',
  },
  {
    title: 'Circular Rules',
    file: '/forms/circular-rules.pdf',
    description: 'Tariff rules and accessorial charges.',
  },
  {
    title: 'HazMat Authorization Certificate',
    file: '/forms/hazmat-authorization-certificate.pdf',
    description: 'Hazardous materials authorization on file.',
    stale: true,
  },
  {
    title: 'Interstate Commerce Authorization',
    file: '/forms/interstate-commerce-authorization-certificate.pdf',
    description: 'Interstate operating authority.',
    stale: true,
  },
  {
    title: 'Points List',
    file: '/forms/points-list.pdf',
    description: 'Service points and coverage.',
  },
] as const;

/**
 * Application forms, as fillable PDFs in public/forms/. The files are served
 * exactly as supplied: re-saving a fillable PDF risks breaking its fields.
 *
 * A `null` href makes FormCard render a "coming soon" state rather than a dead
 * link, for any form added before its file exists.
 */
export const applicationForms: readonly {
  title: string;
  description: string;
  href: string | null;
  pages?: number;
  audience: 'customers' | 'drivers' | 'mechanics';
}[] = [
  {
    title: 'Credit Application',
    description: 'Open an account with J&L. Includes bank and trade references and our payment terms.',
    href: '/forms/credit-application.pdf',
    pages: 1,
    audience: 'customers',
  },
  {
    title: 'Driver Application',
    description:
      'Apply to drive for J&L. Includes the DOT-required authorizations, background check and Clearinghouse consent.',
    href: '/forms/driver-application.pdf',
    pages: 15,
    audience: 'drivers',
  },
  {
    title: 'Mechanic Application',
    description:
      'Apply for a heavy-duty mechanic position in our shop. Includes brake inspector qualification and background check.',
    href: '/forms/mechanic-application.pdf',
    pages: 11,
    audience: 'mechanics',
  },
];
