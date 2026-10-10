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

    // The hand-drawn frame layer was removed on the owner's call. It had become
    // a defect rather than decoration: sketchRectFor() generates its rects in
    // local 0..w × 0..h space (src/lib/sketch.ts), while CanvasStage emitted
    // `<g data-frame>` with no transform, so every frame landed at the world
    // origin — stray hairlines across the hero instead of a frame around the
    // node. Nothing replaces it, so the layer has to stay gone; `canvas-sketch`,
    // `data-frame` and `data-pass` are the three marks it leaves in the markup.
    it(`${file}: ships no frame layer and marks the grid aria-hidden`, () => {
      const d = doc();
      expect(d, `${lang}: the sketch frame layer is back`).not.toContain('canvas-sketch');
      expect(d, `${lang}: a frame group survived the removal`).not.toContain('data-frame=');
      expect(d, `${lang}: a jitter pass survived the removal`).not.toContain('data-pass=');
      const grid = d.match(/<div[^>]*class="canvas-grid"[^>]*>/)?.[0];
      expect(grid!, `${lang}: the dot grid lost its aria-hidden`).toContain('aria-hidden="true"');
    });

    // PRD §8.1: the eye reads a mismatch between the two column tops as a shift,
    // not as intent. The right column's top edge is the fork's lead-in, which is
    // an `<h2>` label with no layout box of its own — its `top` is hand-written in
    // PersonaCanvas.astro and has to track `identity.y` in canvas-layout.ts. Two
    // independent literals is exactly how they drift, so they are compared here.
    it(`${file}: starts both columns on the same line`, () => {
      const d = doc();
      const at = (re: RegExp, what: string): number => {
        const m = d.match(re);
        expect(m, `${lang}: ${what} carries no inline top`).not.toBeNull();
        return Number(m![1]);
      };
      const heroTop = at(/data-node="identity"[^>]*style="[^"]*\btop:(\d+)px/, 'the hero node');
      const leadTop = at(
        /class="[^"]*\bcanvas-lead\b[^"]*"[^>]*style="[^"]*\btop:(\d+)px/,
        'the fork lead-in'
      );
      expect(leadTop, `${lang}: the column tops must align (PRD §8.1)`).toBe(heroTop);
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

// The pre-paint fit has to be measured with the canvas ALREADY live. While the
// `canvas-static` marker is still on <html>, global.css gives `.canvas-viewport`
// `block-size: auto`, so `clientHeight` returns the *stacked* list's height
// (~1122px) rather than the 100vh the live canvas gets. Fitting the board to
// that taller box centred it ~177px too low and pushed `projects-all` entirely
// outside the clipped hero on every 768px-tall window from 950px up. This is the
// built-HTML half of that fix: the marker removal must precede the height read,
// and the read must still exist (a deleted measurement is not a pass).
//
// The browser-observed half — every node ≥100% visible across the 900–1440px
// band at 768/900 tall, JavaScript on — is a one-off Playwright measurement
// recorded in the spec, NOT an assertion here. Built-HTML string checks cannot
// see computed layout, so that sweep is unguarded by construction.
it('measures the pre-paint fit only after the canvas is live, not stacked', () => {
  for (const { file } of PAGES) {
    const d = html.get(file)!;
    const remove = d.match(/classList\.remove\(['"`]canvas-static['"`]\)/);
    const reads = [...d.matchAll(/el\.clientHeight/g)];
    expect(remove, `${file}: no marker removal in the pre-paint script`).not.toBeNull();
    expect(reads.length, `${file}: pre-paint script no longer measures clientHeight`).toBe(1);
    expect(
      remove!.index!,
      `${file}: clientHeight is read while <html> is still canvas-static`
    ).toBeLessThan(reads[0].index!);
  }
});

// ── Cascade-order contract (theme override + interactive border) ─────────────
// PersonaCanvas.astro's scoped <style> emits `.persona-card[data-astro-cid-…]`
// at specificity 0,2,0, from a stylesheet that loads AFTER global.css. A rule
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

it('wins the light-theme card override on specificity, not on source order', () => {
  const all = cssRules();
  // The rule the override has to beat: the scoped base in PersonaCanvas.astro,
  // emitted as `.persona-card[data-astro-cid-…]` from the later stylesheet. It
  // paints the card with `--surface-secondary`, a cool grey that reads as a dirty
  // patch on the cream page; the light override replaces that background and only
  // lands if it out-ranks the scoped rule. `(?![\w-])` keeps `.persona-card-cta`
  // and friends out of both sides of the comparison.
  const card = /\.persona-card(?![\w-])/;
  const base = all.filter(
    (r) => card.test(r.selector) && r.selector.includes('data-astro-cid') && r.body.includes('background')
  );
  const light = all.filter(
    (r) => card.test(r.selector) && r.selector.includes('light') && r.body.includes('background')
  );
  expect(base.length, 'no base .persona-card rule in the built CSS').toBeGreaterThan(0);
  expect(light.length, 'no light-theme .persona-card override in the built CSS').toBeGreaterThan(0);
  for (const r of light) {
    expect(
      beats(specificity(r.selector.split(',')[0]), maxSpec(base)),
      `${r.file}: ${r.selector} must out-rank the base .persona-card rule`
    ).toBe(true);
  }
});

it('puts the resting border of the interactive nodes on --border-active', () => {
  for (const t of ['role-', 'cta-']) {
    const rules = cssRules().filter(
      (r) =>
        r.selector.includes('data-node^=') &&
        r.selector.includes(t) &&
        r.body.includes('border-color')
    );
    expect(
      rules.length,
      `no resting-border rule for [data-node^='${t}…'] in the built CSS`
    ).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.body, `${r.file}: ${r.selector} does not use --border-active`).toContain(
        '--border-active'
      );
      expect(
        beats(specificity(r.selector.split(',')[0]), [0, 2, 0]),
        `${r.file}: ${r.selector} must out-rank the scoped 0,2,0 border it overrides`
      ).toBe(true);
    }
  }
});

// ── Mobile width contract (PRD §14.1) ────────────────────────────────────────
// `/` measured 635px wide on a 375, 390 and 412px phone. Every node's size was
// an inline `width: 620px` / `540px` declaration, and an inline declaration
// out-ranks *every* stylesheet rule — so the stacked fallback's `inline-size:
// auto`, however specific, never applied and the board kept its world width.
//
// The fix moves the size into the `--box-w` / `--box-h` custom properties that
// the stylesheet reads, so clearing it costs one ordinary rule. These assertions
// bind the root cause rather than the symptom: no node writes a size inline, the
// base rule reads the variable, and the reset that clears it out-ranks that
// base. A node re-adding an inline `width` fails the first one.

/** Every rule the built site ships — `_astro/*.css` plus any `<style>` inlined
 * into a page, since Astro decides per build which of the two a scoped block
 * becomes. */
/** Whitespace-insensitive: the build minifies CSS, so `inline-size: auto`
 * arrives as `inline-size:auto`. */
const flat = (s: string): string => s.replace(/\s+/g, '');

const allRules = (): { selector: string; body: string; file: string }[] => {
  const out = cssRules();
  for (const { file } of PAGES) {
    for (const block of html.get(file)!.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      for (const r of block[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        out.push({ selector: r[1].trim(), body: r[2].trim(), file: `${file} <style>` });
      }
    }
  }
  return out;
};

it('writes no node size inline, so the stacked reset can always win', () => {
  for (const { file } of PAGES) {
    const tags = [...html.get(file)!.matchAll(/<[^>]*\bclass="[^"]*\bcanvas-node\b[^"]*"[^>]*>/g)].map(
      (m) => m[0]
    );
    expect(tags.length, `${file}: no .canvas-node elements in the built HTML`).toBeGreaterThan(0);
    for (const tag of tags) {
      const style = tag.match(/\bstyle="([^"]*)"/)?.[1] ?? '';
      expect(
        style,
        `${file}: a node declares its width inline — an inline declaration out-ranks the stacked reset: ${tag}`
      ).not.toMatch(/(?:^|;)\s*(?:inline-size|width)\s*:/);
      expect(
        style,
        `${file}: a node declares its height inline — an inline declaration out-ranks the stacked reset: ${tag}`
      ).not.toMatch(/(?:^|;)\s*(?:min-block-size|min-height)\s*:/);
    }
  }
});

it('stacks the nodes with a reset that out-ranks the variable-reading base', () => {
  const all = allRules();
  const base = all.filter(
    (r) => r.selector.includes('.canvas-node') && flat(r.body).includes('inline-size:var(--box-w')
  );
  const reset = all.filter(
    (r) =>
      r.selector.includes('canvas-static') &&
      r.selector.includes('.canvas-node') &&
      flat(r.body).includes('inline-size:auto')
  );
  expect(base.length, 'no .canvas-node rule reads --box-w in the built CSS').toBeGreaterThan(0);
  expect(reset.length, 'no html.canvas-static .canvas-node reset in the built CSS').toBeGreaterThan(0);
  for (const r of reset) {
    expect(
      beats(specificity(r.selector.split(',')[0]), maxSpec(base)),
      `${r.file}: ${r.selector} does not out-rank the --box-w base rule`
    ).toBe(true);
  }
});

it('keeps the two stacked-reset lists in step', () => {
  const all = allRules();
  const decls = (body: string): string[] =>
    body
      .split(';')
      .map((s) => s.replace(/\s*:\s*/g, ':').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .sort();
  const resets = all.filter(
    (r) => r.selector.includes('.canvas-node') && flat(r.body).includes('inline-size:auto')
  );
  const staticReset = resets.filter((r) => r.selector.includes('canvas-static'));
  const thresholdReset = resets.filter((r) => !r.selector.includes('canvas-static'));
  expect(staticReset.length, 'no html.canvas-static .canvas-node reset').toBeGreaterThan(0);
  expect(
    thresholdReset.length,
    'no `max-width: 899px` .canvas-node reset'
  ).toBeGreaterThan(0);
  const reference = decls(staticReset[0].body);
  for (const r of [...staticReset, ...thresholdReset]) {
    expect(
      decls(r.body),
      `${r.file}: ${r.selector} has drifted from the shared stacked-reset list`
    ).toEqual(reference);
  }
});
