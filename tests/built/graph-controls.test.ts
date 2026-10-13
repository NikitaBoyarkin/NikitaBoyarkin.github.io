// The graph's controls, against the REAL built output.
//
// Why this file exists: the controls are reworked in markup while their
// behaviour lives in a client script, so a change can compile, build and still
// leave the toolbar unreadable — which is exactly what happened. The legend, the
// search dropdown and its empty state are built with `createElement`, and Astro
// scopes its <style> by stamping `data-astro-cid-…` on rendered elements, so
// none of those rules matched and the legend shipped as loose unstyled text with
// a native checkbox in it. That half is runtime (the script copies the
// component's scope attribute onto JS-made nodes) and only a browser can prove
// it; the half below is what dist/ can hold still: the controls each carry an
// icon or a label of their own, none of them is a bare font glyph, and no count
// is welded into a button's text.
//
// Requires `bun run build` first (reads dist/*.html).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

// Same component, card variant — the controls must not diverge between the
// board and the embedded graph.
const PAGES = ['graph/index.html', 'en/graph/index.html', 'colleague/index.html'] as const;

const html = new Map<string, string>();

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const p of PAGES) {
    const path = resolve(DIST, p);
    if (!existsSync(path)) throw new Error(`built page missing: ${p}`);
    html.set(p, readFileSync(path, 'utf8'));
  }
});

/** Every element in the document carrying `data-kg-action`. */
function actionButtons(doc: string): string[] {
  return doc.match(/<(?:button)[^>]*data-kg-action="[^"]*"[^>]*>[\s\S]*?<\/(?:button)>/g) ?? [];
}

describe('graph controls (built HTML)', () => {
  for (const file of PAGES) {
    const doc = () => html.get(file)!;

    it(`${file}: the four view controls render as drawn icons, not font glyphs`, () => {
      // `+ − ⟲ ⛶` came from whatever font won the fallback chain, so weight and
      // optical size drifted per platform and two of them risked a tofu box.
      for (const action of ['zoom-in', 'zoom-out', 'reset', 'fullscreen']) {
        const btn = actionButtons(doc()).find((b) => b.includes(`data-kg-action="${action}"`));
        expect(btn, `${action} button`).toBeTruthy();
        expect(btn!).toContain('<svg');
        expect(btn!).toMatch(/aria-hidden="true"/);
        expect(btn!).toMatch(/aria-label="[^"]+"/);
      }
      // No glyph survived as visible text.
      for (const glyph of ['>+<', '>−<', '>⟲<', '>⛶<']) {
        expect(doc()).not.toContain(glyph);
      }
    });

    it(`${file}: the zoom trio is one labelled group, fullscreen sits outside it`, () => {
      const zoom = doc().match(/<div[^>]*class="kg-zoom"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? '';
      expect(zoom).toContain('role="group"');
      expect(zoom).toMatch(/aria-label="[^"]+"/);
      expect((zoom.match(/data-kg-action="/g) ?? []).length).toBe(3);
      expect(zoom).not.toContain('fullscreen');
      expect(doc()).toMatch(/data-kg-action="fullscreen"/);
    });

    it(`${file}: every preset chip separates its label from its count`, () => {
      const chips = doc().match(/<button[^>]*class="kg-chip"[^>]*>[\s\S]*?<\/button>/g) ?? [];
      expect(chips.length).toBe(6);
      for (const chip of chips) {
        expect(chip).toContain('kg-chip-label');
        expect(chip).toContain('kg-chip-count');
        expect(chip).toMatch(/data-kg-preset="[^"]*"/);
        expect(chip).toMatch(/data-label="[^"]+"/);
      }
      // The count used to be welded into the button's text as `Все (109)`, which
      // made every chip a different width and threw the span away on each render.
      expect(doc()).not.toMatch(/>[^<>]*\(\d+\)</);
    });

    it(`${file}: edge filters put the checkbox before the swatch`, () => {
      const rows = doc().match(/<label[^>]*class="kg-edge-toggle"[^>]*>[\s\S]*?<\/label>/g) ?? [];
      expect(rows.length).toBe(5);
      for (const row of rows) {
        expect(row).toMatch(/data-kg-type="[a-z]+"/);
        expect(row.indexOf('<input')).toBeLessThan(row.indexOf('kg-edge-swatch'));
      }
    });

    it(`${file}: the legend is still a list, and the search box keeps its label`, () => {
      expect(doc()).toMatch(/id="kg-legend"[^>]*role="list"/);
      expect(doc()).toMatch(/id="kg-legend"[^>]*aria-label="[^"]+"/);
      expect(doc()).toMatch(/id="kg-search-input"[\s\S]*?aria-label="[^"]+"/);
    });
  }
});
