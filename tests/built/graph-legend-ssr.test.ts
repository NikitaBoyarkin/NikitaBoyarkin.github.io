// The graph's colour legend and quick-filter counts, against the REAL built output.
//
// Why this file exists: both used to be built by the client script at init. The
// server shipped the `<div id="kg-legend">` and the six `.kg-chip` buttons empty,
// so the control bar grew by ~72px once the JS filled it and pushed the board
// down — CLS 0.138 on /graph/, the only deterministic Lighthouse failure.
// `3a46d41` moved the markup server-side (`legendItems` / `presetCounts` in
// KnowledgeGraph.astro); this test is the ratchet that keeps it there. It is
// invisible to tests/lib — only dist/ can hold a server-rendered node still.
//
// The counts are checked against the same `#kg-data` payload the client reads,
// not merely against "some number", so a silent fallback to `0` (the `?? 0` in
// the chip markup) fails here instead of widening the row again.
//
// Requires `bun run build` first (reads dist/*.html).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GRAPH_SECTION_COLORS } from '../../src/lib/graph';
import { nodeKindOf } from '../../src/lib/graph-tooltip';

const DIST = resolve(__dirname, '../../dist');

const PAGES = ['graph/index.html', 'en/graph/index.html'] as const;

interface Page {
  key: string;
  html: string;
  nodes: Array<{ id: string; section: string }>;
}

/** One server-rendered instance per section on /graph/ (projects, glossary,
 *  articles). The legend and the quick-filter counts are per instance — each
 *  graph paints its own sections and counts its own nodes — so every assertion
 *  below runs inside one instance's slice, never across the whole page. */
const pages = new Map<string, Page[]>();

/** The built markup is one long line; text nodes may carry entities. */
const text = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** The legend block; it contains spans and labels only, so the first `</div>` closes it. */
const legendBlock = (doc: string) =>
  /<div[^>]*data-kg="legend"[^>]*>[\s\S]*?<\/div>/.exec(doc)?.[0] ?? '';

/** The quick-filter row; it contains buttons and spans only. */
const presetsBlock = (doc: string) =>
  /<div[^>]*class="kg-presets"[^>]*>[\s\S]*?<\/div>/.exec(doc)?.[0] ?? '';

interface LegendItem {
  name: string;
  count: string;
  text: string;
}

function legendItems(block: string): LegendItem[] {
  const raw = block.match(
    /<span class="kg-legend-item"[\s\S]*?(?=<span class="kg-legend-item"|<\/div>)/g
  );
  return (raw ?? []).map((item) => ({
    name: text(/class="kg-legend-name"[^>]*>([\s\S]*?)<\/span>/.exec(item)?.[1] ?? ''),
    count: text(/class="kg-legend-count"[^>]*>([\s\S]*?)<\/span>/.exec(item)?.[1] ?? ''),
    text: text(item),
  }));
}

interface Chip {
  preset: string;
  count: string;
  hidden: boolean;
}

function chips(block: string): Chip[] {
  const raw = block.match(/<button[^>]*class="kg-chip"[^>]*>[\s\S]*?<\/button>/g) ?? [];
  return raw.map((chip) => ({
    preset: /data-kg-preset="([^"]*)"/.exec(chip)?.[1] ?? '',
    count: text(/class="kg-chip-count"[^>]*>([\s\S]*?)<\/span>/.exec(chip)?.[1] ?? ''),
    hidden: /\shidden(?=[\s>])/.test(chip),
  }));
}

function instancesOf(html: string): Page[] {
  const roots = [...html.matchAll(/<div\b[^>]*data-kg="root"[^>]*>/g)];
  return roots.map((m, i) => {
    const inst = html.slice(m.index!, i + 1 < roots.length ? roots[i + 1].index! : html.length);
    const payload = /<script[^>]*data-kg="data"[^>]*>([\s\S]*?)<\/script>/.exec(inst)?.[1] ?? '';
    return {
      key: /data-kg-instance="([^"]*)"/.exec(m[0])?.[1] ?? '',
      html: inst,
      nodes: JSON.parse(payload).nodes,
    };
  });
}

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const file of PAGES) {
    const path = resolve(DIST, file);
    if (!existsSync(path)) throw new Error(`built page missing: ${file}`);
    pages.set(file, instancesOf(readFileSync(path, 'utf8')));
  }
});

const SECTIONS = Object.keys(GRAPH_SECTION_COLORS);
/** `/en/graph/` prints English names; everything else prints Russian. */
const langOf = (file: string) => (file.startsWith('en/') ? 'en' : 'ru') as 'ru' | 'en';

/** The reader-facing names, written out literally on purpose. Comparing the
 *  markup against `labelForSection` (the function the component renders from)
 *  is a tautology: a regression back to raw slugs would agree with itself.
 *  This table is the expected screen text, independent of the implementation. */
const NAMES: Record<'ru' | 'en', Record<string, string>> = {
  ru: {
    root: 'Ядро',
    projects: 'Проекты',
    articles: 'Статьи',
    glossary: 'Словарь',
    topic: 'Темы',
    talks: 'Доклады',
    track: 'Треки',
    theme: 'Темы докладов',
  },
  en: {
    root: 'Core',
    projects: 'Projects',
    articles: 'Articles',
    glossary: 'Glossary',
    topic: 'Topics',
    talks: 'Talks',
    track: 'Tracks',
    theme: 'Talk themes',
  },
};

describe('graph legend and chip counts (built HTML)', () => {
  for (const file of PAGES) {
    const instances = () => pages.get(file)!;

    it(`${file}: renders three section graphs, in order`, () => {
      expect(instances().map((p) => p.key)).toEqual(['projects', 'glossary', 'articles']);
    });

    for (const key of ['projects', 'glossary', 'articles'] as const) {
      const page = () => {
        const found = instances().find((p) => p.key === key);
        if (!found) throw new Error(`${file}: no instance keyed ${key}`);
        return found;
      };

      it(`${file}:${key}: the colour legend ships server-rendered, one item per section`, () => {
        const block = legendBlock(page().html);
        expect(block, 'legend block').not.toBe('');
        const items = legendItems(block);
        // Sections present in THIS instance's payload, in palette order — not
        // every key in the palette: the talks graph's `track`/`theme` sections
        // live in the same map and would otherwise ship as rows that toggle
        // nothing, and a graph with no glossary terms has no glossary row.
        const present = SECTIONS.filter((s) => page().nodes.some((n: any) => n.section === s));
        // Before the fix this was 0: the server shipped `<div id="kg-legend">`
        // with no children and the client filled it after hydration.
        expect(items.length).toBe(present.length);
        // Same order as the palette, but the *name* is the reader-facing one:
        // raw slugs (`root`, `articles`) shipped as «Root», «Articles» on the
        // Russian page, and this assertion used to pin that defect in place.
        expect(items.map((it) => it.name)).toEqual(present.map((s) => NAMES[langOf(file)][s]));
        // No legend row may print its raw slug: that is the defect itself.
        for (const it of items) {
          expect(present, `${file}:${key}: legend name "${it.name}" is a raw section key`).not.toContain(
            it.name,
          );
        }
      });

      it(`${file}:${key}: every legend item carries a label and a count of its own`, () => {
        const items = legendItems(legendBlock(page().html));
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          expect(item.text, 'legend item text').not.toBe('');
          expect(item.name, 'legend name').not.toBe('');
          expect(item.count, `legend count for ${item.name}`).toMatch(/^\d+$/);
        }
      });

      it(`${file}:${key}: legend counts match the nodes that shipped in this instance`, () => {
        // The legend's count is `nodes.filter(n => n.section === key).length` on
        // the server (KnowledgeGraph.astro); the same `nodes` ride along in the
        // instance's payload, so the rendered number is checkable, not just
        // non-empty. Counting the whole page instead would mix three graphs.
        const perSection = new Map<string, number>();
        for (const n of page().nodes) {
          perSection.set(n.section, (perSection.get(n.section) ?? 0) + 1);
        }
        // The row is keyed by section; the label is its display name, so map back
        // through the literal table above (not `labelForSection` — same function,
        // same regression, no test).
        const names = NAMES[langOf(file)];
        const sectionByName = new Map(
          [...perSection.keys()].map((s) => [names[s] ?? s, s])
        );
        for (const item of legendItems(legendBlock(page().html))) {
          const section = sectionByName.get(item.name) ?? item.name;
          expect(Number(item.count), `legend count for ${item.name}`).toBe(
            perSection.get(section) ?? 0
          );
        }
      });

      it(`${file}:${key}: every quick-filter chip ships its count, not an empty span`, () => {
        const block = presetsBlock(page().html);
        expect(block, 'presets block').not.toBe('');
        const all = chips(block);
        expect(all.length).toBe(6);
        for (const chip of all) {
          expect(chip.count, `chip "${chip.preset || 'all'}" count`).toMatch(/^\d+$/);
        }
        // The counts are `presetCounts` from `nodeKindOf` (KnowledgeGraph.astro),
        // a pure function of the ids already in this instance's payload. The
        // `?? 0` fallback in the markup keeps an empty span from rendering; this
        // check makes that fallback visible instead of silent.
        const perKind = new Map<string, number>();
        for (const n of page().nodes) {
          const kind = nodeKindOf(n.id);
          perKind.set(kind, (perKind.get(kind) ?? 0) + 1);
        }
        for (const chip of all) {
          const expected = chip.preset === '' ? page().nodes.length : (perKind.get(chip.preset) ?? 0);
          expect(Number(chip.count), `chip "${chip.preset || 'all'}" count`).toBe(expected);
          // A zero-count chip is hidden rather than removed: the row stays six
          // chips wide, but a filter that matches nothing is not offered.
          expect(chip.hidden, `chip "${chip.preset || 'all'}" hidden at ${expected}`).toBe(expected === 0);
        }
      });
    }
  }
});
