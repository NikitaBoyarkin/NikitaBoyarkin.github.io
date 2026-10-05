// Library shelf (Библиотека) — content invariants for `src/content/library` and
// its EN mirror `src/content/library-en`.
//
// The build's Zod schema (`bookSchema` in src/content.config.ts) already rejects
// a note with a missing or mistyped field. What no schema can reject is a *wrong
// value*: a `kind` outside the closed set, a `url` that is not a URL, or a kind
// that needs a source and has none. That is the gap this file closes.
//
// The tile path is no longer authored at all — `sourceHref` in src/lib/library.ts
// derives it from the locale — so the "EN note forgot the en/ prefix" drift class
// is gone by construction. `tests/built/library.test.ts` binds the rendered
// output; this binds the source.
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

/** The closed sets live in src/lib/source.ts — read them, never restate them. */
const SOURCE_TS = readFileSync(join(ROOT, 'src', 'lib', 'source.ts'), 'utf8');

function vocab(name: string): string[] {
  // `[^=]*` skips an optional type annotation: KINDS_NEEDING_URL is `readonly
  // SourceKind[]`, the other two are bare arrays.
  const hit = new RegExp(`export const ${name}(?::[^=]*)? = \\[([^\\]]*)\\]`).exec(SOURCE_TS);
  if (!hit) throw new Error(`src/lib/source.ts: no export named ${name}`);
  return [...hit[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}
const KINDS = vocab('SOURCE_KINDS');
const STATUSES = vocab('SOURCE_STATUSES');
const KINDS_NEEDING_URL = vocab('KINDS_NEEDING_URL');

interface Book {
  slug: string;
  title: string;
  author: string;
  mono: string;
  kind: string;
  status: string;
  url: string;
  order: number;
  draft: boolean;
}

function mdFiles(dir: string): string[] {
  const full = join(CONTENT, dir);
  return existsSync(full) ? readdirSync(full).filter((f) => f.endsWith('.md')) : [];
}

function frontmatter(lang: Lang, file: string): string {
  const raw = readFileSync(join(CONTENT, LANG_DIRS[lang], file), 'utf8');
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!block) throw new Error(`${lang}/${file}: no frontmatter block`);
  return block[1];
}

/** Flat frontmatter scalars only — the body is prose the tile never reads. */
function load(lang: Lang): Book[] {
  const dir = LANG_DIRS[lang];
  return mdFiles(dir).map((file) => {
    const fm = frontmatter(lang, file);
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
      kind: scalar('kind'),
      status: scalar('status'),
      url: scalar('url'),
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

contentSuite('library shelf — the tile path is derived, not authored', () => {
  it('branches the locale prefix in exactly one place', () => {
    const lib = readFileSync(join(ROOT, 'src', 'lib', 'library.ts'), 'utf8');
    expect(lib).toContain("lang === 'en' ? 'en/' : ''");
    expect(lib).toContain('export function sourceHref');
  });

  it('keeps `href` out of every shelf note', () => {
    // The field the tile used to read is gone; a note that still carries one is a
    // note that predates the migration, and `.strict()` would have rejected it.
    for (const lang of LANGS) {
      for (const file of mdFiles(LANG_DIRS[lang])) {
        expect(/^href:/m.test(frontmatter(lang, file)), `${lang}/${file}`).toBe(false);
      }
    }
  });
});

contentSuite('library shelf — the external source is real or absent', () => {
  it('stores an absolute https url when it stores one at all', () => {
    for (const lang of LANGS) {
      for (const b of published(lang)) {
        if (!b.url) continue;
        expect(b.url, `${lang}/${b.slug}`).toMatch(/^https:\/\/\S+$/);
      }
    }
  });

  it('requires a url for every kind that is not a book you hold', () => {
    // A paper or a talk is a pointer; without the pointer the tile is a dead label.
    for (const lang of LANGS) {
      for (const b of published(lang)) {
        if (!KINDS_NEEDING_URL.includes(b.kind)) continue;
        expect(b.url, `${lang}/${b.slug} (kind: ${b.kind})`).toBeTruthy();
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
        for (const key of ['title', 'author'] as const) {
          expect(b[key], `${lang}/${b.slug}.${key}`).toBeTruthy();
        }
      }
    }
  });

  it('names a kind and a status from the closed sets', () => {
    for (const lang of LANGS) {
      for (const b of published(lang)) {
        expect(KINDS, `${lang}/${b.slug}.kind`).toContain(b.kind);
        expect(STATUSES, `${lang}/${b.slug}.status`).toContain(b.status);
      }
    }
  });

  it('keeps at most one book reading at a time', () => {
    // /about#now shows the single `reading` book; two of them and the line is a
    // coin flip decided by glob order.
    for (const lang of LANGS) {
      const reading = published(lang).filter((b) => b.status === 'reading');
      expect(reading.length, `${lang}: ${reading.map((b) => b.slug).join(', ')}`).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Wiring — the loader, the component and the pages. No content dependency.
// ---------------------------------------------------------------------------

describe('library wiring', () => {
  const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
  const component = read('src/components/ReadingBlock.astro');
  const lib = read('src/lib/library.ts');

  it('reads the collection that matches the requested locale', () => {
    expect(lib).toContain("getCollection('library-en'");
    expect(lib).toContain("getCollection('library'");
  });

  it('drops drafts before rendering', () => {
    expect(lib).toMatch(/!s\.data\.draft/);
  });

  it('resolves every tile href through withBase', () => {
    // A raw template string would skip the base prefix and break a sub-path deploy.
    expect(lib).toContain('withBase(');
    expect(component).not.toContain('href={`');
  });

  it('mounts on both locales of /library/', () => {
    expect(read('src/pages/library.astro')).toContain('<ReadingBlock');
    expect(read('src/pages/en/library.astro')).toContain('<ReadingBlock');
  });

  it('mounts on both locales of the homepage bento', () => {
    expect(read('src/pages/index.astro')).toContain('<ReadingBlock');
    expect(read('src/pages/en/index.astro')).toContain('<ReadingBlock');
  });
});
