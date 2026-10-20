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
//   4. A `faq:` block that does not reach the page as FAQPage JSON-LD is dead
//      weight — the questions are written for rich results and AI citation, so
//      the frontmatter and the emitted graph are asserted to agree.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

  it('indexes every Volta sub-part and the topic hubs', () => {
    // Both were invisible to site search: the fetch list simply omitted the
    // collections, so the flagship case's 23 method pages and the topic hubs
    // could not be found from the search panel at all.
    const countIn = (dir: string) =>
      readdirSync(resolve(ROOT, 'src', 'content', dir)).filter((f) => f.endsWith('.md')).length;
    const parts = searchIndex.filter((entry) => entry.type === 'part');
    expect(parts.filter((entry) => entry.locale === 'ru').length).toBe(countIn('volta-parts'));
    expect(parts.filter((entry) => entry.locale === 'en').length).toBe(countIn('volta-parts-en'));
    expect(parts.some((entry) => entry.locale === 'en')).toBe(true);

    const topics = searchIndex.filter((entry) => entry.type === 'topic');
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.every((entry) => entry.href.startsWith('/topics/'))).toBe(true);
  });
});

describe('built head directives and feeds', () => {
  it('noindexes the 404 from <head>, where crawlers actually read it', () => {
    const html = readFileSync(resolve(DIST, '404.html'), 'utf8');
    const headEnd = html.indexOf('</head>');
    expect(html.slice(0, headEnd)).toContain('name="robots" content="noindex');
    expect(html.slice(headEnd)).not.toContain('name="robots"');
  });

  it('puts the CV Disallow inside every named crawler group', () => {
    // A named group overrides `*`, so a Disallow only in `*` protects the PDF
    // from nobody. Groups are blank-line separated (RFC 9309).
    const txt = readFileSync(resolve(DIST, 'robots.txt'), 'utf8');
    const groups = txt.split(/\n\s*\n/).filter((g) => /^User-agent:/m.test(g));
    expect(groups.length).toBeGreaterThan(1);
    for (const group of groups) {
      expect(group).toContain('Disallow: /CV-Nikita-Boyarkin.pdf');
    }
  });

  it('dates a revised post by its edit, and never stamps the build clock', () => {
    const rss = readFileSync(resolve(DIST, 'rss.xml'), 'utf8');
    expect(rss).not.toContain('<lastBuildDate>');
    const cases = [
      ['src/content/posts/sql-window-functions.md', 'sql-window-functions'],
      ['src/content/posts/bayesian-ab-testing.md', 'bayesian-ab-testing'],
    ];
    for (const [file, slug] of cases) {
      const frontmatter = readFileSync(resolve(ROOT, file), 'utf8').split('---')[1] ?? '';
      const { date, updated } = parseYaml(frontmatter) ?? {};
      expect(updated).toBeTruthy();
      const item = new RegExp(`<item>(?:(?!</item>).)*${slug}.*?</item>`, 's').exec(rss)?.[0] ?? '';
      expect(item).toContain(`<pubDate>${new Date(updated).toUTCString()}</pubDate>`);
      expect(item).not.toContain(`<pubDate>${new Date(date).toUTCString()}</pubDate>`);
    }
  });
});

/** Every JSON-LD node embedded in a built page (a page emits several scripts). */
function jsonLdNodes(html: string): Record<string, unknown>[] {
  const matches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  return [...matches].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
}

describe('built projects index', () => {
  // Published cards, counted from source rather than pinned to a literal.
  // `test:built` reads whatever dist/ is on disk and never rebuilds it, so a
  // hardcoded count passes against a stale build and fails only in CI — which
  // is how 18 outlived the four cards that made it 22.
  const cardsIn = (dir: string) =>
    readdirSync(resolve(ROOT, 'src', 'content', dir)).filter((f) => f.endsWith('.md')).length;
  const cases: Array<[string, number]> = [
    ['projects', cardsIn('projects')],
    ['en/projects', cardsIn('projects-en')],
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

/** `faq:` from a content file's frontmatter, as an array of Q/A pairs. */
function sourceFaq(file: string): Array<{ question: string; answer: string }> {
  const frontmatter = readFileSync(resolve(ROOT, file), 'utf8').split('---')[1] ?? '';
  const { faq } = parseYaml(frontmatter) ?? {};
  return Array.isArray(faq) ? faq : [];
}

describe('built project FAQ', () => {
  // The five cases that carry a `faq:` block, in both locales.
  const slugs = ['volta', 'sql', 'cohort', 'ab', 'churn'];

  it('emits a FAQPage whose Question count matches the frontmatter', () => {
    for (const slug of slugs) {
      for (const [dir, content] of [
        ['projects', `src/content/projects/${slug}.md`],
        ['en/projects', `src/content/projects-en/${slug}.md`],
      ] as Array<[string, string]>) {
        const expected = sourceFaq(content);
        expect(expected.length).toBeGreaterThan(0);

        const html = readFileSync(resolve(DIST, dir, slug, 'index.html'), 'utf8');
        const faqPage = jsonLdNodes(html)
          .flatMap((node) => (Array.isArray(node['@graph']) ? (node['@graph'] as Record<string, unknown>[]) : [node]))
          .find((node) => node['@type'] === 'FAQPage');
        expect(faqPage).toBeTruthy();

        const questions = faqPage?.mainEntity as Array<Record<string, unknown>>;
        expect(questions.length).toBe(expected.length);
        for (const question of questions) {
          expect(question['@type']).toBe('Question');
          expect(expected.map((pair) => pair.question)).toContain(String(question.name));
        }
      }
    }
  });

  it('carries a faq in both locales for every slug that has one', () => {
    for (const slug of slugs) {
      const ru = sourceFaq(`src/content/projects/${slug}.md`).length;
      const en = sourceFaq(`src/content/projects-en/${slug}.md`).length;
      expect([slug, ru > 0, en > 0]).toEqual([slug, true, true]);
    }
  });
});
