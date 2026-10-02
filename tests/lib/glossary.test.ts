// Glossary (Словарь) — content invariants plus linker unit tests.
//
// The parity / resolution / alias checks read the real `src/content/glossary`
// and `src/content/glossary-en` directories, but every one of them is guarded so
// a checkout without terms still passes (the pure tests always run). The linker
// tests drive the pure helpers with hand-built indexes, so they never depend on
// the on-disk content. No `astro:content` import — disk access goes through
// `node:fs` + lib/glossary's own loader.
import { describe, it, expect } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildTagFacets,
  CATEGORY_LABELS,
  GLOSSARY_CATEGORIES,
  computeBacklinks,
  loadGlossaryFromDisk,
  parseRelatedPath,
  type BacklinkSource,
  type GlossaryLang,
} from '../../src/lib/glossary';
import {
  findTermOccurrence,
  glossaryLinker,
  type GlossaryIndex,
  type GlossaryLinkerContext,
  type GlossaryLinkNode,
  type GlossaryReplacement,
  type TermMatcher,
} from '../../src/lib/glossary-linker';

const ROOT = join(__dirname, '..', '..');
const CONTENT = join(ROOT, 'src', 'content');

function mdFiles(dir: string): string[] {
  const full = join(CONTENT, dir);
  return existsSync(full) ? readdirSync(full).filter((f) => f.endsWith('.md')) : [];
}

function slugSet(dir: string): Set<string> {
  return new Set(mdFiles(dir).map((f) => f.replace(/\.md$/, '')));
}

// Content is optional: a fresh clone with no terms still runs every pure test.
const hasContent = mdFiles('glossary').length > 0 && mdFiles('glossary-en').length > 0;

function contentSuite(name: string, fn: () => void): void {
  if (hasContent) describe(name, fn);
  else describe.skip(name, fn);
}

const LANGS: GlossaryLang[] = ['ru', 'en'];

// ---------------------------------------------------------------------------
// Tag facets (pure — they drive the glossary filter chips' counts).
// ---------------------------------------------------------------------------

describe('buildTagFacets', () => {
  it('returns nothing for an empty list', () => {
    expect(buildTagFacets([])).toEqual([]);
  });

  it('counts a tag once per term regardless of array order', () => {
    const facets = buildTagFacets([
      { tags: ['ab-testing', 'statistics'] },
      { tags: ['statistics', 'ab-testing'] },
      { tags: ['statistics'] },
      { tags: [] },
    ]);
    expect(facets).toEqual([
      { tag: 'statistics', count: 3 },
      { tag: 'ab-testing', count: 2 },
    ]);
  });

  it('breaks count ties alphabetically', () => {
    expect(buildTagFacets([{ tags: ['retention', 'cohort-analysis'] }])).toEqual([
      { tag: 'cohort-analysis', count: 1 },
      { tag: 'retention', count: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Content invariants (guarded on real content).
// ---------------------------------------------------------------------------

contentSuite('glossary content — RU/EN parity', () => {
  it('has identical slug sets in glossary and glossary-en', () => {
    expect([...slugSet('glossary')].sort()).toEqual([...slugSet('glossary-en')].sort());
  });

  it('gives every term at least one related entry', () => {
    for (const lang of LANGS) {
      for (const term of loadGlossaryFromDisk(ROOT, lang)) {
        expect(term.related.length, `${lang}:${term.slug}`).toBeGreaterThan(0);
      }
    }
  });

  it('assigns every term a known category', () => {
    for (const lang of LANGS) {
      for (const term of loadGlossaryFromDisk(ROOT, lang)) {
        expect(GLOSSARY_CATEGORIES, `${lang}:${term.slug}`).toContain(term.category);
      }
    }
  });
});

contentSuite('glossary content — related targets resolve', () => {
  it('resolves every related path to a real slug', () => {
    const glossary = { ru: slugSet('glossary'), en: slugSet('glossary-en') };
    // A related target may live in either locale (the same convention the graph
    // invariants use), so posts/projects resolve against both directories.
    const posts = new Set([...slugSet('posts'), ...slugSet('posts-en')]);
    const projects = new Set([...slugSet('projects'), ...slugSet('projects-en')]);

    for (const lang of LANGS) {
      for (const term of loadGlossaryFromDisk(ROOT, lang)) {
        for (const raw of term.related) {
          if (/^https?:\/\//.test(raw)) continue; // external references are allowed
          const parsed = parseRelatedPath(raw);
          expect(parsed, `${lang}:${term.slug} unparsable related "${raw}"`).not.toBeNull();
          if (!parsed) continue;
          // A `/glossary/x/` target must exist in this locale's glossary set;
          // post/project targets just need to exist somewhere.
          const pool =
            parsed.kind === 'glossary'
              ? glossary[lang]
              : parsed.kind === 'post'
                ? posts
                : projects;
          expect(pool.has(parsed.slug), `${lang}:${term.slug} → unresolved ${raw}`).toBe(true);
        }
      }
    }
  });
});

contentSuite('glossary content — alias uniqueness', () => {
  it('never lets two different terms claim the same alias (case-insensitive)', () => {
    for (const lang of LANGS) {
      const owner = new Map<string, string>();
      for (const term of loadGlossaryFromDisk(ROOT, lang)) {
        for (const alias of term.aka) {
          const key = alias.toLowerCase();
          const prev = owner.get(key);
          expect(
            prev === undefined || prev === term.slug,
            `${lang}: alias "${alias}" claimed by ${prev} and ${term.slug}`,
          ).toBe(true);
          owner.set(key, term.slug);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Pure helpers — no content dependency.
// ---------------------------------------------------------------------------

describe('glossary categories', () => {
  it('labels every category in both locales', () => {
    for (const category of GLOSSARY_CATEGORIES) {
      expect(CATEGORY_LABELS[category].ru, category).toBeTruthy();
      expect(CATEGORY_LABELS[category].en, category).toBeTruthy();
    }
  });
});

describe('parseRelatedPath', () => {
  it('parses glossary, post and project paths', () => {
    expect(parseRelatedPath('/glossary/cuped/')).toEqual({ kind: 'glossary', slug: 'cuped' });
    expect(parseRelatedPath('/posts/x/')).toEqual({ kind: 'post', slug: 'x' });
    expect(parseRelatedPath('/projects/volta/')).toEqual({ kind: 'project', slug: 'volta' });
  });

  it('rejects external URLs and off-schema paths', () => {
    expect(parseRelatedPath('https://example.com')).toBeNull();
    expect(parseRelatedPath('/topics/sql/')).toBeNull();
    expect(parseRelatedPath('/glossary/')).toBeNull();
  });
});

describe('findTermOccurrence — word boundaries', () => {
  it('rejects matches embedded inside a longer word', () => {
    expect(findTermOccurrence('sp-value', 'p-value', false)).toBe(-1);
    expect(findTermOccurrence('cupeds', 'cuped', false)).toBe(-1);
    expect(findTermOccurrence('snorth star', 'north star', false)).toBe(-1);
  });

  it('accepts a standalone term', () => {
    expect(findTermOccurrence('the p-value is 0.5', 'p-value', false)).toBe(4);
    expect(findTermOccurrence('a cuped test', 'cuped', false)).toBe(2);
  });

  it('returns -1 for an empty needle', () => {
    expect(findTermOccurrence('anything', '', false)).toBe(-1);
  });
});

describe('findTermOccurrence — case sensitivity', () => {
  it('matches an all-caps abbreviation case-sensitively', () => {
    expect(findTermOccurrence('CUPED wins', 'CUPED', true)).toBe(0);
    expect(findTermOccurrence('cuped wins', 'CUPED', true)).toBe(-1);
  });

  it('matches a plain term case-insensitively', () => {
    expect(findTermOccurrence('strong RETENTION here', 'retention', false)).toBe(7);
    expect(findTermOccurrence('Retention is key', 'retention', false)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Linker — driven with a fake context and hand-built index.
// ---------------------------------------------------------------------------

const pageURL = (slug: string, en = false): URL =>
  new URL(`file:///project/src/content/${en ? 'glossary-en' : 'glossary'}/${slug}.md`);

const matcher = (term: string, slug: string, caseSensitive = false): TermMatcher => ({
  term,
  slug,
  caseSensitive,
});

const ruIndex = (...m: TermMatcher[]): GlossaryIndex => ({ ru: m, en: [] });

interface CtxSpy {
  ctx: GlossaryLinkerContext;
  replaced: GlossaryReplacement[][];
}

function spyCtx(fileURL: URL | undefined, parentType?: string): CtxSpy {
  const replaced: GlossaryReplacement[][] = [];
  return {
    replaced,
    ctx: {
      fileURL,
      parent: () => (parentType ? { type: parentType } : undefined),
      replaceNode: (_node, replacement) => replaced.push(replacement),
    },
  };
}

function pluginFor(fileURL: URL | undefined, index: GlossaryIndex) {
  return glossaryLinker({ index })({ fileURL });
}

describe('glossaryLinker — first occurrence', () => {
  const index = ruIndex(matcher('CUPED', 'cuped', true));

  it('links only the first occurrence in a text node', () => {
    const url = pageURL('srm');
    const plugin = pluginFor(url, index);
    expect(plugin).not.toBe(false);
    if (plugin === false) return;

    const value = 'CUPED then CUPED again';
    const { ctx, replaced } = spyCtx(url);
    plugin.text!({ type: 'text', value }, ctx);

    expect(replaced).toHaveLength(1);
    const parts = replaced[0];
    const links = parts.filter((p): p is GlossaryLinkNode => p.type === 'link');
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('/glossary/cuped/');
    expect(links[0].children[0].value).toBe('CUPED');
    const rebuilt = parts
      .map((p) => (p.type === 'text' ? p.value : p.children[0].value))
      .join('');
    expect(rebuilt).toBe(value);
  });

  it('does not link a case-sensitive abbreviation written in lowercase', () => {
    const url = pageURL('srm');
    const plugin = pluginFor(url, index);
    if (plugin === false) return;
    const { ctx, replaced } = spyCtx(url);
    plugin.text!({ type: 'text', value: 'the cuped method' }, ctx);
    expect(replaced).toHaveLength(0);
  });

  it('links a plain term case-insensitively', () => {
    const url = pageURL('srm');
    const plugin = pluginFor(url, ruIndex(matcher('Retention', 'retention')));
    if (plugin === false) return;
    const { ctx, replaced } = spyCtx(url);
    plugin.text!({ type: 'text', value: 'strong RETENTION here' }, ctx);
    expect(replaced).toHaveLength(1);
    const links = replaced[0].filter((p): p is GlossaryLinkNode => p.type === 'link');
    expect(links[0].url).toBe('/glossary/retention/');
  });
});

describe('glossaryLinker — own page and parent context', () => {
  const index = ruIndex(matcher('CUPED', 'cuped', true));

  it('never links a term on its own page', () => {
    const url = pageURL('cuped');
    const plugin = pluginFor(url, index);
    if (plugin === false) return;
    const { ctx, replaced } = spyCtx(url);
    plugin.text!({ type: 'text', value: 'CUPED CUPED' }, ctx);
    expect(replaced).toHaveLength(0);
  });

  it('links the same term from another glossary page', () => {
    const url = pageURL('srm');
    const plugin = pluginFor(url, index);
    if (plugin === false) return;
    const { ctx, replaced } = spyCtx(url);
    plugin.text!({ type: 'text', value: 'CUPED' }, ctx);
    expect(replaced).toHaveLength(1);
  });

  it('skips text inside headings and existing links', () => {
    const url = pageURL('srm');
    for (const parentType of ['heading', 'link']) {
      const plugin = pluginFor(url, index);
      if (plugin === false) return;
      const { ctx, replaced } = spyCtx(url, parentType);
      plugin.text!({ type: 'text', value: 'CUPED' }, ctx);
      expect(replaced, `parent=${parentType}`).toHaveLength(0);
    }
  });

  it('replaces when the parent is neither a heading nor a link', () => {
    const url = pageURL('srm');
    const plugin = pluginFor(url, index);
    if (plugin === false) return;
    const { ctx, replaced } = spyCtx(url, 'paragraph');
    plugin.text!({ type: 'text', value: 'CUPED' }, ctx);
    expect(replaced).toHaveLength(1);
  });
});

describe('glossaryLinker — locale routing and scope', () => {
  it('points EN glossary links at /en/glossary/<slug>/', () => {
    const index: GlossaryIndex = {
      ru: [matcher('CUPED', 'cuped', true)],
      en: [matcher('CUPED', 'cuped-variance', true)],
    };
    const url = pageURL('srm', true);
    const plugin = pluginFor(url, index);
    if (plugin === false) return;
    const { ctx, replaced } = spyCtx(url);
    plugin.text!({ type: 'text', value: 'CUPED' }, ctx);
    const links = replaced[0].filter((p): p is GlossaryLinkNode => p.type === 'link');
    expect(links[0].url).toBe('/en/glossary/cuped-variance/');
  });

  it('returns false for a missing fileURL', () => {
    expect(pluginFor(undefined, { ru: [], en: [] })).toBe(false);
  });

  it('returns false outside the glossary directories', () => {
    const empty = { ru: [], en: [] };
    expect(pluginFor(new URL('file:///project/src/pages/index.astro'), empty)).toBe(false);
    expect(pluginFor(new URL('file:///project/src/content/posts/x.md'), empty)).toBe(false);
  });

  it('returns a plugin inside the glossary directories', () => {
    const plugin = pluginFor(pageURL('srm'), { ru: [], en: [] });
    expect(plugin).not.toBe(false);
    if (plugin !== false) expect(plugin.name).toBe('glossary-linker');
  });
});

// ---------------------------------------------------------------------------
// computeBacklinks — word-boundary, case-insensitive matching.
// ---------------------------------------------------------------------------

describe('computeBacklinks', () => {
  const term = { slug: 'north-star-metric', title: 'North Star Metric', aka: ['north star'] };
  const source = (over: Partial<BacklinkSource>): BacklinkSource => ({
    kind: 'post',
    slug: 'x',
    href: '/posts/x/',
    title: '',
    body: '',
    ...over,
  });

  it('finds a source that mentions an alias', () => {
    const links = computeBacklinks([term], [
      source({ slug: 'a', body: 'our north star guides the team' }),
    ]);
    expect(links['north-star-metric'].map((s) => s.slug)).toEqual(['a']);
  });

  it('matches case-insensitively', () => {
    const links = computeBacklinks([term], [
      source({ slug: 'b', title: 'NORTH STAR METRIC' }),
    ]);
    expect(links['north-star-metric'].map((s) => s.slug)).toEqual(['b']);
  });

  it('does not match a word the alias is embedded in', () => {
    const links = computeBacklinks([term], [
      source({ slug: 'c', body: 'a northern star appeared' }), // "north star" absent
      source({ slug: 'd', body: 'north stars are bright' }), // "north star" + "s"
    ]);
    expect(links['north-star-metric']).toEqual([]);
  });

  it('returns an entry for every term, even with no sources', () => {
    const links = computeBacklinks([term, { slug: 'cuped', title: 'CUPED', aka: [] }], []);
    expect(Object.keys(links).sort()).toEqual(['cuped', 'north-star-metric']);
    expect(links['cuped']).toEqual([]);
  });
});
