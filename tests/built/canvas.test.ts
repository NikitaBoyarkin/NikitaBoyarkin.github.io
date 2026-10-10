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
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

// `:global()` is meaningful only inside a scoped component's <style>; in a
// directly-imported stylesheet like global.css the emitted selector is the
// literal `:global([data-theme=…]) …`, which browsers drop as unparseable —
// so a theme override written that way never applies and no HTML assertion
// above can see it. This reads the emitted CSS from disk and fails on the
// literal, naming the offending file.
it('emits no :global( left in any built stylesheet', () => {
  const astro = resolve(DIST, '_astro');
  expect(existsSync(astro), `${astro} missing — run \`bun run build\` first`).toBe(true);
  const cssFiles = readdirSync(astro).filter((f) => f.endsWith('.css'));
  expect(cssFiles.length, 'no CSS emitted under dist/_astro').toBeGreaterThan(0);
  const offenders = cssFiles.filter((f) => readFileSync(resolve(astro, f), 'utf8').includes(':global('));
  expect(
    offenders,
    `:global( survives into built CSS in: ${offenders.join(', ') || '(none)'}`
  ).toEqual([]);
});

// ── JS-off degradation contract (Review Focus #1) ────────────────────────────
// With JavaScript off the SSR fit constants are never corrected, and the real
// `.canvas-viewport` is narrower than the 1440-wide world, so the right-hand
// nodes are clipped. The fix is the `canvas-static` marker on <html>: it ships
// in the markup, and the only code that clears it is CanvasStage's synchronous
// pre-paint script — which cannot run with JS off. These assertions fail on the
// pre-fix state, where the marker does not exist at all.

it('ships the not-live canvas marker on <html>', () => {
  for (const { file } of PAGES) {
    expect(html.get(file)!, `${file}: <html> carries no canvas-static marker`).toMatch(
      /<html[^>]*\bclass="[^"]*\bcanvas-static\b/
    );
  }
});

it('clears the marker only from script, and restores it when the module throws', () => {
  const astro = resolve(DIST, '_astro');
  const assets = readdirSync(astro).filter((f) => f.endsWith('.js'));
  expect(assets.length, 'no JS emitted under dist/_astro').toBeGreaterThan(0);
  const bundled = assets.map((f) => readFileSync(resolve(astro, f), 'utf8')).join('\n');
  for (const { file } of PAGES) {
    const d = html.get(file)!;
    expect(d, `${file}: pre-paint script does not clear the marker`).toMatch(
      /classList\.remove\(['"`]canvas-static['"`]\)/
    );
    // Astro decides per build whether the module script is inlined into the page
    // or emitted as an asset, so the catch clause is looked for in both.
    expect(
      `${d}\n${bundled}`,
      `${file}: nothing restores the marker when initialisation throws`
    ).toMatch(/classList\.add\(['"`]canvas-static['"`]\)/);
  }
});

// ── Cascade-order contract (theme override + interactive border) ─────────────
// CanvasStage.astro's scoped <style> emits `.canvas-sketch[data-astro-cid-…]`
// and PersonaCanvas.astro's emits `.persona-card[data-astro-cid-…]`, both at
// specificity 0,2,0, from stylesheets that load AFTER global.css. A rule
// written at 0,2,0 therefore loses to source order, whatever its order in the
// source file. These helpers read the emitted CSS so the assertions below can
// require the override to out-rank the rule it fights.

type Spec = [number, number, number];

const specificity = (selector: string): Spec => {
  const s = selector.replace(/\s*[>+~]\s*/g, ' ');
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes =
    (s.match(/\.[\w-]+/g) ?? []).length +
    (s.match(/\[[^\]]+\]/g) ?? []).length +
    (s.match(/:(?!:)[\w-]+/g) ?? []).length;
  const types =
    (s.match(/::[\w-]+/g) ?? []).length +
    (s.match(/(?:^|[\s,(])[a-zA-Z][\w-]*/g) ?? []).length;
  return [ids, classes, types];
};

const beats = (a: Spec, b: Spec): boolean =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

const cssRules = (): { selector: string; body: string; file: string }[] => {
  const astro = resolve(DIST, '_astro');
  const out: { selector: string; body: string; file: string }[] = [];
  for (const f of readdirSync(astro).filter((x) => x.endsWith('.css'))) {
    const text = readFileSync(resolve(astro, f), 'utf8');
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      out.push({ selector: m[1].trim(), body: m[2].trim(), file: f });
    }
  }
  return out;
};

const maxSpec = (rules: { selector: string }[]): Spec =>
  rules
    .map((r) => specificity(r.selector.split(',')[0]))
    .reduce((a, b) => (beats(b, a) ? b : a));

it('wins the cyberpunk canvas override on specificity, not on source order', () => {
  const all = cssRules();
  // The rule the override has to beat: the scoped base in CanvasStage.astro,
  // emitted as `.canvas-sketch[data-astro-cid-…]` from the later stylesheet.
  const base = all.filter(
    (r) =>
      r.selector.includes('.canvas-sketch') &&
      r.selector.includes('data-astro-cid') &&
      r.body.includes('stroke')
  );
  const cyber = all.filter(
    (r) =>
      r.selector.includes('.canvas-sketch') &&
      r.selector.includes('cyberpunk') &&
      r.body.includes('stroke:')
  );
  expect(base.length, 'no base .canvas-sketch rule in the built CSS').toBeGreaterThan(0);
  expect(cyber.length, 'no cyberpunk .canvas-sketch override in the built CSS').toBeGreaterThan(0);
  for (const r of cyber) {
    expect(
      beats(specificity(r.selector.split(',')[0]), maxSpec(base)),
      `${r.file}: ${r.selector} must out-rank the base .canvas-sketch rule`
    ).toBe(true);
  }
});
