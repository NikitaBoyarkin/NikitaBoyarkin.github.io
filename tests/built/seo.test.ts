// Built-output SEO invariants — the two fixes in this change fail *silently*
// when they regress, so they get a check here.
//
//   1. Sitemap `lastmod` is fabricated if every URL carries the build clock.
//      Asserted against frontmatter dates, read from source so the test does
//      not rot when a post is edited.
//   2. The search index drops a collection when one is left out of the fetch
//      (EN posts were missing from it).
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
