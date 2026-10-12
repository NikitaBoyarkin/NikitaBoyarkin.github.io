// Project dashboard contract against the REAL built HTML (dist/).
//
// Every project page used to be one long scroll; it is now a tabbed dashboard
// (components/SectionTabs.astro + SectionPanel.astro). The failure modes this
// suite catches are all silent:
//   1. a panel/tab id drifts, so aria-controls points at nothing;
//   2. a second panel is left visible, so two sections stack under the tabs;
//   3. the case-study panel loses `data-owns-rail`, so the fixed #inner-toc rail
//      stays on screen (over the section that replaced the case study) or, once
//      hidden, never comes back;
//   4. the <noscript> reveal rule is dropped, so a no-JS visitor sees the tablist
//      and the first panel only — every other section is invisible.
//
// Requires `bun run build` first (reads dist/).
//
// Follows tests/built/about.test.ts: the /about dashboard. This one is the same
// contract for the projects routes (RU + EN, hub + Volta sub-project).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

// One page per template the dashboard lands on. Counts differ per page (a
// project without charts has no "charts" panel), so assertions below are
// structural, not fixed counts.
const PAGES = [
  { label: 'RU project (charts + connections)', path: '/projects/cohort/index.html' },
  { label: 'RU project (connections only)', path: '/projects/site/index.html' },
  { label: 'EN project (charts + connections)', path: '/en/projects/cohort/index.html' },
  { label: 'EN project (connections only)', path: '/en/projects/site/index.html' },
  { label: 'RU Volta part', path: '/projects/volta/ab/index.html' },
  { label: 'EN Volta part', path: '/en/projects/volta/ab/index.html' },
];

function readOrSkip(path: string): string | null {
  const file = resolve(DIST, `.${path}`);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

describe.each(PAGES)('project dashboard contract ($label)', ({ path }) => {
  let html = '';

  beforeAll(() => {
    html = readOrSkip(path) ?? '';
  });

  it('has not been built yet if dist is missing', () => {
    // Guard so a missing `bun run build` fails loudly here, not with a
    // confusing empty-string assertion later.
    if (!html) throw new Error(`dist${path} missing — run \`bun run build\` first`);
  });

  it('mounts exactly one dashboard root with one tablist', () => {
    // The bare `data-section-tabs` string also appears in the inlined
    // controller (`querySelector('[data-section-tabs]')`), so count the wrapper
    // element, not the token.
    const roots = [...html.matchAll(/<div class="section-tabs"[^>]*>/g)].map((m) => m[0]);
    expect(roots.length).toBe(1);
    // The rail sync is driven from the root, not the tablist.
    expect(/(?:^|\s)data-rail-id="inner-toc"/.test(roots[0])).toBe(true);

    const tablists = [...html.matchAll(/<[a-z][^>]*\brole="tablist"[^>]*>/g)].map((m) => m[0]);
    expect(tablists.length).toBe(1);
    expect(/(?:^|\s)aria-label="[^"]+"/.test(tablists[0])).toBe(true);
  });

  it('wires every tab to a real panel', () => {
    const tabs = [...html.matchAll(/<button\b[^>]*\brole="tab"[^>]*>/g)].map((m) => m[0]);
    expect(tabs.length).toBeGreaterThanOrEqual(2);

    const ids: string[] = [];
    for (const tab of tabs) {
      const dataTab = /(?:^|\s)data-tab="([^"]+)"/.exec(tab)?.[1] ?? '';
      const id = /(?:^|\s)id="([^"]+)"/.exec(tab)?.[1] ?? '';
      const controls = /(?:^|\s)aria-controls="([^"]+)"/.exec(tab)?.[1] ?? '';
      expect(dataTab).not.toBe('');
      expect(id).toBe(`tab-${dataTab}`);
      expect(controls).toBe(`panel-${dataTab}`);
      expect(html).toContain(`id="${controls}"`);
      ids.push(dataTab);
    }
    // The case study is always the first tab; charts (optional) precedes
    // connections.
    expect(ids[0]).toBe('case');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('renders one tabpanel per tab, with only the case study revealed', () => {
    const panels = [...html.matchAll(/<section\b[^>]*\brole="tabpanel"[^>]*>/g)].map((m) => m[0]);
    expect(panels.length).toBeGreaterThanOrEqual(2);

    const tabIds = [...html.matchAll(/<button\b[^>]*data-tab="([^"]+)"/g)].map((m) => m[1]);
    expect(panels.length).toBe(tabIds.length);

    let visible = 0;
    let visibleId = '';
    for (const panel of panels) {
      const dataPanel = /(?:^|\s)data-panel="([^"]+)"/.exec(panel)?.[1] ?? '';
      const labelledby = /(?:^|\s)aria-labelledby="([^"]+)"/.exec(panel)?.[1] ?? '';
      expect(dataPanel).not.toBe('');
      expect(labelledby).toBe(`tab-${dataPanel}`);
      expect(html).toContain(`id="${labelledby}"`);
      expect(html).toContain(`id="panel-${dataPanel}"`);
      expect(panel).toContain('tabindex="0"');
      if (!/(?:^|\s)hidden(?:[\s=>]|$)/.test(panel)) {
        visible++;
        visibleId = dataPanel;
      }
    }
    expect(visible).toBe(1);
    expect(visibleId).toBe('case');
  });

  it('marks only the case-study panel as owning the TOC rail', () => {
    const owners = [...html.matchAll(/<section\b[^>]*data-panel="([^"]+)"[^>]*data-owns-rail[^>]*>/g)].map(
      (m) => m[1],
    );
    expect(owners).toEqual(['case']);
  });

  it('keeps the case-study prose (and its TOC anchor) inside the case panel', () => {
    // Match the open tag as a prefix: pages whose route has its own <style>
    // block get a `data-astro-cid-*` appended to the <article>, so the exact
    // `>`-terminated string is not stable.
    const article = html.search(/<article id="project-content" class="prose"/);
    expect(article).toBeGreaterThan(-1);

    const casePanel = html.indexOf('data-panel="case"');
    expect(casePanel).toBeGreaterThan(-1);
    expect(casePanel).toBeLessThan(article);

    // The next panel opens after the prose — so the article sits inside `case`,
    // not after the dashboard.
    const nextPanel = html.indexOf('data-panel="charts"', article);
    const connections = html.indexOf('data-panel="connections"', article);
    const map = html.indexOf('data-panel="map"', article);
    const nearestNext = [nextPanel, connections, map].filter((i) => i > -1).sort((a, b) => a - b)[0];
    expect(nearestNext).toBeGreaterThan(article);
  });

  it('keeps the noscript reveal rules for no-JS visitors', () => {
    const rootIdx = html.indexOf('data-section-tabs');
    const noscripts = [...html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/g)];
    const reveal = noscripts.find(
      (m) =>
        (m.index ?? -1) > rootIdx &&
        m[1].includes('.section-panel[hidden]') &&
        m[1].includes('.section-tablist'),
    );
    expect(reveal).toBeDefined();
  });
});
