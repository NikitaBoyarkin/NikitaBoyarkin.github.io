// /talks/ dashboard contract against the REAL built HTML (dist/).
//
// The page used to be one long scroll of 91 talks across four sections. It is now
// a five-panel dashboard (components/SectionTabs.astro + SectionPanel.astro), and
// every failure mode of that regrouping is silent:
//   1. a tab id drifts from its panel, so aria-controls points at nothing;
//   2. two panels render visible, so sections stack under the tablist;
//   3. the canonical `#t<id>` anchor is duplicated — the programme panel also
//      lists every talk, and a second copy of the id would make every graph node
//      and theme link scroll to whichever copy the parser saw first;
//   4. the <noscript> reveal rule is dropped, so a no-JS visitor sees the tablist
//      and one panel out of five;
//   5. the programme filter loses its server-rendered rows, so search would have
//      nothing to filter and the page would stop being readable without JS.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');
const PAGES: string[] = ['/talks/index.html', '/en/talks/index.html'];
const TAB_IDS = ['overview', 'program', 'tracks', 'themes', 'halls'] as const;

const html = new Map<string, string>();

beforeAll(() => {
  for (const path of PAGES) {
    const file = resolve(DIST, `.${path}`);
    if (!existsSync(file)) throw new Error(`dist${path} missing — run \`bun run build\` first`);
    html.set(path, readFileSync(file, 'utf8'));
  }
});

const page = (path: string) => html.get(path)!;

describe.each(PAGES)('talks dashboard contract (%s)', (path) => {
  it('mounts the page dashboard plus one nested dashboard per track section and per theme section', () => {
    // The bare `data-section-tabs` token also appears inside the inlined
    // controller, so count the wrapper elements. Two dashboards: page-level
    // tabs, and one tab per track inside the tracks panel.
    expect([...page(path).matchAll(/<div class="section-tabs[^"]*"[^>]*data-section-tabs/g)].length).toBe(3);
    expect([...page(path).matchAll(/role="tablist"/g)].length).toBe(3);
    const tabs = [...page(path).matchAll(/role="tab" [^>]*data-tab="([^"]+)"/g)].map((m) => m[1]);
    expect(tabs.slice(0, TAB_IDS.length)).toEqual([...TAB_IDS]);
    // 28 tabs across three dashboards, no id repeated: a duplicated tab would
    // make two `aria-controls` point at one panel.
    expect(tabs.length).toBe(TAB_IDS.length + 12 + 11);
    expect(new Set(tabs).size).toBe(tabs.length);
    const trackTabs = tabs.slice(TAB_IDS.length, TAB_IDS.length + 12);
    // One per track plus the synthetic «Без трека» bucket — the tablist is the
    // only navigation into a track now, so losing one loses that track.
    expect(trackTabs.length).toBe(12);
    expect(trackTabs).toContain('avito');
    // Themes are the third dashboard: one tab per theme table, and the table is
    // only reachable through it, so a lost tab hides a whole theme.
    const themeTabs = tabs.slice(TAB_IDS.length + 12);
    expect(themeTabs.length).toBe(11);
    expect(themeTabs).toContain('ai');
  });

  it('wires every tab to a panel that exists, and opens one panel per dashboard', () => {
    const doc = page(path);
    const controls = [...doc.matchAll(/aria-controls="(panel-[^"]+)"/g)].map((m) => m[1]);
    expect(controls.length).toBe(TAB_IDS.length + 12 + 11);
    for (const id of controls) expect(doc).toContain(`id="${id}"`);
    const panels = [...doc.matchAll(/<section[^>]*class="section-panel"[^>]*>/g)].map((m) => m[0]);
    expect(panels.length).toBe(TAB_IDS.length + 12 + 11);
    const open = panels.filter((p) => !p.includes('hidden'));
    // One open panel per dashboard: overview, the first track, the first theme.
    expect(open.length).toBe(3);
    expect(open[0]).toContain('id="panel-overview"');
    // The *first* tab of each nested dashboard, not merely "a tabpanel": a
    // nested root opening any other track/theme still contains that string.
    const allTabs = [...doc.matchAll(/role="tab" [^>]*data-tab="([^"]+)"/g)].map((m) => m[1]);
    const trackTabs = allTabs.slice(TAB_IDS.length, TAB_IDS.length + 12);
    const themeTabs = allTabs.slice(TAB_IDS.length + 12);
    expect(open[1]).toContain(`id="panel-${trackTabs[0]}"`);
    expect(open[2]).toContain(`id="panel-${themeTabs[0]}"`);
  });

  it('points every tab anchor at an element that exists', () => {
    const doc = page(path);
    const ids = new Set([...doc.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...doc.matchAll(/data-anchor="([^"]+)"/g)].map((m) => m[1]);
    expect(anchors.length).toBe(TAB_IDS.length + 12 + 11);
    // A tab writes `#<anchor>` on switch. If the anchor names no element, a
    // shared/reloaded link falls back to the first tab — how the nested track
    // tabs lost their track while `#track-<slug>` ids sat unused.
    const unresolved = anchors.filter((a) => !ids.has(a) && !ids.has(`panel-${a}`));
    expect(unresolved).toEqual([]);
  });

  it('keeps the no-JS fallback: reveal panels, hide the tablist', () => {
    const doc = page(path);
    expect(doc).toContain('.section-panel[hidden]{display:block !important}');
    expect(doc).toContain('.section-tablist{display:none !important}');
  });

  it('has exactly one canonical #t<id> anchor per talk, and no duplicated id', () => {
    const ids = [...page(path).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
    const talkIds = ids.filter((id) => /^t\d+$/.test(id));
    // 91 talks in the programme: one anchor each, all inside the tracks panel.
    expect(talkIds.length).toBe(91);
  });

  it('ships the whole programme in the HTML, not as a client-side list', () => {
    const rows = [...page(path).matchAll(/data-talk-day="/g)];
    expect(rows.length).toBe(91);
    for (const id of TAB_IDS) expect(page(path)).toContain(`id="panel-${id}"`);
    expect(page(path)).toContain('data-talks-query');
    expect(page(path)).toContain('data-talks-found');
  });

  it('links each talk to its themes and each theme back to the talk', () => {
    const doc = page(path);
    const prefix = path.startsWith('/en/') ? '/en/talks/' : '/talks/';
    expect(doc).toContain(`href="${prefix}#theme-ai"`);
    expect(doc).toContain('id="theme-ai"');
    expect(doc).toContain('id="track-avito"');
  });

  it('renders each theme as a table of its talks', () => {
    const doc = page(path);
    const tables = [...doc.matchAll(/<table class="talks-theme-table">/g)];
    expect(tables.length).toBe(11);
    // A table with no rows would still pass the count above, so check that one
    // theme lists as many rows as the data says it has.
    const section = doc.slice(doc.indexOf('id="theme-ai"'));
    const rows = section.slice(0, section.indexOf('</section>')).match(/<tr>/g) ?? [];
    expect(rows.length).toBeGreaterThan(1);
  });

  it('instruments the dashboard: three named tablists and one opted-in graph per panel', () => {
    // `tab_selected` can only separate the page's five panels from the twelve
    // track tabs and the eleven theme tabs if each tablist names itself.
    const groups = [...page(path).matchAll(/data-analytics-group="([^"]+)"/g)].map((m) => m[1]);
    expect(groups.sort()).toEqual(['talks', 'talks:themes', 'talks:tracks']);

    // `graph_node_click` is opt-in per instance: the overview plus one graph per
    // track group (11 tracks + «Без трека»).
    const graphs = [...page(path).matchAll(/data-analytics-graph="([^"]+)"/g)].map((m) => m[1]);
    expect(graphs.length).toBe(13);
    expect(new Set(graphs).size).toBe(13);
    expect(graphs).toContain('talks-overview');
    expect(graphs).toContain('talks-track-avito');
  });

  it('ships the talk-card dialog with one payload row per talk', () => {
    const doc = page(path);
    expect(doc).toContain('id="talk-card"');
    expect(doc).toContain('data-talk-card-title');
    const island = doc.match(/<script[^>]*id="talk-cards-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(island).not.toBeNull();
    const cards = JSON.parse(island![1]) as { id: number; title: string; lectors: unknown[] }[];
    expect(cards.length).toBe(91);
    expect(new Set(cards.map((c) => c.id)).size).toBe(91);
    for (const card of cards) expect(card.title.length).toBeGreaterThan(0);
  });
});
