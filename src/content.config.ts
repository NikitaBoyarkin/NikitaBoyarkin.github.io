import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projectSchema = z.object({
  title: z.string(),
  description: z.string(),
  hero: z.string(),
  impact: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  github: z.url().optional(),
  demo: z.string().optional(),
  track: z.enum(['experiments', 'analytics', 'product', 'engineering']).default('analytics'),
  related: z.array(z.string()).default([]),
  children: z.array(z.string()).default([]),
  date: z.coerce.date().optional(),
  updated: z.coerce.date().optional(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  draft: z.boolean().default(false),
  private: z.boolean().default(false),
});

const voltaPartSchema = z.object({
  title: z.string(),
  description: z.string(),
  part: z.string(),
  order: z.number(),
  layer: z.enum(['core', 'extended', 'market-jobs', 'rat-v2', 'causal']),
  impact: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  charts: z.array(z.string()).default([]),
  github: z.url().optional(),
  draft: z.boolean().default(false),
});

const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  excerpt: z.string(),
  image: z.string().optional(),
  related: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
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

export const collections = {
  projects,
  'projects-en': projectsEn,
  'volta-parts': voltaParts,
  'volta-parts-en': voltaPartsEn,
  posts,
  'posts-en': postsEn,
};
