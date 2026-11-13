// The section registry against the routes it claims to describe.
//
// Why this file exists: `src/lib/sections.ts` is the site's ONE list of
// top-level sections — the drawer, `/navigation/`, the per-section OG banner and
// `sectionForPath` all read it — and nothing tested it. The only other place the
// list appeared was a hand-written 14-row copy of the drawer in
// `tests/built/homepage-gate.test.ts`, so a new section could ship with the
// registry edited and every test still green.
//
// Three things are guarded here:
//   1. the registry's own shape: 14 entries, unique keys, every icon defined;
//   2. every `href` points at a route the site actually builds — checked
//      against `src/pages/en/` on disk, because `topics` and `repo-audit` are
//      RU-only pairs and a blanket "every section has an /en/ twin" rule would
//      be false;
//   3. `sectionForPath` resolves both locales, prefers the longest prefix, and
//      refuses to treat `home` as a prefix of every URL.
import { describe, it, expect } from 'bun:test';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { SECTIONS, sectionForPath } from '../../src/lib/sections';
import { ICON } from '../../src/lib/icons';

const EN_PAGES = resolve(__dirname, '../../src/pages/en');

const stripSlashes = (href: string) => href.replace(/^\/+|\/+$/g, '');

/** Registry href → the absolute path a visitor lands on. */
const asPath = (href: string) => {
  const rel = stripSlashes(href);
  return rel ? `/${rel}/` : '/';
};

/**
 * Whether `src/pages/en/` builds an EN route for a RU section href.
 *
 * Route shape varies: `about.astro` is flat, `projects/index.astro` is a
 * directory, and `writing/[...page].astro` has no `index` at all — hence the
 * three probes. Read from disk, not from a list of assumed twins.
 */
function enTwinBuilt(ruHref: string): boolean {
  const rel = stripSlashes(ruHref);
  if (rel === '') return existsSync(join(EN_PAGES, 'index.astro'));
  if (existsSync(join(EN_PAGES, `${rel}.astro`))) return true;
  const dir = join(EN_PAGES, rel);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  return readdirSync(dir).some((file) => file.endsWith('.astro'));
}

describe('section registry (src/lib/sections.ts)', () => {
  it('declares fourteen sections', () => {
    expect(SECTIONS.length).toBe(14);
  });

  it('gives every section a unique key', () => {
    const keys = SECTIONS.map((section) => section.key);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(duplicates, `duplicate section keys: ${duplicates.join(', ')}`).toEqual([]);
    expect(new Set(keys).size).toBe(SECTIONS.length);
  });

  it('resolves every icon to a glyph in src/lib/icons.ts', () => {
    const missing = SECTIONS.filter((section) => !(section.icon in ICON)).map(
      (section) => `${section.key}: ${section.icon}`,
    );
    expect(missing, `sections naming an undefined icon:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it('keeps every href in the `segment/` shape, never rooted', () => {
    const malformed = SECTIONS.flatMap((section) =>
      (['ru', 'en'] as const)
        .filter(
          (lang) =>
            !section.href[lang].endsWith('/') ||
            (section.href[lang].startsWith('/') && section.href[lang] !== '/'),
        )
        .map((lang) => `${section.key}.${lang}: ${section.href[lang]}`),
    );
    expect(malformed, `hrefs outside the segment/ shape:\n  ${malformed.join('\n  ')}`).toEqual([]);
  });

  it('points EN at an /en/ twin only where one is built on disk', () => {
    for (const section of SECTIONS) {
      const rel = stripSlashes(section.href.ru);
      if (enTwinBuilt(section.href.ru)) {
        expect(
          section.href.en,
          `${section.key}: src/pages/en/${rel || 'index.astro'} builds a twin, but EN still points at the RU page`,
        ).toBe(rel ? `en/${rel}/` : 'en/');
      } else {
        expect(
          section.href.en,
          `${section.key}: no /en/ twin is built, so EN must reuse the RU href instead of 404ing`,
        ).toBe(section.href.ru);
      }
    }
  });

  it('resolves every section by both of its own hrefs', () => {
    for (const section of SECTIONS) {
      expect(
        sectionForPath(asPath(section.href.ru)),
        `${section.key}: the RU href ${section.href.ru} does not resolve back to its own section`,
      ).toBe(section.key);
      expect(
        sectionForPath(asPath(section.href.en)),
        `${section.key}: the EN href ${section.href.en} does not resolve back to its own section`,
      ).toBe(section.key);
    }
  });

  it('picks the longest matching prefix, so a nested route keeps its own section', () => {
    // `home`'s href is the empty string: it matches every URL as a prefix, so a
    // "first match wins" walk over `SECTIONS` would swallow these routes.
    expect(sectionForPath('/projects/volta/retention/')).toBe('projects');
    expect(sectionForPath('/en/projects/volta/retention/')).toBe('projects');
    expect(sectionForPath('/hire/manager/')).toBe('hire');
    expect(sectionForPath('/en/glossary/window-function/')).toBe('glossary');
    // Segment boundaries matter: `graph` must not claim `/graphics/`.
    expect(sectionForPath('/graphics/')).toBeNull();
  });

  it('matches home only on the exact root, never as a prefix', () => {
    expect(sectionForPath('/')).toBe('home');
    expect(sectionForPath('')).toBe('home');
    expect(sectionForPath('/en/')).toBe('home');
    expect(sectionForPath('/en')).toBe('home');
    expect(sectionForPath('/unknown-route/')).toBeNull();
    expect(sectionForPath('/projects/')).not.toBe('home');
  });
});
