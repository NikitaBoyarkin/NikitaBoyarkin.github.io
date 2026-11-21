// /demos/ hub contract against the REAL built HTML (dist/).
//
// The hub used to be four stacked `<h2>` + grid blocks. It is now one ARIA
// tablist (components/DemoTabs.astro → SectionTabs + SectionPanel), and every
// way that regrouping can fail is silent:
//   1. a tab id drifts from its panel, so `aria-controls` points at nothing and
//      the category becomes unreachable;
//   2. two panels render open, so categories stack under the strip again;
//   3. a panel is dropped, so a whole track of boards disappears while the tab
//      that names it still renders;
//   4. the count in a tab label stops matching the cards behind it;
//   5. the `<noscript>` reveal is lost, so a no-JS visitor sees the strip and
//      one panel out of four;
//   6. the board scan reads nothing and the page ships an empty catalogue.
//
// The expected board count is derived from `public/demos/` rather than pinned,
// so adding a board does not turn this red — losing one does.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');
const PAGES = ['/demos/index.html', '/en/demos/index.html'];
const TAB_IDS = [
  'demo-group-experiments',
  'demo-group-analytics',
  'demo-group-product',
  'demo-group-engineering',
] as const;

/** Boards that actually serve `public/demos/<slug>/index.html`. */
const BOARD_COUNT = readdirSync(resolve(ROOT, 'public', 'demos'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .filter((entry) => existsSync(resolve(ROOT, 'public', 'demos', entry.name, 'index.html'))).length;

const html = new Map<string, string>();

beforeAll(() => {
  for (const path of PAGES) {
    const file = resolve(DIST, `.${path}`);
    if (!existsSync(file)) throw new Error(`dist${path} missing — run \`bun run build\` first`);
    html.set(path, readFileSync(file, 'utf8'));
  }
});

interface ParsedPage {
  tabs: { id: string; controls: string; label: string }[];
  panels: { id: string; key: string; hidden: boolean; cards: number; hrefs: string[] }[];
}

function parse(source: string): ParsedPage {
  const tabs = [...source.matchAll(/<button[^>]*role="tab"[^>]*data-tab="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)].map(
    (match) => {
      const attrs = match[0].slice(0, match[0].indexOf('>'));
      return {
        id: match[1],
        controls: /aria-controls="([^"]+)"/.exec(attrs)?.[1] ?? '',
        label: match[2].replace(/\s+/g, ' ').trim(),
      };
    },
  );

  const panels = [...source.matchAll(/<section class="section-panel"([^>]*)>([\s\S]*?)<\/section>/g)].map(
    (match) => {
      const attrs = match[1];
      const body = match[2];
      return {
        id: /id="([^"]+)"/.exec(attrs)?.[1] ?? '',
        key: /data-panel="([^"]+)"/.exec(attrs)?.[1] ?? '',
        hidden: /\shidden(?:\s|>|$)/.test(attrs),
        cards: [...body.matchAll(/<article class="demo-card/g)].length,
        hrefs: [...body.matchAll(/href="([^"]*\/demos\/[^"]*)"/g)].map((m) => m[1]),
      };
    },
  );

  return { tabs, panels };
}

describe.each(PAGES)('demos hub tabs (%s)', (path) => {
  it('mounts exactly one dashboard with one tab per track, in taxonomy order', () => {
    const source = html.get(path)!;
    // Count wrapper elements: the bare `data-section-tabs` token also appears in
    // the bundled controller, and a second dashboard would split the strip.
    expect([...source.matchAll(/<div class="section-tabs"[^>]*data-section-tabs/g)].length).toBe(1);
    expect([...source.matchAll(/role="tablist"/g)].length).toBe(1);

    const { tabs } = parse(source);
    expect(tabs.map((tab) => tab.id)).toEqual([...TAB_IDS]);
    expect(tabs.filter((tab) => tab.label.length > 0).length).toBe(TAB_IDS.length);
  });

  it('keeps every tab wired to a real panel, with exactly one open', () => {
    const { tabs, panels } = parse(html.get(path)!);
    expect(panels.map((panel) => panel.id)).toEqual(TAB_IDS.map((id) => `panel-${id}`));
    for (const tab of tabs) {
      expect(panels.some((panel) => panel.id === tab.controls)).toBe(true);
    }
    // Roving tabindex: the first panel is the one a static build ships open.
    expect(panels.filter((panel) => !panel.hidden).map((panel) => panel.key)).toEqual([TAB_IDS[0]]);
  });

  it('renders every board exactly once, with the tab count telling the truth', () => {
    const { tabs, panels } = parse(html.get(path)!);
    const cards = panels.reduce((sum, panel) => sum + panel.cards, 0);
    expect(cards).toBe(BOARD_COUNT);

    const hrefs = panels.flatMap((panel) => panel.hrefs);
    // Two links per card (title + "Open board"), so the unique set is the
    // interesting figure: a board duplicated across panels would pass a count.
    expect(new Set(hrefs).size).toBe(BOARD_COUNT);

    for (const tab of tabs) {
      const panel = panels.find((candidate) => `panel-${candidate.key}` === `panel-${tab.id}`);
      expect(panel).toBeDefined();
      const announced = Number(/(\d+)$/.exec(tab.label)?.[1]);
      expect(announced).toBe(panel!.cards);
      expect(panel!.cards).toBeGreaterThan(0);
    }
  });

  it('keeps the no-JS path open and the old group markup gone', () => {
    const source = html.get(path)!;
    // With scripting off the tablist cannot switch anything, so every panel has
    // to be revealed by the <noscript> rule.
    expect(source).toContain(
      '<style>.section-panel[hidden]{display:block !important}.section-tablist{display:none !important}',
    );
    // The former per-group <h2> is the tab now; a leftover one would print the
    // same category twice.
    expect(source).not.toContain('demo-group-title');
  });

  it('keeps the old group anchors resolvable as panel ids', () => {
    // The hub's `#demo-group-analytics` used to target the group's <h2>. The
    // tab keeps that string as its id and the panel carries it as `data-panel`,
    // which is how the controller maps a hash back to a tab.
    for (const id of TAB_IDS) {
      expect(html.get(path)!).toContain(`data-panel="${id}"`);
    }
  });
});
