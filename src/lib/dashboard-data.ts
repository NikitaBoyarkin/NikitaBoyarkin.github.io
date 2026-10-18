// Dashboard loader — the async half. Reads the collections, scans `public/` and
// hands plain data to the pure builder in `lib/dashboard.ts`.
//
// Why separate from the builder: `dashboard.ts` has to stay importable from a
// client script and testable with fixtures, so it may not touch `astro:content`
// or `node:fs`. This module is the only place that does.
//
// Reuse, never re-derive: `loadPosts` (post order + draft filter), `loadSources`
// (shelf order), `sourceHref` (locale-correct shelf links), `sortByProjectOrder`
// (the board's canonical order), `computeTopicRows` (topic counts and hrefs).

import { getCollection } from 'astro:content';
import { withBase } from './path';
import { loadPosts } from './posts';
import { loadSources, slugOf, sourceHref } from './library';
import { sortByProjectOrder } from './projects';
import { computeTopicRows } from './topics';
import { scanPublicArtifacts } from './dashboard-scan';
import {
  buildDashboard,
  localePrefix,
  type ContentSectionId,
  type DashboardIndex,
  type Lang,
  type ScannedArtifacts,
  type SectionInput,
} from './dashboard';

/**
 * The minimum of a collection entry this module reads. Narrow on purpose: the RU
 * and EN collections share a schema but not a `collection` literal, so a narrow
 * shape lets one code path serve both without a generic spelled once and used
 * twice. `draft` is here because the filter runs before the cast.
 */
interface Titled {
  id: string;
  data: { title: string; draft: boolean };
}

interface Ordered {
  id: string;
  data: { title: string; draft: boolean; order: number };
}

async function loadOne(
  locale: Lang,
  generatedAt: string,
  scanned: ScannedArtifacts,
): Promise<DashboardIndex> {
  const en = locale === 'en';
  const base = localePrefix(locale);

  const [projects, volta, posts, glossary, sources] = await Promise.all([
    getCollection(en ? 'projects-en' : 'projects', (entry) => !entry.data.draft),
    getCollection(en ? 'volta-parts-en' : 'volta-parts', (entry) => !entry.data.draft),
    loadPosts(en ? 'posts-en' : 'posts'),
    getCollection(en ? 'glossary-en' : 'glossary', (entry) => !entry.data.draft),
    loadSources(locale),
  ]);

  const projectRows = sortByProjectOrder(projects as unknown as Titled[]);
  const voltaRows = [...(volta as unknown as Ordered[])].sort((a, b) => a.data.order - b.data.order);
  const postRows = posts as unknown as Titled[];
  const glossaryRows = [...(glossary as unknown as Titled[])].sort((a, b) =>
    a.data.title.localeCompare(b.data.title, 'ru'),
  );

  // Counted from the content, never from a literal. The taxonomy routes are
  // RU-only, which is why the EN dashboard drops the card entirely
  // (`sectionOrder`), but the rows are still built for both locales so the two
  // cannot quietly disagree about what the taxonomy contains.
  const topicRows = computeTopicRows(postRows, projectRows);

  const sections: Record<ContentSectionId, SectionInput> = {
    projects: {
      count: projectRows.length,
      children: projectRows.map((entry) => ({
        title: entry.data.title,
        href: withBase(`${base}projects/${slugOf(entry.id)}/`),
        kind: 'project',
      })),
    },
    volta: {
      count: voltaRows.length,
      children: voltaRows.map((entry) => ({
        title: entry.data.title,
        href: withBase(`${base}projects/volta/${slugOf(entry.id)}/`),
        kind: 'volta',
      })),
    },
    writing: {
      count: postRows.length,
      children: postRows.map((entry) => ({
        title: entry.data.title,
        href: withBase(`${base}posts/${slugOf(entry.id)}/`),
        kind: 'post',
      })),
    },
    glossary: {
      count: glossaryRows.length,
      children: glossaryRows.map((entry) => ({
        title: entry.data.title,
        href: withBase(`${base}glossary/${slugOf(entry.id)}/`),
        kind: 'term',
      })),
    },
    library: {
      count: sources.length,
      children: sources.map((entry) => ({
        title: entry.data.title,
        href: sourceHref(locale, entry.id),
        kind: 'source',
      })),
    },
    topics: {
      count: topicRows.length,
      // A topic row stands for the items filed under it — the same `count`
      // semantics the arcade row uses for its games.
      children: topicRows.map((row) => ({
        title: row.label,
        href: row.href,
        kind: 'topic',
        count: row.count,
      })),
    },
  };

  return buildDashboard({ locale, generatedAt, sections, scanned });
}

/** Both locales, for `/dashboard-index.json`. */
export async function loadDashboards(): Promise<Record<Lang, DashboardIndex>> {
  const generatedAt = new Date().toISOString();
  // One scan for both locales: `public/` has no locale tree.
  const scanned = scanPublicArtifacts();
  const [ru, en] = await Promise.all([
    loadOne('ru', generatedAt, scanned),
    loadOne('en', generatedAt, scanned),
  ]);
  return { ru, en };
}

/** One locale, for the page that renders it. */
export async function loadDashboard(lang: Lang): Promise<DashboardIndex> {
  return loadOne(lang, new Date().toISOString(), scanPublicArtifacts());
}
