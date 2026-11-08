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
  html: string;
  nodes: Array<{ id: string; section: string }>;
}

const pages = new Map<string, Page>();

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
  /<div[^>]*id="kg-legend"[^>]*>[\s\S]*?<\/div>/.exec(doc)?.[0] ?? '';

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
}

function chips(block: string): Chip[] {
  const raw = block.match(/<button[^>]*class="kg-chip"[^>]*>[\s\S]*?<\/button>/g) ?? [];
  return raw.map((chip) => ({
    preset: /data-kg-preset="([^"]*)"/.exec(chip)?.[1] ?? '',
    count: text(/class="kg-chip-count"[^>]*>([\s\S]*?)<\/span>/.exec(chip)?.[1] ?? ''),
  }));
}

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const file of PAGES) {
    const path = resolve(DIST, file);
    if (!existsSync(path)) throw new Error(`built page missing: ${file}`);
    const html = readFileSync(path, 'utf8');
    const payload = /<script[^>]*id="kg-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    pages.set(file, { html, nodes: JSON.parse(payload).nodes });
  }
});

const SECTIONS = Object.keys(GRAPH_SECTION_COLORS);

describe('graph legend and chip counts (built HTML)', () => {
  for (const file of PAGES) {
    const page = () => pages.get(file)!;

    it(`${file}: the colour legend ships server-rendered, one item per section`, () => {
      const block = legendBlock(page().html);
      expect(block, 'legend block').not.toBe('');
      const items = legendItems(block);
      // Before the fix this was 0: the server shipped `<div id="kg-legend">`
      // with no children and the client filled it after hydration.
      expect(items.length).toBe(SECTIONS.length);
      // Same order and same labels as the constant the graph paints with.
      expect(items.map((it) => it.name)).toEqual(SECTIONS);
    });

    it(`${file}: every legend item carries a label and a count of its own`, () => {
      const items = legendItems(legendBlock(page().html));
      for (const item of items) {
        expect(item.text, 'legend item text').not.toBe('');
        expect(item.name, 'legend name').not.toBe('');
        expect(item.count, `legend count for ${item.name}`).toMatch(/^\d+$/);
      }
    });

    it(`${file}: legend counts match the nodes that shipped`, () => {
      // The legend's count is `nodes.filter(n => n.section === key).length` on
      // the server (KnowledgeGraph.astro:222-226); the same `nodes` ride along
      // in `#kg-data`, so the rendered number is checkable, not just non-empty.
      const perSection = new Map<string, number>();
      for (const n of page().nodes) {
        perSection.set(n.section, (perSection.get(n.section) ?? 0) + 1);
      }
      for (const item of legendItems(legendBlock(page().html))) {
        expect(Number(item.count), `legend count for ${item.name}`).toBe(
          perSection.get(item.name) ?? 0
        );
      }
    });

    it(`${file}: every quick-filter chip ships its count, not an empty span`, () => {
      const block = presetsBlock(page().html);
      expect(block, 'presets block').not.toBe('');
      const all = chips(block);
      expect(all.length).toBe(6);
      for (const chip of all) {
        expect(chip.count, `chip "${chip.preset || 'all'}" count`).toMatch(/^\d+$/);
      }
      // The counts are `presetCounts` from `nodeKindOf` (KnowledgeGraph.astro:231-235),
      // a pure function of the ids already in the payload. The `?? 0` fallback in
      // the markup keeps an empty span from rendering; this check makes that
      // fallback visible instead of silent.
      const perKind = new Map<string, number>();
      for (const n of page().nodes) {
        const kind = nodeKindOf(n.id);
        perKind.set(kind, (perKind.get(kind) ?? 0) + 1);
      }
      for (const chip of all) {
        const expected = chip.preset === '' ? page().nodes.length : (perKind.get(chip.preset) ?? 0);
        expect(Number(chip.count), `chip "${chip.preset || 'all'}" count`).toBe(expected);
      }
    });
  }
});
