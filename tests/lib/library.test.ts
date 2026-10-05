// Library shelf (Библиотека) — content invariants for `src/content/library` and
// its EN mirror `src/content/library-en`.
//
// ReadingBlock turns each note into one tile, and the build's Zod schema
// (`bookSchema`) already rejects a note with a missing or mistyped field. What
// no schema can reject is a *wrong value*: an EN note whose `href` omits the
// `en/` prefix builds green and sends the English reader to the Russian page.
// That is the gap this file closes. `tests/built/library.test.ts` binds the
// rendered output; this binds the source.
//
// Content is optional: a checkout with no books still runs the wiring checks.
import { describe, it, expect } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const CONTENT = join(ROOT, 'src', 'content');

const LANG_DIRS = { ru: 'library', en: 'library-en' } as const;
type Lang = keyof typeof LANG_DIRS;
const LANGS: Lang[] = ['ru', 'en'];

interface Book {
  slug: string;
  title: string;
  author: string;
  mono: string;
  tag: string;
  href: string;
  order: number;
  draft: boolean;
}

function mdFiles(dir: string): string[] {
  const full = join(CONTENT, dir);
  return existsSync(full) ? readdirSync(full).filter((f) => f.endsWith('.md')) : [];
}

/** Flat frontmatter scalars only — the body is prose ReadingBlock never reads. */
function load(lang: Lang): Book[] {
  const dir = LANG_DIRS[lang];
  return mdFiles(dir).map((file) => {
    const raw = readFileSync(join(CONTENT, dir, file), 'utf8');
    const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!block) throw new Error(`${lang}/${file}: no frontmatter block`);
    const fm = block[1];
    const scalar = (key: string, fallback = ''): string => {
      const hit = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(fm);
      if (!hit || hit[1].trim() === '') return fallback;
      return hit[1].trim().replace(/^["']|["']$/g, '');
    };
    return {
      slug: file.replace(/\.md$/, ''),
      title: scalar('title'),
      author: scalar('author'),
      mono: scalar('mono'),
      tag: scalar('tag'),
      href: scalar('href'),
      order: Number(scalar('order', '0')) || 0,
      draft: scalar('draft') === 'true',
    };
  });
}

/** What the shelf actually shows: drafts never reach the page. */
const published = (lang: Lang): Book[] => load(lang).filter((b) => !b.draft);

const hasContent = published('ru').length > 0 && published('en').length > 0;

function contentSuite(name: string, fn: () => void): void {
  if (hasContent) describe(name, fn);
  else describe.skip(name, fn);
}

contentSuite('library shelf — RU/EN parity', () => {
  it('publishes the same slugs in library and library-en', () => {
    const slugs = (lang: Lang) => published(lang).map((b) => b.slug).sort();
    expect(slugs('ru')).toEqual(slugs('en'));
  });
});

contentSuite('library shelf — a tile never leaves its locale', () => {
  it('prefixes every EN href with en/ and no RU href with it', () => {
    for (const b of published('en')) {
      expect(b.href, `en/${b.slug}`).toMatch(/^en\//);
    }
    for (const b of published('ru')) {
      expect(b.href, `ru/${b.slug}`).not.toMatch(/^en\//);
    }
  });

  it('stores a site path, not a URL or a bare fragment', () => {
    // A trailing `#anchor` is allowed — an in-page destination still has to name
    // the page it lives on, so the path itself stays relative.
    for (const lang of LANGS) {
      for (const b of published(lang)) {
        expect(b.href, `${lang}/${b.slug}`).toMatch(/^[a-z0-9][\w\-/]*\/(#[a-z0-9\-]+)?$/i);
      }
    }
  });
});

contentSuite('library shelf — tile facts', () => {
  it('gives every book a one- or two-character monogram', () => {
    for (const lang of LANGS) {
      for (const b of published(lang)) {
        expect(b.mono.length, `${lang}/${b.slug}`).toBeGreaterThan(0);
        expect(b.mono.length, `${lang}/${b.slug}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('gives every shelf a total order — no two books share a rank', () => {
    // A tie leaves the visible order to the glob's filename order, so the shelf
    // reshuffles on a rename. Rank is explicit or it is not a rank.
    for (const lang of LANGS) {
      const orders = published(lang).map((b) => b.order);
      expect(new Set(orders).size, `${lang}: orders ${orders.join(', ')}`).toBe(orders.length);
    }
  });

  it('carries copy on every field the tile prints', () => {
    for (const lang of LANGS) {
      for (const b of published(lang)) {
        for (const key of ['title', 'author', 'tag'] as const) {
          expect(b[key], `${lang}/${b.slug}.${key}`).toBeTruthy();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Wiring — ReadingBlock ↔ the collections. No content dependency.
// ---------------------------------------------------------------------------

describe('ReadingBlock wiring', () => {
  const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
  const component = read('src/components/ReadingBlock.astro');

  it('reads the collection that matches the requested locale', () => {
    expect(component).toContain('getCollection("library-en"');
    expect(component).toContain('getCollection("library"');
  });

  it('drops drafts before rendering', () => {
    expect(component).toMatch(/!book\.data\.draft/);
  });

  it('resolves every href through withBase', () => {
    // A raw `book.data.href` would skip the base prefix and break a sub-path deploy.
    expect(component).toContain('withBase(book.data.href)');
  });

  it('mounts on both locales of /library/', () => {
    expect(read('src/pages/library.astro')).toContain('<ReadingBlock');
    expect(read('src/pages/en/library.astro')).toContain('<ReadingBlock');
  });
});
