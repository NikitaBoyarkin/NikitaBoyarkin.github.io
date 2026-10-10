// The canvas homepage against the REAL built output.
//
// Why this file exists rather than more tests/lib coverage: canvas-layout.ts
// proves the geometry, but nothing there proves the geometry reached the page.
// A build where the sketch layer or the fit constants are dropped, or where the
// page silently falls back to PersonaGate, passes every unit test and ships a
// broken hero. These assertions read dist/ directly.
//
// It also pins the JS-off contract (Review Focus #1): the links must be in the
// markup, not injected by the script.
//
// Requires `bun run build` first (reads dist/*.html).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NODES, WORLD, MIN_ZOOM, MAX_ZOOM } from '../../src/lib/canvas-layout';

const DIST = resolve(__dirname, '../../dist');

const PAGES = [
  { file: 'index.html', lang: 'ru', h1: 'Продуктовый аналитик' },
  { file: 'en/index.html', lang: 'en', h1: 'Product Analyst' },
] as const;

const html = new Map<string, string>();

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const p of PAGES) {
    const path = resolve(DIST, p.file);
    if (!existsSync(path)) throw new Error(`built page missing: ${p.file}`);
    html.set(p.file, readFileSync(path, 'utf8'));
  }
});

describe('canvas homepage (built HTML)', () => {
  for (const { file, lang, h1 } of PAGES) {
    const doc = () => html.get(file)!;

    it(`${file}: renders the stage and the world layer`, () => {
      expect(doc()).toContain('canvas-viewport');
      expect(doc()).toContain('canvas-world');
      expect(doc()).toContain('canvas-nodes');
      expect(doc()).toContain('--vp-k');
    });

    it(`${file}: carries the heading as real text`, () => {
      const match = doc().match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      expect(match, `${file}: no <h1>`).not.toBeNull();
      expect(match![1]).toContain(h1);
    });

    it(`${file}: carries all four links in the markup, not injected by script`, () => {
      const d = doc();
      for (const suffix of ['hr/', 'manager/', 'colleague/', 'projects/']) {
        expect(d, `${lang}: ${suffix}`).toContain(suffix);
      }
      expect(d).toContain('data-analytics="booking_click"');
      expect(d).toContain('data-analytics="cv_download_pdf"');
      expect(d).toContain('download');
    });

    it(`${file}: puts the role cards after the h1 in document order`, () => {
      const d = doc();
      const h1At = d.indexOf('<h1');
      expect(h1At).toBeGreaterThan(-1);
      for (const role of ['hr', 'manager', 'colleague']) {
        const at = d.indexOf(`data-persona="${role}"`);
        expect(at, `${lang}: data-persona="${role}" missing`).toBeGreaterThan(h1At);
      }
    });

    it(`${file}: renders every layout node exactly once`, () => {
      const d = doc();
      for (const n of NODES) {
        const count = d.split(`data-node="${n.id}"`).length - 1;
        expect(count, `${lang}: data-node="${n.id}"`).toBe(1);
      }
    });

    it(`${file}: marks the decorative layers aria-hidden and leaves no text in SVG`, () => {
      const d = doc();
      const sketch = d.match(/<svg[^>]*class="canvas-sketch"[^>]*>/)?.[0];
      expect(sketch, `${lang}: sketch svg missing`).toBeDefined();
      expect(sketch!).toContain('aria-hidden="true"');
      expect(sketch!).not.toContain('role="img"');
      const grid = d.match(/<div[^>]*class="canvas-grid"[^>]*>/)?.[0];
      expect(grid!).toContain('aria-hidden="true"');
    });

    it(`${file}: keeps the sketch frames deterministic and inlined`, () => {
      const d = doc();
      expect(d).toContain('data-frame="identity"');
      expect(d).toContain('data-pass="0"');
      expect(d).toContain('data-pass="1"');
      // A path that never made it into the HTML would leave an empty frame.
      expect(d).toMatch(/<path d="M-?[\d.]+/);
    });

    it(`${file}: exposes the fit constants the inline script reads`, () => {
      const d = doc();
      expect(d).toContain(`data-world-w="${WORLD.w}"`);
      expect(d).toContain(`data-world-h="${WORLD.h}"`);
      expect(d).toContain(`data-min-k="${MIN_ZOOM}"`);
      expect(d).toContain(`data-max-k="${MAX_ZOOM}"`);
    });

    it(`${file}: has real zoom controls with accessible names`, () => {
      const d = doc();
      const buttons = [...d.matchAll(/<button[^>]*data-canvas-zoom="([^"]+)"[^>]*>/g)];
      expect(buttons.length, `${lang}: zoom buttons`).toBe(3);
      for (const b of buttons) {
        expect(b[0], `${lang}: ${b[1]} has no aria-label`).toContain('aria-label="');
      }
    });
  }

  it('does not serve the retired gate component', () => {
    for (const { file } of PAGES) {
      expect(html.get(file)!, `${file}: still rendering persona-gate`).not.toContain(
        'class="persona-gate"'
      );
    }
  });
});
