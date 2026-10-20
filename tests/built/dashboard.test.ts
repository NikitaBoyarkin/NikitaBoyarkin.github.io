// Built-output contract for the homepage dashboard.
//
// This is the guard that `tests/lib/dashboard.test.ts` cannot be. That file runs
// under `bun test`, where `import.meta.url` is the *source* path — so a
// module-relative `public/` root resolves correctly there while resolving to
// `dist/public/` once Astro bundles the module into `dist/.prerender/chunks/`.
// The first build of this feature died exactly that way with every unit
// assertion green. What is asserted here is the emitted artefact, not the code
// that made it.
//
// Two claims:
//   1. every href the dashboard prints resolves to a file in `dist/` — a card
//      that points at nothing is worse than a missing card;
//   2. the scan is exhaustive in the direction that matters: every demo app and
//      every diagram page that reached `dist/` is named by a row. A scan that
//      silently skips one is invisible otherwise — the whole reason those 43
//      pages needed an index is that their absence is silent.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');

interface Row {
  title: string;
  href: string;
  kind: string;
  external?: boolean;
  /** Set on an aggregating row — the arcade hub stands for its games. */
  count?: number;
}
interface Card {
  id: string;
  href?: string;
  count: number;
  countLabel: string;
  children: Row[];
}
interface Dashboard {
  locale: 'ru' | 'en';
  sections: Card[];
  surfaces: Array<{ key: string; href?: string }>;
  metrics: Array<{ value: string; label: string; href: string }>;
}

let index: Record<'ru' | 'en', Dashboard>;

/** A printed href resolved to the file that must exist to serve it. */
function distFile(href: string): string {
  const rel = href.replace(/^\//, '');
  if (rel.endsWith('/')) return resolve(DIST, rel, 'index.html');
  return /\.\w+$/.test(rel) ? resolve(DIST, rel) : resolve(DIST, rel, 'index.html');
}

function card(locale: 'ru' | 'en', id: string): Card {
  const found = index[locale].sections.find((section) => section.id === id);
  if (!found) throw new Error(`${locale}: no "${id}" card in dist/dashboard-index.json`);
  return found;
}

beforeAll(() => {
  const file = resolve(DIST, 'dashboard-index.json');
  if (!existsSync(file)) {
    throw new Error('dist/dashboard-index.json missing — run `bun run build` first');
  }
  index = JSON.parse(readFileSync(file, 'utf8'));
});

describe('dashboard card set', () => {
  it('ships both locales, with the RU-only topics card dropped from EN', () => {
    expect(index.ru.locale).toBe('ru');
    expect(index.en.locale).toBe('en');
    expect(index.ru.sections).toHaveLength(8);
    expect(index.en.sections).toHaveLength(7);
    expect(index.ru.sections.map((s) => s.id)).toContain('topics');
    expect(index.en.sections.map((s) => s.id)).not.toContain('topics');
  });

  it('keeps the JSON inside the 120 KB budget', () => {
    const bytes = readFileSync(resolve(DIST, 'dashboard-index.json')).byteLength;
    expect(bytes).toBeLessThan(120 * 1024);
  });

  it('gives the tools card no href — no index exists to point at', () => {
    expect(card('ru', 'tools').href).toBeUndefined();
    expect(card('en', 'tools').href).toBeUndefined();
  });

  it('gives the search surface no href — it opens the island, it is not a URL', () => {
    for (const locale of ['ru', 'en'] as const) {
      const search = index[locale].surfaces.find((s) => s.key === 'search')!;
      expect(search).toBeDefined();
      expect(search.href).toBeUndefined();
    }
  });
});

describe('every printed href resolves in dist/', () => {
  it('resolves every card href, both locales', () => {
    for (const locale of ['ru', 'en'] as const) {
      for (const section of index[locale].sections) {
        if (section.href === undefined) continue;
        expect(existsSync(distFile(section.href)), `${locale}/${section.id}: ${section.href}`).toBe(
          true,
        );
      }
    }
  });

  it('resolves every card row, both locales', () => {
    for (const locale of ['ru', 'en'] as const) {
      for (const section of index[locale].sections) {
        for (const row of section.children) {
          expect(
            existsSync(distFile(row.href)),
            `${locale}/${section.id}: row "${row.title}" -> ${row.href}`,
          ).toBe(true);
        }
      }
    }
  });

  it('resolves every metric and every linked surface', () => {
    for (const locale of ['ru', 'en'] as const) {
      for (const metric of index[locale].metrics) {
        expect(existsSync(distFile(metric.href)), `${locale}: metric ${metric.label}`).toBe(true);
      }
      for (const surface of index[locale].surfaces) {
        if (surface.href === undefined) continue;
        expect(existsSync(distFile(surface.href)), `${locale}: surface ${surface.key}`).toBe(true);
      }
    }
  });
});

describe('the scan is exhaustive over what reached dist/', () => {
  /** Artefacts that actually shipped, read from the built tree. */
  function shippedDemos(): string[] {
    const dir = resolve(DIST, 'demos');
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(resolve(dir, entry.name, 'index.html')))
      .map((entry) => entry.name)
      .sort();
  }

  function shippedDiagrams(): string[] {
    return readdirSync(resolve(DIST, 'diagrams'))
      .filter((name) => name.endsWith('.html'))
      .sort();
  }

  it('names every demo app that shipped, and nothing that did not', () => {
    const rows = card('ru', 'tools')
      .children.filter((row) => row.kind === 'demo')
      .map((row) => row.href)
      .sort();
    expect(rows).toEqual(shippedDemos().map((name) => `/demos/${name}/`).sort());
  });

  it('names every diagram page that shipped', () => {
    const rows = card('ru', 'tools')
      .children.filter((row) => row.kind === 'diagram')
      .map((row) => row.href)
      .sort();
    expect(rows).toEqual(shippedDiagrams().map((name) => `/diagrams/${name}`).sort());
  });

  it('marks the arcade row with the number of games that shipped', () => {
    const arcade = card('ru', 'tools').children.find((row) => row.kind === 'game')!;
    const games = readdirSync(resolve(DIST, 'games')).filter((name) => name.endsWith('.svg')).length;
    expect(arcade.href).toBe('/games/');
    expect(arcade.count).toBe(games);
  });

  it('advertises 54 interactive apps, counted from the shipped files', () => {
    const apps = shippedDemos().length + shippedDiagrams().length;
    const games = readdirSync(resolve(DIST, 'games')).filter((name) => name.endsWith('.svg')).length;
    expect(card('ru', 'tools').count).toBe(apps + games);
    expect(card('ru', 'tools').count).toBe(54);
    // The number is locale-independent: the same files serve both dashboards.
    expect(card('en', 'tools').count).toBe(54);
  });

  it('names every content card row from a real built page', () => {
    // The RU and EN rows must not cross: an EN dashboard linking a Russian post
    // is the drift `explorer-surface.md` §2 warns about.
    for (const row of card('en', 'writing').children) {
      expect(row.href.startsWith('/en/'), `EN writing row ${row.href}`).toBe(true);
    }
    for (const row of card('ru', 'writing').children) {
      expect(row.href.startsWith('/en/'), `RU writing row ${row.href}`).toBe(false);
    }
  });
});
