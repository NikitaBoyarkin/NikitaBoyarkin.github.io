// /about invariants that fail *silently* when a redesign lands.
//
//   1. Seven deep-link redirects in astro.config.mjs point at #who / #work /
//      #now / #start. Rename an anchor and the redirect still returns 308 —
//      it just lands on the top of the page. Nothing else checks that.
//   2. Analytics.astro emits `section_viewed` from [data-analytics-section].
//      Dropping the attribute kills the event with no error anywhere.
//   3. The CV link is documented in docs/cta-inventory.md as carrying
//      cv_download_pdf; it did not, so the download was invisible.
//   4. The ProfilePage Person node is what makes the page useful to a
//      knowledge panel; the enriching fields are easy to lose in a rewrite.
//   5. The /about dashboard is a tab widget. Rename a tab id and the redirect
//      anchors (#who/#work/#now/#value) land on hidden panels, and the
//      noscript reveal rule stops matching — again, silently.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');

const PAGES = [
  { label: 'RU about', path: '/about/index.html' },
  { label: 'EN about', path: '/en/about/index.html' },
];

/** Anchors the redirect map in astro.config.mjs resolves to. */
const REDIRECT_ANCHORS = ['start', 'who', 'now', 'work', 'value'];

/** Values Analytics.astro observes via [data-analytics-section]. */
const ANALYTICS_SECTIONS = ['who', 'how', 'now', 'work', 'location', 'value'];

/** Tab ids in SSR order — the frozen /about tab contract. */
const TAB_IDS = ['profile', 'now', 'value', 'work', 'stack'];

function page(path: string): string {
  const file = resolve(DIST, `.${path}`);
  if (!existsSync(file)) {
    throw new Error(`dist${path} missing — run \`bun run build\` first`);
  }
  return readFileSync(file, 'utf8');
}

/** Every JSON-LD node embedded in a page (a page emits several scripts). */
function jsonLdNodes(html: string): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    try {
      nodes.push(JSON.parse(m[1]) as Record<string, unknown>);
    } catch {
      // A malformed block is caught by its own assertion below.
    }
  }
  return nodes;
}

describe.each(PAGES)('about page contract ($label)', ({ path }) => {
  let html = '';

  beforeAll(() => {
    html = page(path);
  });

  it('keeps every anchor the redirect map points at', () => {
    for (const id of REDIRECT_ANCHORS) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('mounts the experience & education block', () => {
    expect(html).toContain('id="career"');
  });

  it('keeps the section_viewed anchors', () => {
    for (const section of ANALYTICS_SECTIONS) {
      expect(html).toContain(`data-analytics-section="${section}"`);
    }
  });

  it('tags the CV link so the download is measurable', () => {
    const cvLink = /<a[^>]*download[^>]*>/.exec(html)?.[0] ?? '';
    expect(cvLink).not.toBe('');
    expect(cvLink).toContain('data-analytics="cv_download_pdf"');
  });

  it('keeps the AskMe widget (asserted by morph.test.ts)', () => {
    expect(html).toContain('AskMe.astro_astro_type_script_index_0_lang');
  });

  it('emits a ProfilePage Person with knowsAbout and alumniOf', () => {
    const profile = jsonLdNodes(html).find((n) => n['@type'] === 'ProfilePage');
    expect(profile).toBeDefined();

    const person = profile?.mainEntity as Record<string, unknown> | undefined;
    expect(person?.['@type']).toBe('Person');
    expect(Array.isArray(person?.knowsAbout)).toBe(true);
    expect((person?.knowsAbout as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(person?.alumniOf)).toBe(true);
    expect((person?.alumniOf as unknown[]).length).toBeGreaterThan(0);
  });

  it('mounts the about-tabs wrapper with a #start tablist', () => {
    expect(html).toContain('data-about-tabs');
    expect(html).toContain('class="about-tabs"');

    const tablists = [...html.matchAll(/<[a-z][^>]*\brole="tablist"[^>]*>/g)].map((m) => m[0]);
    expect(tablists.length).toBe(1);

    const tablist = tablists[0];
    expect(/(?:^|\s)id="start"/.test(tablist)).toBe(true);
    const label = /(?:^|\s)aria-label="([^"]*)"/.exec(tablist)?.[1] ?? '';
    expect(label.length).toBeGreaterThan(0);
  });

  it('wires the five tab buttons to their panels', () => {
    const tabs = [...html.matchAll(/<button\b[^>]*\brole="tab"[^>]*>/g)].map((m) => m[0]);
    expect(tabs.length).toBe(5);

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
    expect(ids).toEqual(TAB_IDS);
  });

  it('renders five tabpanels with only the profile panel revealed', () => {
    const panels = [...html.matchAll(/<section\b[^>]*\brole="tabpanel"[^>]*>/g)].map((m) => m[0]);
    expect(panels.length).toBe(5);

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
    expect(visibleId).toBe('profile');
  });

  it('marks exactly the profile tab as selected and focusable', () => {
    const tabs = [...html.matchAll(/<button\b[^>]*\brole="tab"[^>]*>/g)].map((m) => m[0]);

    const selected = tabs.filter((t) => /(?:^|\s)aria-selected="true"/.test(t));
    const focusable = tabs.filter((t) => /(?:^|\s)tabindex="0"/.test(t));
    const unselected = tabs.filter((t) => /(?:^|\s)aria-selected="false"/.test(t));
    const unfocusable = tabs.filter((t) => /(?:^|\s)tabindex="-1"/.test(t));

    expect(selected.length).toBe(1);
    expect(focusable.length).toBe(1);
    expect(selected[0]).toBe(focusable[0]);
    expect(/(?:^|\s)data-tab="profile"/.test(selected[0])).toBe(true);
    expect(unselected.length).toBe(4);
    expect(unfocusable.length).toBe(4);
  });

  it('keeps every redirect anchor and analytics section inside a tab panel', () => {
    const anchors = [
      ...new Set([
        ...REDIRECT_ANCHORS.filter((id) => id !== 'start'),
        ...ANALYTICS_SECTIONS,
        'career',
      ]),
    ];

    for (const id of anchors) {
      const idx = html.indexOf(`id="${id}"`);
      expect(idx).toBeGreaterThan(-1);

      const panelIdx = html.lastIndexOf('data-panel="', idx);
      const closeIdx = html.indexOf('</section>', idx);

      expect(panelIdx).toBeGreaterThan(-1);
      expect(panelIdx).toBeLessThan(idx);
      expect(closeIdx).toBeGreaterThan(idx);

      const panelId = /data-panel="([^"]+)"/.exec(html.slice(panelIdx))?.[1] ?? '';
      expect(TAB_IDS).toContain(panelId);
    }
  });

  it('keeps the noscript reveal rules for no-JS visitors', () => {
    const wrapperIdx = html.indexOf('data-about-tabs');
    const noscripts = [...html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/g)];

    const reveal = noscripts.find(
      (m) =>
        (m.index ?? -1) > wrapperIdx && m[1].includes('.about-panel[hidden]') && m[1].includes('.about-tablist'),
    );
    expect(reveal).toBeDefined();
  });
});
