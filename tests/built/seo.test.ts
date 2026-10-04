// Built-output SEO invariants — the two fixes in this change fail *silently*
// when they regress, so they get a check here.
//
//   1. Sitemap `lastmod` is fabricated if every URL carries the build clock.
//      Asserted against frontmatter dates, read from source so the test does
//      not rot when a post is edited.
//   2. The search index drops a collection when one is left out of the fetch
//      (EN posts were missing from it).
//   3. The projects board carries no CollectionPage/ItemList JSON-LD, so the
//      catalog is invisible to rich results even though the detail pages
//      (Article + FAQPage) are annotated.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');

// pathname -> lastmod, or null when the sitemap carries none for that URL.
const lastmods = new Map<string, string | null>();
let searchIndex: Array<{ type: string; locale: string; href: string }> = [];

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'sitemap-0.xml'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  const sitemap = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf8');
  for (const block of sitemap.split('<url>').slice(1)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    if (!loc) continue;
    lastmods.set(new URL(loc).pathname, /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1] ?? null);
  }
  searchIndex = JSON.parse(readFileSync(resolve(DIST, 'search-index.json'), 'utf8'));
});

/** `updated ?? date` from a content file's frontmatter, as ISO. */
function frontmatterDate(file: string): string {
  const frontmatter = readFileSync(resolve(ROOT, file), 'utf8').split('---')[1] ?? '';
  const { date, updated } = parseYaml(frontmatter) ?? {};
  return new Date(updated ?? date).toISOString();
}

describe('built sitemap', () => {
  it('dates content URLs from frontmatter, not from the build clock', () => {
    const cases = [
      ['src/content/posts/cohort-retention-guide.md', '/posts/cohort-retention-guide/'],
      ['src/content/posts-en/cohort-triangles-retention.md', '/en/posts/cohort-triangles-retention/'],
    ];
    for (const [file, pathname] of cases) {
      const lastmod = lastmods.get(pathname);
      expect(lastmod).toBeTruthy();
      expect(new Date(lastmod as string).toISOString()).toBe(frontmatterDate(file));
    }
  });

  it('leaves URLs with no content date undated', () => {
    expect(lastmods.has('/notes/')).toBe(true);
    expect(lastmods.get('/notes/')).toBeNull();
  });

  it('emits only parseable lastmod values', () => {
    const dates = [...lastmods.values()].filter((v): v is string => v !== null);
    expect(dates.length).toBeGreaterThan(0);
    for (const value of dates) expect(Number.isNaN(Date.parse(value))).toBe(false);
  });
});

describe('built search index', () => {
  it('covers posts in both locales', () => {
    const posts = searchIndex.filter((entry) => entry.type === 'post');
    expect(posts.filter((entry) => entry.locale === 'ru').length).toBeGreaterThan(0);
    expect(posts.filter((entry) => entry.locale === 'en').length).toBeGreaterThan(0);
  });

  it('links every entry to a built page', () => {
    for (const entry of searchIndex) {
      const pathname = entry.href.endsWith('/') ? entry.href : `${entry.href}/`;
      expect(existsSync(resolve(DIST, `.${pathname}index.html`))).toBe(true);
    }
  });
});

/** Every JSON-LD node embedded in a built page (a page emits several scripts). */
function jsonLdNodes(html: string): Record<string, unknown>[] {
  const matches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  return [...matches].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
}

describe('built projects index', () => {
  // 17 published projects, no drafts — the count the board renders.
  const cases: Array<[string, number]> = [
    ['projects', 17],
    ['en/projects', 17],
  ];

  it('emits CollectionPage + ItemList for the catalog', () => {
    for (const [dir] of cases) {
      const html = readFileSync(resolve(DIST, dir, 'index.html'), 'utf8');
      const collection = jsonLdNodes(html).find((node) => node['@type'] === 'CollectionPage');
      expect(collection).toBeTruthy();
      const list = collection?.mainEntity as Record<string, unknown> | undefined;
      expect(list?.['@type']).toBe('ItemList');
    }
  });

  it('lists every project as a 1-based ListItem', () => {
    for (const [dir, count] of cases) {
      const html = readFileSync(resolve(DIST, dir, 'index.html'), 'utf8');
      const collection = jsonLdNodes(html).find((node) => node['@type'] === 'CollectionPage');
      const list = collection?.mainEntity as {
        numberOfItems: number;
        itemListElement: Array<Record<string, unknown>>;
      };
      expect(list.numberOfItems).toBe(count);
      expect(list.itemListElement.length).toBe(count);
      expect(list.itemListElement.map((item) => item.position)).toEqual(
        Array.from({ length: count }, (_, i) => i + 1),
      );
      for (const item of list.itemListElement) {
        expect(item['@type']).toBe('ListItem');
        expect(String(item.url)).toMatch(/^https:\/\/[^ ]+\/projects\//);
      }
    }
  });
});
