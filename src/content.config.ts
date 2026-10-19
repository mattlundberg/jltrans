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
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      location: z.string().optional(),
      /** Controls ordering on /team. Lower sorts first. */
      order: z.number().int(),
      /**
       * Path to a headshot in src/assets/team/, relative to the entry. `image()`
       * makes a missing file a build error and lets Astro resize it.
       * TeamCard falls back to initials when absent.
       */
      photo: image().optional(),
    }),
});

export const collections = { team };
