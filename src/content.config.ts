import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Content collections.
 *
 * Schemas are strict on purpose: a typo in frontmatter should fail the build,
 * not silently render an empty section. The old site had a footer that rendered
 * a bare `Address:` label for years precisely because nothing objected to a
 * missing value.
 */

const team = defineCollection({
  loader: glob({ base: './src/content/team', pattern: '**/*.md' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    location: z.string().optional(),
    /** Controls ordering on /team. Lower sorts first. */
    order: z.number().int(),
    /** Set once real photos arrive; TeamCard falls back to initials until then. */
    photo: z.string().optional(),
  }),
});

const faq = defineCollection({
  loader: glob({ base: './src/content/faq', pattern: '**/*.md' }),
  schema: z.object({
    question: z.string(),
    /** Plain-text answer, duplicated from the body for FAQPage JSON-LD. */
    summary: z.string(),
    order: z.number().int(),
  }),
});

const news = defineCollection({
  loader: glob({ base: './src/content/news', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string().optional(),
    excerpt: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { team, faq, news };
