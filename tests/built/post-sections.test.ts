// Article sections dashboard, against the REAL built HTML (dist/).
//
// An article used to be one long scroll; it is now the same tabbed dashboard the
// project case body uses (`components/SectionTabs.astro` +
// `src/lib/post-sections-hast.ts`). Every failure mode here is silent:
//
//   1. the tablist and the panels drift apart, so `aria-controls` points at
//      nothing and a section becomes unreachable;
//   2. a second panel is left visible, so two sections stack under the tabs;
//   3. the plugin drops the lead (everything before the first H2) or a heading,
//      and the page still looks fine while a paragraph or a tab is gone;
//   4. the `<noscript>` reveal rule is lost, so a reader without JS sees the
//      tablist and the first panel only.
//
// The counts are bound on both sides — source markdown H2s and built tabs — so a
// heading added to an article without a matching panel turns this red.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');

const PAGES = [
  { label: 'RU post', file: 'posts/bayesian-ab-testing/index.html', source: 'src/content/posts/bayesian-ab-testing.md' },
  {
    label: 'EN post',
    file: 'en/posts/ab-calibration-simulation/index.html',
    source: 'src/content/posts-en/ab-calibration-simulation.md',
  },
];

/** H2s as authored. Frontmatter is fenced by `---`, and a post's `##` inside the
 *  prose only ever appears after the second fence. */
function sourceH2s(source: string): string[] {
  const body = readFileSync(resolve(ROOT, source), 'utf8').split(/^---$/m).slice(2).join('---');
  return [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
}

const attr = (tag: string, name: string) =>
  new RegExp(`(?:^|\\s)${name}="([^"]+)"`).exec(tag)?.[1] ?? '';

describe.each(PAGES)('article sections dashboard ($label)', ({ file, source }) => {
  const path = resolve(DIST, file);
  const html = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const h2s = sourceH2s(source);

  it('has been built (run `bun run build`)', () => {
    expect(html).not.toBe('');
  });

  it('mounts the dashboard inside the article body', () => {
    const body = html.indexOf('id="post-content"');
    const root = html.indexOf('class="section-tabs section-tabs--sm"');
    expect(body).toBeGreaterThan(-1);
    expect(root).toBeGreaterThan(body);
    // The tablist names the strip: two unnamed tablists on one page would be
    // indistinguishable to a screen reader.
    const tablist = /<div class="section-tablist"[^>]*>/.exec(html)?.[0] ?? '';
    expect(tablist).toContain('role="tablist"');
    expect(attr(tablist, 'aria-label')).not.toBe('');
  });

  it('renders one tab and one panel per authored H2 — no section dropped', () => {
    const tabs = [...html.matchAll(/<button\b[^>]*\brole="tab"[^>]*>/g)].map((m) => m[0]);
    const panels = [...html.matchAll(/<section\b[^>]*\brole="tabpanel"[^>]*>/g)].map((m) => m[0]);

    expect(tabs.length).toBe(h2s.length);
    expect(tabs.length).toBeGreaterThan(1); // a single section should not be tabbed at all
    expect(panels.length).toBe(tabs.length);

    const tabIds = tabs.map((t) => attr(t, 'data-tab'));
    const panelIds = panels.map((p) => attr(p, 'data-panel'));
    expect(panelIds).toEqual(tabIds);
    expect(new Set(tabIds).size).toBe(tabIds.length);
  });

  it('wires every tab to its panel and keeps the heading id as the anchor', () => {
    for (const raw of [...html.matchAll(/<button\b[^>]*\brole="tab"[^>]*>/g)].map((m) => m[0])) {
      const id = attr(raw, 'data-tab');
      expect(attr(raw, 'id')).toBe(`tab-${id}`);
      expect(attr(raw, 'aria-controls')).toBe(`panel-${id}`);
      expect(attr(raw, 'data-anchor')).toBe(id);
      expect(html).toContain(`id="panel-${id}"`);
      // The id is the heading's own: that is what makes `#<heading>` deep-link
      // into the right panel through the controller's anchor map.
      expect(html).toContain(`<h2 id="${id}"`);
    }
  });

  it('reveals exactly the first panel server-side', () => {
    const panels = [...html.matchAll(/<section\b[^>]*\brole="tabpanel"[^>]*>/g)].map((m) => m[0]);
    const visible = panels.filter((p) => !/(?:^|\s)hidden(?:[\s=>]|$)/.test(p));
    expect(visible.length).toBe(1);
    expect(attr(visible[0], 'data-panel')).toBe(attr(panels[0], 'data-panel'));
  });

  it('keeps the lead and its first heading inside the first panel', () => {
    const panels = [...html.matchAll(/<section\b[^>]*\brole="tabpanel"[^>]*>/g)];
    const first = attr(panels[0][0], 'data-panel');
    const start = panels[0].index ?? -1;
    const nextStart = panels.length > 1 ? (panels[1].index ?? html.length) : html.length;
    const firstPanel = html.slice(start, nextStart);
    expect(firstPanel).toContain(`<h2 id="${first}"`);
    // The lead is visible content, not dead markup: something precedes the H2.
    expect(firstPanel.indexOf(`<h2 id="${first}"`)).toBeGreaterThan(0);
  });

  it('ships the noscript reveal for readers without JS', () => {
    const noscripts = [...html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/g)];
    const reveal = noscripts.find(
      (m) => m[1].includes('.section-panel[hidden]') && m[1].includes('.section-tablist'),
    );
    expect(reveal).toBeDefined();
  });
});
