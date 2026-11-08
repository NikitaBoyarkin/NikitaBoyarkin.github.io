#!/usr/bin/env bun
/**
 * Mirror the site's content into Supabase (site_projects / site_posts), so the
 * analytics tables can be joined against it with plain SQL.
 *
 *   bun run sync:analytics-content          # dry run — prints the row counts
 *   bun run sync:analytics-content:apply    # writes them
 *
 * The site stays static: nothing here is read at runtime. This is an analysis
 * surface, written by .github/workflows/sync-analytics-content.yml.
 *
 * Sources: public/projects.json is the generated registry (projects + Volta
 * chapters, already carrying both locales), and the post frontmatter under
 * src/content/. ponytail: projects come from the registry alone, not the
 * project frontmatter as well — the registry is generated from those same
 * files by `bun run export:projects`, and reading both would be two sources
 * that can disagree.
 *
 * Idempotent by the (slug, locale) primary key. No delete pass: a project
 * removed from the registry keeps its last row, because the events that
 * referenced it still roll up against it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = process.env.ANALYTICS_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.ANALYTICS_SUPABASE_SERVICE_ROLE_KEY;

const PROJECTS_JSON = 'public/projects.json';
const POST_DIRS = [
  { dir: 'src/content/posts', locale: 'ru' },
  { dir: 'src/content/posts-en', locale: 'en' },
];

/** Frontmatter of a content file, parsed; `{}` when the file has none. */
export function splitFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return {};
  return parseYaml(match[1]) ?? {};
}

function dateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** One registry entry → its ru/en pair of site_projects rows. */
function rowPair(entry, slug, track) {
  const common = {
    slug,
    track,
    tools: entry.tools ?? [],
    github: entry.github ?? null,
    demo: entry.demo ?? entry.href ?? null,
    private: Boolean(entry.private),
    draft: false,
    raw: entry,
  };
  return [
    {
      ...common,
      locale: 'ru',
      title: entry.title,
      description: entry.description ?? null,
    },
    {
      ...common,
      locale: 'en',
      title: entry.title_en ?? entry.title,
      description: entry.description_en ?? entry.description ?? null,
    },
  ];
}

export function projectRows(registry) {
  return [
    ...registry.projects.flatMap((project) =>
      rowPair(project, project.slug, project.track ?? 'analytics'),
    ),
    // Volta chapters live at /projects/volta/<part>/ and three of their slugs
    // (ab, churn, rfm) collide with project slugs, so they are stored with the
    // prefix the URL already uses.
    ...registry.volta_cases.flatMap((part) => rowPair(part, `volta-${part.slug}`, 'analytics')),
  ];
}

/** `{ slug, locale, source }` entries → site_posts rows. */
export function postRows(files) {
  return files.map(({ slug, locale, source }) => {
    const data = splitFrontmatter(source);
    return {
      slug,
      locale,
      title: String(data.title ?? slug),
      published_at: dateOrNull(data.date),
      category: data.category ?? null,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      excerpt: data.excerpt ?? null,
      draft: Boolean(data.draft),
      raw: data,
    };
  });
}

function readPostFiles() {
  return POST_DIRS.flatMap(({ dir, locale }) =>
    readdirSync(dir)
      .filter((name) => /\.mdx?$/.test(name) && !name.startsWith('_'))
      .map((name) => ({
        slug: name.replace(/\.mdx?$/, ''),
        locale,
        source: readFileSync(`${dir}/${name}`, 'utf8'),
      })),
  );
}

async function upsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=slug,locale`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      // merge-duplicates updates the row in place on the (slug, locale) key;
      // return=minimal keeps the response body empty, which is all we need.
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: Supabase responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function main() {
  const registry = JSON.parse(readFileSync(PROJECTS_JSON, 'utf8'));
  const projects = projectRows(registry);
  const posts = postRows(readPostFiles());

  if (!APPLY) {
    console.log(`[ok] dry run — would upsert ${projects.length} project row(s) and ${posts.length} post row(s)`);
    console.log('[warn] re-run with --apply to write');
    return;
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[warn] ANALYTICS_SUPABASE_URL and ANALYTICS_SUPABASE_SERVICE_ROLE_KEY must be set (Bun loads .env.local)');
    process.exit(1);
  }

  await upsert('site_projects', projects);
  await upsert('site_posts', posts);
  console.log(`[ok] upserted ${projects.length} project row(s) and ${posts.length} post row(s)`);
}

if (import.meta.main) {
  await main();
}
