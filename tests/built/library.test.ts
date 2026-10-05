// /library/ renders the shelf the collection describes — and every tile stays
// inside its own locale.
//
// The shelf is data now: `src/content/library/*.md` (EN mirror `library-en`) is
// read by ReadingBlock at build time. Nothing in the build complains when a tile
// points at the wrong page — the link simply lands somewhere else, silently.
// `tests/lib/library.test.ts` binds the source side; this binds the output.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');
const CONTENT = resolve(ROOT, 'src', 'content');

const PAGES = [
  { label: 'RU library', path: '/library/index.html', dir: 'library', localeRoot: '' },
  { label: 'EN library', path: '/en/library/index.html', dir: 'library-en', localeRoot: '/en' },
];

/** Frontmatter scalars only — enough to list published books and their routes. */
function publishedSlugs(dir: string): string[] {
  const full = join(CONTENT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => /\.mdx?$/.test(f))
    .filter((f) => {
      const raw = readFileSync(join(full, f), 'utf8');
      const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
      const draft = block && /^draft:\s*true\s*$/m.test(block[1]);
      return !draft;
    })
    .map((f) => f.replace(/\.mdx?$/, ''));
}

function publishedCount(dir: string): number {
  return publishedSlugs(dir).length;
}

function page(path: string): string {
  const file = resolve(DIST, `.${path}`);
  if (!existsSync(file)) {
    throw new Error(`dist${path} missing — run \`bun run build\` first`);
  }
  return readFileSync(file, 'utf8');
}

/** hrefs of every shelf tile, in document order. */
function tileHrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*class="book-tile"[^>]*>/g)].map(
    (tag) => /href="([^"]*)"/.exec(tag[0])?.[1] ?? '',
  );
}

describe.each(PAGES)('library page contract ($label)', ({ path, dir, localeRoot }) => {
  let html = '';
  let hrefs: string[] = [];

  beforeAll(() => {
    html = page(path);
    hrefs = tileHrefs(html);
  });

  it('renders exactly one tile per published book', () => {
    expect(hrefs.length).toBe(publishedCount(dir));
  });

  it('emits every tile with a real destination', () => {
    for (const href of hrefs) {
      expect(href, `${path}: tile without href`).not.toBe('');
    }
  });

  it('never sends a reader into the other locale', () => {
    // The rule that catches a wrong `href`: strip this page's own locale prefix
    // and the page behind the link must exist in dist under that same prefix.
    // An EN tile carrying the bare `now/` resolves to dist/en/now/ — absent —
    // and the reader lands on the Russian page instead.
    for (const href of hrefs) {
      const withoutHash = href.split('#')[0].split('?')[0];
      const inLocale = withoutHash.startsWith(`${localeRoot}/`)
        ? withoutHash.slice(localeRoot.length + 1)
        : withoutHash.replace(/^\//, '');
      const target = resolve(DIST, localeRoot.replace(/^\//, ''), inLocale, 'index.html');
      expect(existsSync(target), `${path}: ${href} resolves outside ${localeRoot || '/'}`).toBe(
        true,
      );
    }
  });

  it('leads with the shelf heading', () => {
    // Scoped styles put `data-astro-cid-*` on the element, so match the text
    // between the tags rather than the bare `<h1>text</h1>` form.
    const Heading = localeRoot ? 'Library' : 'Библиотека';
    expect(html).toMatch(new RegExp(`<h1[^>]*>${Heading}</h1>`));
  });

  it('keeps every «Applied in» link inside this locale', () => {
    // The block renders only when a project lists this note in `sources:`
    // (projectSchema). No project does today, so the body is a no-op now — and
    // the moment the owner wires one, a project href built for the other locale
    // turns this red instead of silently sending the reader across the tree.
    // The source half (a slug that names no note) is bound in tests/lib/library.test.ts.
    for (const slug of publishedSlugs(dir)) {
      const file = resolve(DIST, localeRoot.replace(/^\//, ''), 'library', slug, 'index.html');
      if (!existsSync(file)) continue;
      const sourceHtml = readFileSync(file, 'utf8');
      const section = /<section[^>]*class="source-applied"[\s\S]*?<\/section>/.exec(sourceHtml)?.[0];
      if (!section) continue;

      const links = [...section.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
      expect(links.length, `${slug}: «Applied in» rendered with no link`).toBeGreaterThan(0);
      for (const href of links) {
        const withoutHash = href.split('#')[0].split('?')[0];
        const inLocale = withoutHash.startsWith(`${localeRoot}/`)
          ? withoutHash.slice(localeRoot.length + 1)
          : withoutHash.replace(/^\//, '');
        const target = resolve(DIST, localeRoot.replace(/^\//, ''), inLocale, 'index.html');
        expect(existsSync(target), `${slug}: ${href} resolves outside ${localeRoot || '/'}`).toBe(true);
      }
    }
  });
});
