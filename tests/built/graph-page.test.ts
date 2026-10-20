// The graph page as a full-width board, against the REAL built output.
//
// Why this file exists: `bare` (component) and `bleed` (layout) are two optional
// props whose absence is silent — the page still builds and still shows a graph,
// only inside a card in a 1180px column, which is exactly the state the board
// replaced. Nothing in tests/lib can see a prop; only dist/ can.
//
// The card the role landings embed must survive untouched, so `/colleague/` is
// asserted as the control: same component, no `kg-bare`.
//
// Requires `bun run build` first (reads dist/*.html).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

const PAGES = [
  { file: 'graph/index.html', h1: 'Граф контента', note: 'Собирается из коллекций на build-time' },
  { file: 'en/graph/index.html', h1: 'Content graph', note: 'Built from the content collections' },
] as const;

const CONTROL = 'colleague/index.html';

const html = new Map<string, string>();

/** Every built stylesheet, concatenated — the CSS half of the assertions below. */
function builtCss(): string {
  const dir = resolve(DIST, '_astro');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(resolve(dir, f), 'utf8'))
    .join('\n');
}

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const p of [...PAGES.map((p) => p.file), CONTROL]) {
    const path = resolve(DIST, p);
    if (!existsSync(path)) throw new Error(`built page missing: ${p}`);
    html.set(p, readFileSync(path, 'utf8'));
  }
});

describe('graph page board (built HTML)', () => {
  for (const { file, h1, note } of PAGES) {
    const doc = () => html.get(file)!;

    it(`${file}: is a board page, not a locked full-screen canvas`, () => {
      // `bleed` releases the reading column; `canvas-fullbleed` would instead
      // lock the document to 100dvh, which this page must not do (it scrolls).
      expect(doc()).toMatch(/<html[^>]*class="[^"]*\bbleed\b[^"]*"/);
      expect(doc()).not.toMatch(/class="[^"]*canvas-fullbleed/);
      expect(doc()).toContain('canvas-static');
    });

    it(`${file}: the section is the board, not a container`, () => {
      expect(doc()).toContain('class="graph-board reveal"');
      expect(doc()).toContain('graph-board-head');
      expect(doc()).toContain('graph-board-gen');
      expect(doc()).not.toContain('<section class="container');
    });

    it(`${file}: exactly one h1, and it is the page title`, () => {
      const h1s = doc().match(/<h1[\s>]/g) ?? [];
      expect(h1s.length).toBe(1);
      expect(doc()).toContain(`>${h1}</h1>`);
      expect(doc()).toContain(note);
    });

    it(`${file}: the graph renders bare (no card surface)`, () => {
      expect(doc()).toMatch(/id="kg-root"[^>]*class="[^"]*\bkg-bare\b/);
    });

    it(`${file}: the drawing is unchanged and cannot be stretched`, () => {
      expect(doc()).toContain('viewBox="0 0 900 560"');
      expect(doc()).toMatch(/preserveAspectRatio="[^"]*meet[^"]*"/);
    });

    it(`${file}: the JS-off and screen-reader content survives the rework`, () => {
      expect(doc()).toContain('id="kg-sr-desc"');
      expect(doc()).toContain('src/lib/graph.ts');
    });

    it(`${file}: both cores carry their owner-specified colour`, () => {
      // The ring paints through a custom property, so the colour lives in the
      // node's inline style rather than in a `fill` attribute. articles is a
      // theme token, not a hex: #1400c3 is unreadable on the dark page, so the
      // themes lighten it (see the token test below). projects is one orange in
      // every theme.
      expect(doc()).toContain('--kg-ring:var(--kg-core-articles)');
      expect(doc()).toContain('--kg-ring:#ff4e02');
    });
  }

  it(`${CONTROL}: the embedded graph keeps its card`, () => {
    const doc = html.get(CONTROL)!;
    expect(doc).toContain('id="kg-root"');
    expect(doc).not.toContain('kg-bare');
    expect(doc).not.toContain('class="graph-board');
  });
  it('every node ships as an empty ring, coloured only through --kg-ring', () => {
    // The whole drawing is contour at rest: a node paints nothing until it is
    // hovered or focused ("touch"), and its colour is parked in a custom property
    // on the <g>. It has to be the property rather than the `fill` attribute —
    // the client's community switch recolours nodes, and a class rule outranks an
    // attribute, so an attribute would be silently dead.
    for (const { file } of PAGES) {
      const doc = html.get(file)!;
      const data = JSON.parse(doc.match(/id="kg-data"[^>]*>([\s\S]*?)<\/script>/)![1]);
      const rings = doc.match(/<circle r="[^"]*" class="kg-ring"[^>]*>/g) ?? [];

      // One ring per node in the serialized graph — not a subset of them.
      expect(rings.length, file).toBe(data.nodes.length);
      for (const ring of rings) expect(ring).not.toContain('fill=');

      const gs = doc.match(/<g[^>]*style="[^"]*--kg-ring:[^"]*"[^>]*>/g) ?? [];
      expect(gs.length, file).toBe(rings.length);

      // Still sectioned rather than one grey silhouette.
      const hues = new Set(gs.map((g) => g.match(/--kg-ring:([^;"]*)/)![1]));
      expect(hues.size, file).toBeGreaterThan(1);

      // Nothing in the *graph board* keeps a painted fill: the contour is the
      // whole look. Scoped to the #kg-root subtree on purpose — an unscoped
      // document scan also matches page chrome (a nav icon glyph has a filled
      // <circle>), which is not what this claim is about. The per-ring check
      // above is the precise one; this one covers the rest of the board
      // (legend, hit lines, tooltip).
      const fromRoot = doc.slice(doc.indexOf('id="kg-root"'));
      const board = fromRoot.slice(0, fromRoot.indexOf('id="kg-data"'));
      expect(board.length, file).toBeGreaterThan(0);
      expect(board.match(/<circle [^>]*fill="/g) ?? [], file).toHaveLength(0);
    }
  });

  it('the ring is hollow at rest and painted on hover or focus (built CSS)', () => {
    const css = builtCss();

    const base = css.match(/\.kg-ring[^{]*\{[^}]*\}/)?.[0] ?? '';
    expect(base).toContain('fill:none');
    expect(base).toContain('stroke:var(--kg-ring)');
    // Without this a hollow circle is not hit-testable (SVG's default is
    // `visiblePainted`), so a node's interior would be a dead zone the pointer
    // fell through to the transparent edge hit-lines — and the hover that fills
    // the ring could never fire.
    expect(base).toContain('pointer-events:all');

    const painted = css.match(/[^{}]*:is\(g\[tabindex\]:hover\)[^{}]*kg-ring[^{}]*\{[^}]*\}/)?.[0] ?? '';
    expect(painted).toContain('fill:var(--kg-ring)');
    expect(css).toMatch(/:is\(g\[tabindex\]:focus\)[^{}]*kg-ring/);
  });
});

describe('graph core colour token (built CSS)', () => {
  it('defines --kg-core-articles once per theme, and only light keeps the hex', () => {
    // Three values, three scopes, one order. Nothing else in the build binds
    // them: drop the light override and the cream page silently gets the
    // washed-out #8d82ff, keep a dark hex on dark and the hub sinks into the
    // #1400c3 page ground (2.52:1).
    const css = builtCss();

    const scopes = [...css.matchAll(/--kg-core-articles:\s*(#[0-9a-fA-F]{6})/g)].map((m) => {
      const before = css.slice(0, m.index);
      return [before.slice(before.lastIndexOf('}') + 1, before.lastIndexOf('{')).trim(), m[1]];
    });

    expect(scopes).toEqual([
      [':root', '#8d82ff'],
      ['[data-theme=light]', '#1400c3'],
      ['[data-theme=cyberpunk]', '#6a5cff'],
    ]);
  });
});

// The fullscreen toggle, against the REAL built CSS.
//
// Why this file has to hold it: the button's whole job is a `position: fixed`
// overlay, and that layout has three ways to fail silently — each of which the
// build cannot see. Every one of them shipped at once, and clicking the button
// on `/graph/` grew the drawing from 592px tall to 25px.
//
//   1. `.kg-root.kg-fullscreen` was `position: fixed; inset: 0`, but its
//      ancestor `<section class="graph-board reveal">` kept a residual
//      `transform: translateY(0)`. AN IDENTITY MATRIX IS STILL A TRANSFORM, and
//      a transformed element is the containing block for `position: fixed`
//      descendants — so the overlay sized itself to the section (1280x212 at a
//      1280x800 window), not the viewport.
//   2. `.kg-root.kg-bare .kg-svg` caps the width of the *embedded* board. It
//      kept applying inside the overlay and clamped the drawing to 951px where
//      the aspect ratio allowed 986px.
//   3. The z-scale puts `--z-overlay` (1000) *below* the always-sticky top bar,
//      which shares `--z-dialog` (1200) with the drawer it opens. The overlay
//      sat under the 65px bar, so its entire first row — the search box, the
//      legend and the zoom/exit controls — was behind it and unclickable.
//
// A browser pass is what proves the layout; these assertions are the ratchet
// that keeps the three conditions from coming back unnoticed. `/colleague/` is
// the control: the same component, no `.kg-bare`, and no `.reveal` ancestor.

describe('graph fullscreen overlay (built CSS)', () => {
  it('settles the reveal animation on `none`, so a fixed child escapes it', () => {
    const settled = builtCss().match(/\.reveal\.visible\s*\{[^}]*\}/)?.[0] ?? '';
    expect(settled).toContain('transform:none');
    // `translateY(0)` is the trap: visually identical, still a containing block.
    expect(settled).not.toContain('translateY');
    expect(builtCss()).not.toMatch(/\.reveal\.visible[^{]*\{[^}]*translateY/);
  });

  it('lifts the overlay above the sticky top bar', () => {
    const css = builtCss();
    const overlay = css.match(/\.kg-root[^{]*\.kg-fullscreen\s*\{[^}]*\}/)?.[0] ?? '';
    expect(overlay).toContain('position:fixed');
    expect(overlay).toContain('inset:0');
    // Above `--z-dialog`, i.e. above the bar. `--z-overlay` is the drawer scrim
    // and is deliberately under it.
    expect(overlay).toContain('z-index:var(--z-fullscreen)');
    const scale = css.match(/--z-fullscreen:\s*(\d+)/)?.[1];
    const dialog = css.match(/--z-dialog:\s*(\d+)/)?.[1];
    expect(Number(scale)).toBeGreaterThan(Number(dialog));
  });

  it('keeps the bare width cap out of the overlay', () => {
    // The guard is the selector, not the cap: without `:not(.kg-fullscreen)`
    // the rule still matches inside the overlay (`kg-bare` stays on the root)
    // and steals drawing width.
    expect(builtCss()).toContain('kg-bare:not(.kg-fullscreen) .kg-svg');
    expect(builtCss()).not.toContain('kg-bare .kg-svg');
  });

  it('gives the overlay the page gutter, not a fixed one of its own', () => {
    // `--page-pad` drops to 15px under 768px; a hardcoded `--space-5` (20px)
    // made the fullscreen drawing narrower than the inline one on a phone
    // (345px -> 333px at 375px), and `.kg-root`'s 1px border took two more.
    const overlay = builtCss().match(/\.kg-root[^{]*\.kg-fullscreen\s*\{[^}]*\}/)?.[0] ?? '';
    expect(overlay).toMatch(/padding:[^;]*var\(--page-pad\)/);
    expect(overlay).toContain('border:0');
  });
});
