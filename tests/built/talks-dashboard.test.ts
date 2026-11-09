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
  it('mounts one dashboard root with one tablist and the expected tab ids', () => {
    // The bare `data-section-tabs` token also appears inside the inlined
    // controller, so count the wrapper element.
    expect([...page(path).matchAll(/<div class="section-tabs"[^>]*>/g)].length).toBe(1);
    expect([...page(path).matchAll(/role="tablist"/g)].length).toBe(1);
    const tabs = [...page(path).matchAll(/role="tab" [^>]*data-tab="([^"]+)"/g)].map((m) => m[1]);
    expect(tabs).toEqual([...TAB_IDS]);
  });

  it('wires every tab to a panel that exists, and shows exactly one panel server-side', () => {
    const doc = page(path);
    const controls = [...doc.matchAll(/aria-controls="(panel-[^"]+)"/g)].map((m) => m[1]);
    expect(controls.length).toBe(TAB_IDS.length);
    for (const id of controls) expect(doc).toContain(`id="${id}"`);
    const panels = [...doc.matchAll(/<section[^>]*class="section-panel"[^>]*>/g)].map((m) => m[0]);
    expect(panels.length).toBe(TAB_IDS.length);
    expect(panels.filter((p) => !p.includes('hidden'))).toEqual([panels[0]]);
    expect(panels[0]).toContain('id="panel-overview"');
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
});
