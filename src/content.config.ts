import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * The card is the hoisted Result (`CLAUDE.md`, Readability conventions; D21 in
 * `docs/prd-readability.md`): STAR is the body skeleton — Situation / Task /
 * Actions / Result — pulled onto the card, so all four letters live in one field.
 * `strict()` rejects a typo'd key instead of silently dropping it; `.min(1)`
 * rejects an empty string as an authoring slip.
 */
const starSchema = z
  .object({
    situation: z.string().min(1),
    task: z.string().min(1),
    action: z.string().min(1),
    result: z.string().min(1),
  })
  .strict()
  .optional();

const projectSchema = z.object({
  title: z.string(),
  description: z.string().min(120).max(200),
  hero: z.string(),
  impact: z.array(z.string()).default([]),
  star: starSchema,
  tools: z.array(z.string()).default([]),
  github: z.url().optional(),
  demo: z.string().optional(),
  track: z.enum(['experiments', 'analytics', 'product', 'engineering']).default('analytics'),
  related: z.array(z.string()).default([]),
  children: z.array(z.string()).default([]),
  date: z.coerce.date().optional(),
  updated: z.coerce.date().optional(),
  /** Per-project social/AI preview card (1200×630 raster under public/).
   *  Optional: falling back to Base's shared banner is the default, and an SVG
   *  hero must NOT go here — og:image consumers do not render SVG. */
  ogImage: z.string().optional(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  draft: z.boolean().default(false),
  private: z.boolean().default(false),
});

const voltaPartSchema = z.object({
  title: z.string(),
  description: z.string().min(120).max(200),
  part: z.string(),
  order: z.number(),
  layer: z.enum(['core', 'extended', 'market-jobs', 'rat-v2', 'causal']),
  impact: z.array(z.string()).default([]),
  star: starSchema,
  tools: z.array(z.string()).default([]),
  charts: z.array(z.string()).default([]),
  github: z.url().optional(),
  draft: z.boolean().default(false),
});

const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  category: z.enum(['decision-log', 'framework', 'guide', 'note']),
  tags: z.array(z.string()).default([]),
  excerpt: z.string(),
  image: z.string().optional(),
  related: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

/**
 * Glossary term (RU/EN). One note per concept; `related` holds internal
 * `/glossary/<slug>/`, `/posts/<slug>/`, `/projects/<slug>/` paths resolved by
 * `src/lib/glossary.ts`. `aka` carries aliases used for backlink matching.
 */
const termSchema = z.object({
  title: z.string(),
  description: z.string().min(60).max(200),
  aka: z.array(z.string()).default([]),
  category: z.enum(['statistics', 'experiment', 'product', 'data', 'business']),
  tags: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  updated: z.coerce.date().optional(),
  draft: z.boolean().default(false),
});

/**
 * One shelf tile on /library/. The tile is built only from verifiable facts —
 * no cover art is fabricated, hence the monogram. `href` is a site path
 * (`now/`, `projects/ab/`) that ReadingBlock resolves through `withBase`, so
 * the locale prefix stays out of the note.
 */
const bookSchema = z.object({
  title: z.string(),
  author: z.string(),
  mono: z.string().min(1).max(2),
  tag: z.string(),
  href: z.string(),
  order: z.number().default(0),
  draft: z.boolean().default(false),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/[^_]*.{md,mdx}' }),
  schema: projectSchema,
});
const projectsEn = defineCollection({
  loader: glob({ base: './src/content/projects-en', pattern: '**/[^_]*.{md,mdx}' }),
  schema: projectSchema,
});
const voltaParts = defineCollection({
  loader: glob({ base: './src/content/volta-parts', pattern: '**/[^_]*.{md,mdx}' }),
  schema: voltaPartSchema,
});
const voltaPartsEn = defineCollection({
  loader: glob({ base: './src/content/volta-parts-en', pattern: '**/[^_]*.{md,mdx}' }),
  schema: voltaPartSchema,
});
const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/[^_]*.{md,mdx}' }),
  schema: postSchema,
});
const postsEn = defineCollection({
  loader: glob({ base: './src/content/posts-en', pattern: '**/[^_]*.{md,mdx}' }),
  schema: postSchema,
});
const glossary = defineCollection({
  loader: glob({ base: './src/content/glossary', pattern: '**/[^_]*.{md,mdx}' }),
  schema: termSchema,
});
const glossaryEn = defineCollection({
  loader: glob({ base: './src/content/glossary-en', pattern: '**/[^_]*.{md,mdx}' }),
  schema: termSchema,
});

// The /about body, one file per locale, authored as .mdx so the copy is
// editable without touching .astro. `title` / `description` / JSON-LD stay on
// the page wrappers — Base consumes them, there is nowhere here to read them.
const aboutSchema = z.object({
  lang: z.enum(['ru', 'en']),
});

const library = defineCollection({
  loader: glob({ base: './src/content/library', pattern: '**/[^_]*.{md,mdx}' }),
  schema: bookSchema,
});
const libraryEn = defineCollection({
  loader: glob({ base: './src/content/library-en', pattern: '**/[^_]*.{md,mdx}' }),
  schema: bookSchema,
});

const about = defineCollection({
  loader: glob({ base: './src/content/about', pattern: '**/[^_]*.{md,mdx}' }),
  schema: aboutSchema,
});

export const collections = {
  projects,
  'projects-en': projectsEn,
  'volta-parts': voltaParts,
  'volta-parts-en': voltaPartsEn,
  posts,
  'posts-en': postsEn,
  glossary,
  'glossary-en': glossaryEn,
  library,
  'library-en': libraryEn,
  about,
};
