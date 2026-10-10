# Canvas Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/` and `/en/` hero + role gate read as an Excalidraw-style canvas — dot-grid field, hand-jittered sketchy frames, pan/zoom viewport — while every word stays real, crawlable, screen-readable DOM.

**Architecture:** A CSS transform layer over semantic HTML. `.canvas-viewport` (100vh, `overflow: hidden`) contains `.canvas-world`, which carries `transform: translate(var(--vp-tx), var(--vp-ty)) scale(var(--vp-k))`. Inside the world: a dot-grid layer, an `aria-hidden` SVG sketch layer (deterministic jittered frames generated at build time), and `.canvas-nodes` holding the real `<h1>`, `<p>`, `<a>`. Node coordinates are data in `src/lib/canvas-layout.ts`; the shape generator is `src/lib/sketch.ts`. Both are pure and unit-tested. The initial viewport fits the whole board, so nothing is discoverable-only-by-interaction.

**Tech Stack:** Astro 7.2.9 (`output: 'static'`, TypeScript 5.9), CSS custom properties, `bun test` (unit + built-output), no new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-10-canvas-homepage-design.md` — this plan implements it and records three deliberate deviations (see *Deviations* below). Read both.

## Global Constraints

- Astro `output: 'static'`, **no `base` configured** — every internal href goes through `withBase()` from `src/lib/path.ts`.
- **No new runtime dependency.** `roughjs` is permitted **only** as a devDependency, build-time, and only if the sketch quality check fails (Task 1 Step 9).
- No raw hex outside `src/lib/brand.ts`. All colour comes from tokens in `src/styles/global.css`.
- Never put a `--dv-*` token on anything interactive (`DESIGN.md`).
- Zoom range **0.6–2.2**. Wheel **scrolls the page**; it never zooms.
- Analytics event names and payloads are frozen: `persona_gate_view`, `persona_selected`, `cta_exposure`, `booking_click`, `cv_download_pdf`, and the `is-stored` / `is-suggested` classes.
- `src/components/PersonaGate.astro` is **not deleted** — it stays until the canvas is confirmed better on a real viewport.
- Node DOM order is the reading order and never follows visual coordinates.
- `bun run build` must succeed before any `tests/built/*` file runs; `tests/lib/*` needs no build.
- Commit per task, conventional style, lowercase subject, no attribution trailer. **Do not push** — push needs the owner's explicit approval.
- LHCI does **not** emulate `prefers-color-scheme`: light-theme contrast bugs do not reproduce in CI. Both themes are checked by hand in Task 8.

## Deviations from the spec

Three spec values are amended. Each is load-bearing, and each is bound by a test in this plan.

| Spec says | Plan does | Why |
|---|---|---|
| World 1600×900 | World **1440×900** | The spec also requires `k ≈ 1 at 1440×900`. With a 1600-wide world and `pad=0`, `fitScale(1440×900)` = 0.9, so the claim is false. A 1440-wide world makes it exactly 1, and every node box is inset ≥80 world px from the world edge, which supplies the padding without a `pad` term. |
| Static stack below **768px** | Static stack below **900px** | `clampCanvasZoom` floors at 0.6. At a viewport narrower than 1440 × 0.6 = **864px** the board cannot fit and `overflow: hidden` would clip the role cards. 900px gives margin. 768–864 would have shipped a silent horizontal cut-off. |
| Reuses `src/lib/graph-zoom.ts` for pan/zoom math | Canvas math lives in `canvas-layout.ts`; `graph-zoom` is imported for the `WorldSize` type only | `graph-zoom`'s `Viewport` parameterises a **viewBox window** (`world.w / vp.k`), not a CSS transform (`world * k + t`). Bridging the two needs a scale-and-recentre adapter larger and less obvious than the ~25 lines of CSS-space math it replaces. `graph-zoom`'s `clampZoom` bounds (0.3–4) also differ from the canvas range. `KnowledgeGraph.astro` is untouched and keeps using it. |

## Review Focus

The five inputs and conditions most likely to bite a real visitor, and the task whose tests pin each one.

| # | Input / condition | What a person expects | Pinned by |
|---|---|---|---|
| 1 | **JavaScript disabled, or the module script fails to load** | Every word and all four links are still reachable and readable | Task 3 (SSR emits a transform that never clips at ≥1440px) + Task 7 (built HTML carries all links with JS absent) |
| 2 | **Windows between 900px and 1440px wide** | Text is smaller but legible; no card is cut off at the right edge | Task 2 (`fitScale` ≥ 0.6 and the fitted viewport contains every node centre at 900/1024/1280) + Task 7 |
| 3 | **`prefers-reduced-motion: reduce`** | No animated panning or zooming — changes are instant | Task 3 (transition gated on the media query) |
| 4 | **Light and cyberpunk themes** | Sketch strokes, node borders and the dot grid clear the 3:1 non-text floor, and body text keeps its ratio | Task 6 (tokens only) + Task 8 (measured in all three themes) |
| 5 | **Keyboard Tab through the page** | Focus lands on every link in reading order and the target node is brought into view without stealing the scroll position of the page | Task 3 (`focusin` → `focusNode`, no `preventScroll`) |

Each of these also gets a concrete assertion inside its owning task, in that task's own step style.

---

### Task 1: Sketchy frame generator

**Files:**
- Create: `src/lib/sketch.ts`
- Create: `tests/lib/sketch.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `JITTER: number`, `OVERSHOOT: number`, `PASSES: number`, `interface SketchRect { paths: string[]; points: number; amplitude: number }`, `hashString(input: string): number`, `mulberry32(seed: number): () => number`, `sketchRect(w: number, h: number, seed: number, amplitude?: number): SketchRect`, `sketchRectFor(id: string, w: number, h: number, amplitude?: number): SketchRect`. Task 3 calls `sketchRectFor` once per node.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/sketch.test.ts`. The header states the drift it catches, matching the house style of `tests/lib/homepage-stack.test.ts`.

```ts
// Deterministic hand-jitter for the canvas frame layer.
//
// The generated `d` strings are inlined into the built HTML, so a generator that
// drifts between runs would produce a different page on every build and would
// make the sketch layer untestable. The amplitude bound is asserted against a
// HARDCODED literal (2.5) rather than against the module's own JITTER, so that
// raising JITTER in src/lib/sketch.ts turns this file red — a test that read the
// constant it is checking could never bite.
import { describe, it, expect } from 'bun:test';
import {
  JITTER,
  PASSES,
  hashString,
  mulberry32,
  sketchRect,
  sketchRectFor,
} from '../../src/lib/sketch';

const MAX_JITTER = 2.5; // must exceed src JITTER (2.2) but stay tight

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays inside [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashString', () => {
  it('is stable and unsigned', () => {
    expect(hashString('role-hr')).toBe(hashString('role-hr'));
    expect(hashString('role-hr')).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashString('role-hr'))).toBe(true);
  });

  it('separates similar ids', () => {
    expect(hashString('role-hr')).not.toBe(hashString('role-manager'));
  });
});

describe('sketchRect', () => {
  it('emits one path per pass and four vertices per pass', () => {
    const r = sketchRect(320, 180, 1);
    expect(r.paths.length).toBe(PASSES);
    expect(r.points).toBe(4 * PASSES);
    for (const d of r.paths) {
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith(' Z')).toBe(true);
    }
  });

  it('returns identical paths for the same seed', () => {
    expect(sketchRect(320, 180, 7)).toEqual(sketchRect(320, 180, 7));
  });

  it('returns different paths for different seeds', () => {
    expect(sketchRect(320, 180, 7).paths).not.toEqual(sketchRect(320, 180, 8).paths);
  });

  it('jitters — but never beyond the declared amplitude', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { amplitude } = sketchRect(320, 180, seed);
      expect(amplitude).toBeGreaterThan(0.5); // the generator is actually moving vertices
      expect(amplitude).toBeLessThanOrEqual(MAX_JITTER); // and staying bounded
    }
  });

  it('draws the exact rectangle when amplitude is 0, overshooting each corner', () => {
    // cx=50, cy=25, OVERSHOOT=1.06 → each corner is pushed 6% outward from centre.
    expect(sketchRect(100, 50, 1, 0).paths[0]).toBe(
      'M-3.00 -1.50 L103.00 -1.50 L103.00 51.50 L-3.00 51.50 Z'
    );
  });

  it('leaves the module JITTER inside the hardcoded bound', () => {
    // Guards the coupling: if JITTER grows past MAX_JITTER the amplitude test
    // above starts failing for an unobvious reason. Fail here, where it reads.
    expect(JITTER).toBeLessThanOrEqual(MAX_JITTER);
    expect(JITTER).toBeGreaterThan(0.5);
  });
});

describe('sketchRectFor', () => {
  it('seeds from the node id, so each frame draws its own stable shape', () => {
    expect(sketchRectFor('identity', 620, 210)).toEqual(sketchRectFor('identity', 620, 210));
    expect(sketchRectFor('identity', 620, 210).paths).not.toEqual(
      sketchRectFor('claim', 620, 120).paths
    );
  });

  it('equals sketchRect at the id-derived seed, so there is one generator', () => {
    expect(sketchRectFor('role-hr', 540, 180)).toEqual(
      sketchRect(540, 180, hashString('role-hr'))
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/lib/sketch.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/sketch'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/sketch.ts`.

```ts
// Hand-jittered rectangle paths for the canvas frame layer. Deterministic: the
// same (w, h, seed) always yields the same `d` strings, so the built HTML is
// stable across builds and the paths are assertable in a unit test.
//
// The sloppiness model is Excalidraw's: a rectangle is drawn as four corner-to-
// corner strokes, each vertex pushed outward from the frame's centre so strokes
// overshoot their corners, then retraced once with fresh offsets. Offsets are
// bounded by `amplitude`, so nothing drifts far enough to read as a mistake.

/** Maximum perpendicular offset applied to a vertex, in world px. */
export const JITTER = 2.2;

/** Corner push factor. 1.06 = each corner sits 6% further from the centre. */
export const OVERSHOOT = 1.06;

/** Strokes per rectangle. */
export const PASSES = 2;

export interface SketchRect {
  /** SVG `d` strings, one per pass. */
  paths: string[];
  /** Vertices emitted across all passes. */
  points: number;
  /** Largest absolute offset observed, in world px. */
  amplitude: number;
}

/** FNV-1a, unsigned. Stable across runs — this is what makes `sketchRectFor` reproducible. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small, fast, seedable PRNG. Uniform in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One offset in [-amplitude, +amplitude]. */
function offset(rand: () => number, amplitude: number): number {
  return (rand() * 2 - 1) * amplitude;
}

/** The four corners, clockwise from top-left, each pushed outward by OVERSHOOT. */
function corners(w: number, h: number): Array<[number, number]> {
  const cx = w / 2;
  const cy = h / 2;
  const push = (x: number, y: number): [number, number] => [
    cx + (x - cx) * OVERSHOOT,
    cy + (y - cy) * OVERSHOOT,
  ];
  return [push(0, 0), push(w, 0), push(w, h), push(0, h)];
}

export function sketchRect(w: number, h: number, seed: number, amplitude = JITTER): SketchRect {
  const rand = mulberry32(seed);
  const pts = corners(w, h);
  const paths: string[] = [];
  let points = 0;
  let max = 0;

  for (let pass = 0; pass < PASSES; pass++) {
    const verts = pts.map(([x, y]): [number, number] => {
      const dx = offset(rand, amplitude);
      const dy = offset(rand, amplitude);
      max = Math.max(max, Math.abs(dx), Math.abs(dy));
      return [x + dx, y + dy];
    });
    paths.push(
      verts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z'
    );
    points += verts.length;
  }

  return { paths, points, amplitude: Number(max.toFixed(2)) };
}

/** The shape for one node, seeded by its id so it is stable build to build. */
export function sketchRectFor(id: string, w: number, h: number, amplitude = JITTER): SketchRect {
  return sketchRect(w, h, hashString(id), amplitude);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/lib/sketch.test.ts`
Expected: PASS, 12 assertions green.

- [ ] **Step 5: Confirm the test bites (mutation control)**

Temporarily change `export const JITTER = 2.2;` to `= 10;` and run the test.
Expected: FAIL on *"jitters — but never beyond the declared amplitude"* **and** on *"leaves the module JITTER inside the hardcoded bound"*. Then change it to `0` and run again.
Expected: FAIL on *"jitters — but never beyond …"* (amplitude `0` is not `> 0.5`). Revert to `2.2` and re-run to green.

- [ ] **Step 6: Typecheck and lint**

Run: `bun run check && bun run lint 2>/dev/null || bunx tsc --noEmit -p tsconfig.tests.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sketch.ts tests/lib/sketch.test.ts
git commit -m "feat: add deterministic sketchy-frame path generator for the canvas layer"
```

---

### Task 2: Canvas layout and viewport math

**Files:**
- Create: `src/lib/canvas-layout.ts`
- Create: `tests/lib/canvas-layout.test.ts`

**Interfaces:**
- Consumes: `WorldSize` from `./graph-zoom` (type only).
- Produces: `NodeId`, `NodeKind`, `interface NodeBox { id: NodeId; x: number; y: number; w: number; h: number; kind: NodeKind }`, `WORLD: WorldSize`, `MIN_ZOOM`, `MAX_ZOOM`, `NODES: NodeBox[]`, `interface CanvasViewport { tx: number; ty: number; k: number }`, `nodeById(id: NodeId): NodeBox`, `nodeCenter(box: NodeBox)`, `clampCanvasZoom(k: number): number`, `fitViewport(viewportPx: { w: number; h: number }, pad?: number): CanvasViewport`, `applyPan(vp: CanvasViewport, dx: number, dy: number): CanvasViewport`, `applyZoomAt(vp: CanvasViewport, anchorScreen: { x: number; y: number }, requested: number): CanvasViewport`, `focusNode(box: NodeBox, viewportPx: { w: number; h: number }, k: number): CanvasViewport`, `toWorld(vp: CanvasViewport, screen: { x: number; y: number }): { x: number; y: number }`, `viewportVars(vp: CanvasViewport): Record<'--vp-tx' | '--vp-ty' | '--vp-k', string>`.
- `screen = world * k + (tx, ty)` — this is exactly what the CSS transform does, so no adapter is needed between the math and the stylesheet. `canvas-layout.ts` must **not** import `Viewport`, `panBy`, `zoomAt`, `centerOn`, `clampZoom` or `viewBoxOf` from `graph-zoom` (see *Deviations*).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/canvas-layout.test.ts`.

```ts
// Canvas node geometry and viewport math.
//
// Two claims here are load-bearing and neither is visible in a screenshot:
// (a) every node box sits fully inside the world, so the sketch frame layer can
// anchor to it without drawing off-board; (b) the fitted viewport contains every
// node CENTRE at the widths the site actually gets (900, 1024, 1280, 1440), which
// is what keeps the role gate working without any interaction. A regression in
// either silently ships a clipped card.
import { describe, it, expect } from 'bun:test';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NODES,
  WORLD,
  applyPan,
  applyZoomAt,
  clampCanvasZoom,
  fitViewport,
  focusNode,
  nodeById,
  nodeCenter,
  toWorld,
  viewportVars,
  type NodeBox,
} from '../../src/lib/canvas-layout';

const WIDTHS = [
  { w: 900, h: 700 },
  { w: 1024, h: 768 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
];

/** Where a world point lands on screen under a viewport. */
const project = (vp: { tx: number; ty: number; k: number }, p: { x: number; y: number }) => ({
  x: p.x * vp.k + vp.tx,
  y: p.y * vp.k + vp.ty,
});

describe('NODES', () => {
  it('declares all eight nodes with unique ids', () => {
    expect(NODES.length).toBe(8);
    expect(new Set(NODES.map((n) => n.id)).size).toBe(8);
  });

  it('keeps the reading order, independent of visual position', () => {
    expect(NODES.map((n) => n.id)).toEqual([
      'identity',
      'claim',
      'cta-booking',
      'cta-cv',
      'role-hr',
      'role-manager',
      'role-colleague',
      'projects-all',
    ]);
  });

  it('puts every box fully inside the world', () => {
    for (const n of NODES) {
      expect(n.x, `${n.id} x`).toBeGreaterThanOrEqual(0);
      expect(n.y, `${n.id} y`).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w, `${n.id} right`).toBeLessThanOrEqual(WORLD.w);
      expect(n.y + n.h, `${n.id} bottom`).toBeLessThanOrEqual(WORLD.h);
    }
  });

  it('insets every box from the world edge, which is the fit padding', () => {
    for (const n of NODES) {
      expect(Math.min(n.x, n.y), `${n.id} inset`).toBeGreaterThanOrEqual(80);
    }
  });

  it('never overlaps two boxes', () => {
    for (let i = 0; i < NODES.length; i++) {
      for (let j = i + 1; j < NODES.length; j++) {
        const a = NODES[i];
        const b = NODES[j];
        const disjoint =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(disjoint, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });

  it('has link boxes no shorter than a touch target and text boxes no narrower than a line', () => {
    for (const n of NODES) {
      if (n.kind === 'link') expect(n.h, `${n.id} height`).toBeGreaterThanOrEqual(44);
      if (n.kind === 'text') expect(n.w, `${n.id} width`).toBeGreaterThanOrEqual(320);
    }
  });
});

describe('nodeById / nodeCenter', () => {
  it('finds a box and throws on an unknown id', () => {
    expect(nodeById('identity').w).toBeGreaterThan(0);
    expect(() => nodeById('nope' as NodeBox['id'])).toThrow();
  });

  it('puts the centre halfway across and down', () => {
    expect(nodeCenter({ id: 'identity', x: 100, y: 50, w: 400, h: 200, kind: 'text' })).toEqual({
      x: 300,
      y: 150,
    });
  });
});

describe('clampCanvasZoom', () => {
  it('holds the canvas range, tighter than the graph page', () => {
    expect(clampCanvasZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampCanvasZoom(9)).toBe(MAX_ZOOM);
    expect(clampCanvasZoom(1.4)).toBe(1.4);
    expect(MIN_ZOOM).toBe(0.6);
    expect(MAX_ZOOM).toBe(2.2);
  });
});

describe('fitViewport', () => {
  it('fits at exactly k = 1 on the reference 1440x900 window', () => {
    const vp = fitViewport({ w: 1440, h: 900 });
    expect(vp.k).toBeCloseTo(1, 5);
    expect(vp.tx).toBeCloseTo(0, 5);
    expect(vp.ty).toBeCloseTo(0, 5);
  });

  it('brings every node centre on screen at every supported width', () => {
    for (const size of WIDTHS) {
      const vp = fitViewport(size);
      expect(vp.k, `${size.w}: scale`).toBeGreaterThanOrEqual(MIN_ZOOM);
      expect(vp.k, `${size.w}: scale`).toBeLessThanOrEqual(MAX_ZOOM);
      for (const n of NODES) {
        const s = project(vp, nodeCenter(n));
        expect(s.x, `${size.w}: ${n.id} left`).toBeGreaterThanOrEqual(0);
        expect(s.x, `${size.w}: ${n.id} right`).toBeLessThanOrEqual(size.w);
        expect(s.y, `${size.w}: ${n.id} top`).toBeGreaterThanOrEqual(0);
        expect(s.y, `${size.w}: ${n.id} bottom`).toBeLessThanOrEqual(size.h);
      }
    }
  });

  it('fits every node BOX too, not just its centre, at 1280 and up', () => {
    for (const size of WIDTHS.filter((s) => s.w >= 1280)) {
      const vp = fitViewport(size);
      for (const n of NODES) {
        const tl = project(vp, { x: n.x, y: n.y });
        const br = project(vp, { x: n.x + n.w, y: n.y + n.h });
        expect(tl.x, `${size.w}: ${n.id} left`).toBeGreaterThanOrEqual(0);
        expect(tl.y, `${size.w}: ${n.id} top`).toBeGreaterThanOrEqual(0);
        expect(br.x, `${size.w}: ${n.id} right`).toBeLessThanOrEqual(size.w);
        expect(br.y, `${size.w}: ${n.id} bottom`).toBeLessThanOrEqual(size.h);
      }
    }
  });

  it('centres the board, leaving equal slack on both sides of the tight axis', () => {
    const size = { w: 1024, h: 768 };
    const vp = fitViewport(size);
    expect(vp.tx).toBeCloseTo((size.w - WORLD.w * vp.k) / 2, 5);
    expect(vp.ty).toBeCloseTo((size.h - WORLD.h * vp.k) / 2, 5);
  });
});

describe('applyPan', () => {
  it('translates in screen pixels and leaves the scale alone', () => {
    const vp = { tx: 10, ty: 20, k: 1.5 };
    expect(applyPan(vp, -10, 5)).toEqual({ tx: 0, ty: 25, k: 1.5 });
  });
});

describe('applyZoomAt', () => {
  it('keeps the anchor pinned on screen — the defining property of zoom-at-pointer', () => {
    const vp = { tx: 40, ty: 30, k: 1 };
    const anchor = { x: 300, y: 200 };
    const before = toWorld(vp, anchor);
    const after = toWorld(applyZoomAt(vp, anchor, 1.5), anchor);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });

  it('clamps at the range and reports the clamped scale', () => {
    expect(applyZoomAt({ tx: 0, ty: 0, k: 2 }, { x: 0, y: 0 }, 4).k).toBe(MAX_ZOOM);
    expect(applyZoomAt({ tx: 0, ty: 0, k: 0.7 }, { x: 0, y: 0 }, 0.5).k).toBe(MIN_ZOOM);
  });

  it('is a no-op factor when already clamped, rather than jumping to the anchor', () => {
    const vp = { tx: 100, ty: 100, k: MAX_ZOOM };
    expect(applyZoomAt(vp, { x: 500, y: 400 }, 2)).toEqual(vp);
  });
});

describe('focusNode', () => {
  it('centres the node in the viewport at the requested zoom', () => {
    const size = { w: 1200, h: 800 };
    const vp = focusNode(nodeById('role-manager'), size, 1.6);
    expect(vp.k).toBe(1.6);
    const s = project(vp, nodeCenter(nodeById('role-manager')));
    expect(s.x).toBeCloseTo(size.w / 2, 5);
    expect(s.y).toBeCloseTo(size.h / 2, 5);
  });

  it('clamps the requested zoom into the canvas range', () => {
    expect(focusNode(nodeById('claim'), { w: 1200, h: 800 }, 8).k).toBe(MAX_ZOOM);
  });
});

describe('toWorld', () => {
  it('inverts the projection', () => {
    const vp = { tx: 25, ty: -40, k: 1.25 };
    const screen = project(vp, { x: 333, y: 777 });
    expect(toWorld(vp, screen)).toEqual({ x: 333, y: 777 });
  });
});

describe('viewportVars', () => {
  it('emits the three CSS variables the world transform reads', () => {
    expect(viewportVars({ tx: 12.345, ty: -6.5, k: 0.94666 })).toEqual({
      '--vp-tx': '12.35px',
      '--vp-ty': '-6.50px',
      '--vp-k': '0.9467',
    });
  });

  it('emits a unitless scale, since scale() takes a number', () => {
    expect(viewportVars({ tx: 0, ty: 0, k: 1 })['--vp-k']).toBe('1');
    expect(viewportVars({ tx: 0, ty: 0, k: 1 })['--vp-k']).not.toContain('px');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/lib/canvas-layout.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/canvas-layout'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/canvas-layout.ts`.

```ts
// Node geometry and viewport math for the canvas homepage.
//
// The coordinate contract: a world point `p` lands at `p * k + (tx, ty)` on
// screen. That is literally what the world layer's CSS transform does
// (`translate(--vp-tx, --vp-ty) scale(--vp-k)` with `transform-origin: 0 0`), so
// these numbers go straight into the stylesheet with no adapter between them.
//
// Deliberately NOT built on src/lib/graph-zoom.ts — see the plan's Deviations
// table. graph-zoom's Viewport parameterises a viewBox window (world.w / k), not
// a CSS transform, and its clamp bounds (0.3-4) are wider than the canvas range.
import type { WorldSize } from './graph-zoom';

export type NodeId =
  | 'identity'
  | 'claim'
  | 'cta-booking'
  | 'cta-cv'
  | 'role-hr'
  | 'role-manager'
  | 'role-colleague'
  | 'projects-all';

export type NodeKind = 'text' | 'link';

export interface NodeBox {
  id: NodeId;
  /** World coordinates, top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: NodeKind;
}

/** The board. 1440x900 makes "k = 1 on a 1440x900 window" exactly true. */
export const WORLD: WorldSize = { w: 1440, h: 900 };

/** Canvas zoom range — tighter than the graph page's 0.3-4: this is a landing
 *  surface, not an exploration tool. The floor is also why the static-stack
 *  breakpoint is 900px: below 1440 * 0.6 = 864px the board cannot fit. */
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 2.2;

/**
 * Reading order, top to bottom. Visual position is deliberately independent of
 * this order — a crawler and a screen reader get the same document as before the
 * canvas existed. Coordinates are hand-authored; every box is inset at least 80
 * world px from the world edge, which is the fit padding.
 */
export const NODES: NodeBox[] = [
  { id: 'identity', x: 80, y: 90, w: 620, h: 210, kind: 'text' },
  { id: 'claim', x: 80, y: 330, w: 620, h: 120, kind: 'text' },
  { id: 'cta-booking', x: 80, y: 490, w: 240, h: 56, kind: 'link' },
  { id: 'cta-cv', x: 340, y: 490, w: 130, h: 56, kind: 'link' },
  { id: 'role-hr', x: 800, y: 120, w: 540, h: 180, kind: 'link' },
  { id: 'role-manager', x: 800, y: 340, w: 540, h: 180, kind: 'link' },
  { id: 'role-colleague', x: 800, y: 560, w: 540, h: 180, kind: 'link' },
  { id: 'projects-all', x: 800, y: 780, w: 540, h: 56, kind: 'link' },
];

/** A CSS-space viewport: `screen = world * k + (tx, ty)`. */
export interface CanvasViewport {
  tx: number;
  ty: number;
  k: number;
}

export function nodeById(id: NodeId): NodeBox {
  const box = NODES.find((n) => n.id === id);
  if (!box) throw new Error(`unknown canvas node: ${id}`);
  return box;
}

export function nodeCenter(box: NodeBox): { x: number; y: number } {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export function clampCanvasZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
}

/**
 * The starting viewport: the whole board, centred. This is the load-bearing
 * choice — h1 and all three role links are visible with zero interaction, so the
 * gate works, LCP is not deferred to a scroll, and there is no layout shift.
 * `pad` defaults to 0 because NODES are already inset from the world edge.
 */
export function fitViewport(viewportPx: { w: number; h: number }, pad = 0): CanvasViewport {
  const k = clampCanvasZoom(
    Math.min((viewportPx.w - pad * 2) / WORLD.w, (viewportPx.h - pad * 2) / WORLD.h)
  );
  return {
    tx: (viewportPx.w - WORLD.w * k) / 2,
    ty: (viewportPx.h - WORLD.h * k) / 2,
    k,
  };
}

/** Pan by a drag delta, which is already in screen pixels. */
export function applyPan(vp: CanvasViewport, dx: number, dy: number): CanvasViewport {
  return { tx: vp.tx + dx, ty: vp.ty + dy, k: vp.k };
}

/**
 * Zoom by `requested`, keeping the world point under `anchorScreen` fixed.
 * The applied factor is measured AFTER clamping, so a clamped call reports the
 * clamped scale instead of jumping the board to the anchor.
 */
export function applyZoomAt(
  vp: CanvasViewport,
  anchorScreen: { x: number; y: number },
  requested: number
): CanvasViewport {
  const k = clampCanvasZoom(vp.k * requested);
  const factor = k / vp.k;
  return {
    tx: anchorScreen.x - (anchorScreen.x - vp.tx) * factor,
    ty: anchorScreen.y - (anchorScreen.y - vp.ty) * factor,
    k,
  };
}

/** A viewport that puts `box`'s centre at the viewport centre. */
export function focusNode(
  box: NodeBox,
  viewportPx: { w: number; h: number },
  k: number
): CanvasViewport {
  const kk = clampCanvasZoom(k);
  const c = nodeCenter(box);
  return { tx: viewportPx.w / 2 - c.x * kk, ty: viewportPx.h / 2 - c.y * kk, k: kk };
}

/** Screen point, relative to the viewport element, to world coordinates. */
export function toWorld(vp: CanvasViewport, screen: { x: number; y: number }): { x: number; y: number } {
  return { x: (screen.x - vp.tx) / vp.k, y: (screen.y - vp.ty) / vp.k };
}

/** The three custom properties the world layer's transform reads. */
export function viewportVars(vp: CanvasViewport): {
  '--vp-tx': string;
  '--vp-ty': string;
  '--vp-k': string;
} {
  return {
    '--vp-tx': `${vp.tx.toFixed(2)}px`,
    '--vp-ty': `${vp.ty.toFixed(2)}px`,
    '--vp-k': String(Number(vp.k.toFixed(4))),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/lib/canvas-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm the test bites (mutation control)**

Change the `identity` box's `x` from `80` to `-20`, run the test.
Expected: FAIL on *"puts every box fully inside the world"* and on *"insets every box from the world edge"*. Then change `WORLD.w` from `1440` to `1600` and run.
Expected: FAIL on *"fits at exactly k = 1 on the reference 1440x900 window"* and on *"fits every node BOX too"*. Revert both; re-run to green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/canvas-layout.ts tests/lib/canvas-layout.test.ts
git commit -m "feat: add canvas node layout and css-space viewport math"
```

---

### Task 3: `CanvasStage.astro` — viewport, sketch layer, pan/zoom

**Files:**
- Create: `src/components/CanvasStage.astro`
- Modify: `src/styles/global.css` (append one `:global()` block — see Step 3)

**Interfaces:**
- Consumes: `WORLD`, `MIN_ZOOM`, `MAX_ZOOM`, `NODES`, `fitViewport`, `applyPan`, `applyZoomAt`, `focusNode`, `viewportVars`, `nodeById`, `type NodeId` from `../lib/canvas-layout`; `sketchRectFor` from `../lib/sketch`.
- Produces: a component with `interface Props { ariaLabel: string }` that renders `.canvas-viewport` and a `<slot />` which the caller fills with `.canvas-nodes`. Every slotted node element must carry `data-node="<NodeId>"`; the script reads that attribute for `focusin` centring. Task 4 supplies those elements.

- [ ] **Step 1: Write the component**

Create `src/components/CanvasStage.astro`.

````astro
---
// The canvas shell: a 100vh viewport whose world layer is panned and zoomed by a
// CSS transform over real DOM. Nothing here draws text — the sketch frames and
// the dot grid are decoration (`aria-hidden`), and the actual hero copy is
// slotted in as ordinary `<h1>` / `<p>` / `<a>`.
//
// The SSR transform is written inline so the first paint is already correct: with
// no `--vp-*` values the world would render at the origin at scale 1. A tiny
// `is:inline` script then refits it to the real window and, because it is
// synchronous and sits immediately after the world, it runs before paint.
import { fitViewport, NODES, sketchRectFor, viewportVars, WORLD, MIN_ZOOM, MAX_ZOOM } from '../lib/canvas-layout';

interface Props {
  ariaLabel: string;
}
const { ariaLabel } = Astro.props;

// Reference window: the value the server can honestly compute. The inline script
// below corrects it to the real window on load and on resize.
const initial = viewportVars(fitViewport({ w: WORLD.w, h: WORLD.h }));
const frames = NODES.map((n) => ({ ...n, sketch: sketchRectFor(n.id, n.w, n.h) }));

const fitData = {
  'data-world-w': String(WORLD.w),
  'data-world-h': String(WORLD.h),
  'data-min-k': String(MIN_ZOOM),
  'data-max-k': String(MAX_ZOOM),
};
---

<section
  class="canvas-viewport"
  aria-label={ariaLabel}
  style={`--vp-tx: ${initial['--vp-tx']}; --vp-ty: ${initial['--vp-ty']}; --vp-k: ${initial['--vp-k']};`}
  {...fitData}
>
  <div class="canvas-world">
    <div class="canvas-grid" aria-hidden="true"></div>

    <svg
      class="canvas-sketch"
      viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {
        frames.map((n) => (
          <g data-frame={n.id}>
            {n.sketch.paths.map((d, i) => (
              <path d={d} vector-effect="non-scaling-stroke" data-pass={i} />
            ))}
          </g>
        ))
      }
    </svg>

    <div class="canvas-nodes">
      <slot />
    </div>
  </div>

  <div class="canvas-controls" role="group" aria-label={ariaLabel}>
    <button type="button" data-canvas-zoom="out" aria-label="Уменьшить">−</button>
    <button type="button" data-canvas-zoom="reset" aria-label="Показать всю доску">⤢</button>
    <button type="button" data-canvas-zoom="in" aria-label="Увеличить">+</button>
  </div>
</section>

<script is:inline>
  // Synchronous fit, before paint. The formula is the same one in
  // `fitViewport`; the numbers are injected from src/lib/canvas-layout.ts above,
  // and tests/built/canvas.test.ts binds them so the two cannot drift.
  (function () {
    var el = document.querySelector('.canvas-viewport');
    if (!el || !window.matchMedia('(min-width: 900px)').matches) return;
    var w = parseFloat(el.dataset.worldW);
    var h = parseFloat(el.dataset.worldH);
    var minK = parseFloat(el.dataset.minK);
    var maxK = parseFloat(el.dataset.maxK);
    var vw = el.clientWidth;
    var vh = el.clientHeight;
    var k = Math.min(vw / w, vh / h);
    k = Math.min(maxK, Math.max(minK, k));
    el.style.setProperty('--vp-tx', (vw - w * k) / 2 + 'px');
    el.style.setProperty('--vp-ty', (vh - h * k) / 2 + 'px');
    el.style.setProperty('--vp-k', String(k));
  })();
</script>

<script>
  import {
    applyPan,
    applyZoomAt,
    fitViewport,
    focusNode,
    nodeById,
    viewportVars,
    type CanvasViewport,
    type NodeId,
  } from '../lib/canvas-layout';

  const root = document.querySelector<HTMLElement>('.canvas-viewport');
  const world = root?.querySelector<HTMLElement>('.canvas-world');
  if (root && world) {
    const desktop = window.matchMedia('(min-width: 900px)');

    let vp: CanvasViewport = {
      tx: parseFloat(root.style.getPropertyValue('--vp-tx')) || 0,
      ty: parseFloat(root.style.getPropertyValue('--vp-ty')) || 0,
      k: parseFloat(root.style.getPropertyValue('--vp-k')) || 1,
    };

    function paint(): void {
      const vars = viewportVars(vp);
      for (const [name, value] of Object.entries(vars)) root!.style.setProperty(name, value);
    }

    function size(): { w: number; h: number } {
      return { w: root!.clientWidth, h: root!.clientHeight };
    }

    function refit(): void {
      vp = fitViewport(size());
      paint();
    }

    // Wheel deliberately scrolls the page. Zoom has three other routes
    // (modifier+wheel, the buttons, the keys) — hijacking scroll is the classic
    // hostile-canvas failure, and this board fits on load anyway.
    root.addEventListener(
      'wheel',
      (e) => {
        if (!desktop.matches) return;
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const rect = root.getBoundingClientRect();
        vp = applyZoomAt(vp, { x: e.clientX - rect.left, y: e.clientY - rect.top }, e.deltaY < 0 ? 1.12 : 1 / 1.12);
        paint();
      },
      { passive: false }
    );

    let dragId: number | null = null;
    let last = { x: 0, y: 0 };
    root.addEventListener('pointerdown', (e) => {
      if (!desktop.matches || e.button !== 0) return;
      // A press that starts on a link or a control is a click, not a pan.
      if ((e.target as Element).closest('a, button')) return;
      dragId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
      root.setPointerCapture(e.pointerId);
      root.classList.add('is-panning');
    });
    root.addEventListener('pointermove', (e) => {
      if (dragId !== e.pointerId) return;
      vp = applyPan(vp, e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
      paint();
    });
    const endDrag = (e: PointerEvent): void => {
      if (dragId !== e.pointerId) return;
      dragId = null;
      root.classList.remove('is-panning');
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    };
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);

    function zoomBy(requested: number): void {
      const s = size();
      vp = applyZoomAt(vp, { x: s.w / 2, y: s.h / 2 }, requested);
      paint();
    }

    for (const btn of root.querySelectorAll<HTMLElement>('[data-canvas-zoom]')) {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.canvasZoom;
        if (kind === 'in') zoomBy(1.25);
        else if (kind === 'out') zoomBy(1 / 1.25);
        else refit();
      });
    }

    // Keyboard zoom. `0` refits, and these never preventDefault, so the browser's
    // own zoom and the page's scroll keep working.
    document.addEventListener('keydown', (e) => {
      if (!desktop.matches || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === '+') zoomBy(1.25);
      else if (e.key === '-') zoomBy(1 / 1.25);
      else if (e.key === '0') refit();
    });

    // Tabbing to a link brings its frame into view. No `preventScroll`: taking
    // the page's scroll position away from the keyboard visitor would be worse
    // than the node being off-centre for a moment.
    root.addEventListener('focusin', (e) => {
      if (!desktop.matches) return;
      const node = (e.target as Element).closest?.('[data-node]');
      const id = node?.getAttribute('data-node');
      if (!id) return;
      const k = Math.max(vp.k, 1);
      vp = focusNode(nodeById(id as NodeId), size(), k);
      paint();
    });

    let resizeTimer: number | undefined;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refit, 150);
    });

    paint();
  }
</script>

<style>
  .canvas-viewport {
    position: relative;
    block-size: 100vh;
    overflow: hidden;
    /* The fixed CTA rail is a sibling and only exists from 1100px up. */
    touch-action: pan-y;
  }
  .canvas-viewport.is-panning {
    cursor: grabbing;
  }
  .canvas-world {
    position: absolute;
    inset: 0;
    inline-size: 1440px;
    block-size: 900px;
    transform: translate(var(--vp-tx, 0px), var(--vp-ty, 0px)) scale(var(--vp-k, 1));
    transform-origin: 0 0;
    /* Zoom and Tab-centring are animated; reduced motion turns both off below. */
    transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .canvas-viewport.is-panning .canvas-world {
    transition: none;
  }
  .canvas-grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle at 1px 1px, var(--wallpaper-line) 1px, transparent 0);
    background-size: 32px 32px;
  }
  .canvas-sketch {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    fill: none;
    stroke: var(--border-color);
    stroke-width: 1.5;
    stroke-linecap: round;
    overflow: visible;
  }
  .canvas-sketch path[data-pass='1'] {
    opacity: 0.45;
  }
  .canvas-nodes {
    position: absolute;
    inset: 0;
  }
  .canvas-controls {
    position: absolute;
    inset-block-end: var(--space-5);
    inset-inline-end: var(--space-5);
    display: flex;
    gap: var(--space-2);
    z-index: 2;
  }
  .canvas-controls button {
    min-inline-size: 44px;
    min-block-size: 44px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .canvas-controls button:hover,
  .canvas-controls button:focus-visible {
    border-color: var(--border-active);
  }
  .canvas-controls button:focus-visible {
    outline: 2px solid var(--border-active);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .canvas-world {
      transition: none;
    }
  }
</style>
````

- [ ] **Step 2: Add the layout rules that must escape Astro's scoping**

Scoped `<style>` in an Astro component cannot target an ancestor from `global.css` (the well-known pitfall recorded in `reference-astro-pitfalls`), and the static-stack rules must also apply to slotted children which live in the caller's scope. Append to `src/styles/global.css`:

```css
/* Canvas homepage — the rules that cannot live in CanvasStage.astro's scoped
   <style>: the stacked fallback below the fit threshold, which has to reach the
   slotted node elements that Astro scopes to PersonaCanvas.astro. */
@media (max-width: 899px) {
  .canvas-viewport {
    block-size: auto;
    overflow: visible;
  }
  .canvas-world,
  .canvas-grid,
  .canvas-sketch {
    position: static;
    inline-size: auto;
    block-size: auto;
    transform: none;
    transition: none;
  }
  .canvas-sketch,
  .canvas-grid {
    display: none;
  }
  .canvas-nodes {
    position: static;
  }
  .canvas-controls {
    display: none;
  }
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `astro check && bunx tsc --noEmit -p tsconfig.tests.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/CanvasStage.astro src/styles/global.css
git commit -m "feat: add canvas stage with pan, zoom, sketch frames and stacked fallback"
```

---

### Task 4: `PersonaCanvas.astro` — the gate content as canvas nodes

**Files:**
- Create: `src/components/PersonaCanvas.astro`

**Interfaces:**
- Consumes: `CanvasStage` (Task 3), `withBase` from `../lib/path`, `PROJECT_ORDER` and `type Audience` from `../lib/projects`, `CAL_BOOKING_URL` from `../lib/contact`, and the analytics helpers from `../lib/analytics` (`firstTouch`, `readAudience`, `track`, `writeAudience`, `type ReferrerClass`).
- Produces: `interface Props { lang?: 'ru' | 'en' }`, defaulting to `'ru'`. Marks each node with `data-node` and `data-box` so `CanvasStage`'s script can centre it.
- Copy the `t` object, the `CARDS` array, `REFERRER_ROLE` and the whole `<script>` body **verbatim** from `src/components/PersonaGate.astro`. Do not paraphrase, retranslate or "improve" them — the strings are asserted by `tests/lib/persona.test.ts` and are the live analytics contract.

- [ ] **Step 1: Write the component**

Create `src/components/PersonaCanvas.astro`.

````astro
---
// The persona gate, re-authored as nodes on the canvas (PRD §9). The content is
// PersonaGate.astro's, unchanged — only the wrapper differs, so the markup here
// and there must be kept in step by hand until PersonaGate is retired.
//
// `data-node` names the layout box each element occupies (see
// src/lib/canvas-layout.ts); `data-box` carries its world rect inline, which is
// the single source of truth for both the stylesheet and the DOM. Reading order
// and visual position are independent: the DOM goes identity → claim → CTAs →
// role cards → projects-all, exactly as the stacked version did.
import CanvasStage from './CanvasStage.astro';
import { withBase } from '../lib/path';
import { PROJECT_ORDER, type Audience } from '../lib/projects';
import { CAL_BOOKING_URL } from '../lib/contact';
import { NODES } from '../lib/canvas-layout';

interface Props {
  lang?: 'ru' | 'en';
}
const { lang = 'ru' } = Astro.props;
const isEn = lang === 'en';

const t = isEn
  ? {
      h1: 'Product Analyst',
      role: 'A/B Testing & Retention',
      phd: 'PhD in work psychology — I measure behaviour and causal effects, not correlations.',
      claim:
        'I turn data into decisions: which fix to ship, whom to win back, where the hypothesis did not hold.',
      book: 'Book 30 minutes',
      lead: 'Prefer another way in? Pick your entry point.',
      showAll: `Show all ${PROJECT_ORDER.length} projects →`,
      continueAs: 'Continue as',
      canvasLabel: 'Home canvas',
    }
  : {
      h1: 'Продуктовый аналитик',
      role: 'A/B-тесты и retention',
      phd: 'PhD по психологии труда — измеряю поведение и причинные эффекты, а не корреляции.',
      claim: 'Считаю не отчёты, а решения: какой фикс включать, кого вернуть, где гипотеза не подтвердилась.',
      book: 'Забронировать 30 минут',
      lead: 'Удобнее иначе — выберите вход по роли',
      showAll: `Показать все ${PROJECT_ORDER.length} проектов →`,
      continueAs: 'Продолжить как',
      canvasLabel: 'Холст главной',
    };

const CARDS: Array<{ role: Audience; label: string; title: string; blurb: string; cta: string }> = [
  {
    role: 'hr',
    label: isEn ? 'HR' : 'HR',
    title: isEn ? 'Hiring / recruiter' : 'HR / рекрутер',
    blurb: isEn
      ? 'Role, stack, numbers, CV — for screening against a vacancy.'
      : 'Роль, стек, метрики, CV — под скрининг по вакансии.',
    cta: isEn ? 'Screening view' : 'Версия для скрининга',
  },
  {
    role: 'manager',
    label: isEn ? 'Manager' : 'Менеджер',
    title: isEn ? 'Hiring manager' : 'Нанимающий менеджер',
    blurb: isEn
      ? 'STAR cases: the task, the decision, what changed as a result.'
      : 'Кейсы STAR: задача, решение, что изменилось в результате.',
    cta: isEn ? 'Impact view' : 'Версия про результат',
  },
  {
    role: 'colleague',
    label: isEn ? 'Colleague' : 'Коллега',
    title: isEn ? 'Analyst / engineer' : 'Коллега-аналитик',
    blurb: isEn
      ? 'How it is made: code, data, method, the knowledge graph.'
      : 'Как это сделано: код, данные, метод, граф знаний.',
    cta: isEn ? 'Everything' : 'Полная версия',
  },
];

/** `style` for one node, from its layout box. */
const boxStyle = (id: string): string => {
  const b = NODES.find((n) => n.id === id);
  if (!b) throw new Error(`PersonaCanvas: no layout box for "${id}"`);
  return `left:${b.x}px; top:${b.y}px; width:${b.w}px; min-height:${b.h}px;`;
};
---

<CanvasStage ariaLabel={t.canvasLabel}>
  <header class="canvas-node canvas-node--identity" data-node="identity" style={boxStyle('identity')}>
    <h1 class="hero-name">{t.h1}</h1>
    <p class="hero-role">{t.role}</p>
    <p class="hero-phd">{t.phd}</p>
  </header>

  <p class="canvas-node persona-claim" data-node="claim" style={boxStyle('claim')}>{t.claim}</p>

  <div class="canvas-node canvas-actions" data-node="cta-booking" style={boxStyle('cta-booking')}>
    <a class="button" href={CAL_BOOKING_URL} data-analytics="booking_click">{t.book}</a>
  </div>

  <div class="canvas-node canvas-actions" data-node="cta-cv" style={boxStyle('cta-cv')}>
    {/* Secondary, not a rival: the same `cv_download_pdf` name the nav rail and
        the footer fire, so one event sums every CV download on the site. */}
    <a
      class="button button-secondary"
      href={withBase('CV-Nikita-Boyarkin.pdf')}
      download
      data-analytics="cv_download_pdf">CV</a
    >
  </div>

  {/* The fork's lead-in. It carries no `data-node`: it is a label for the three
      cards below, not a destination, so it needs no layout box — and reusing
      `role-hr` here would make Task 7's "every node exactly once" fail. */}
  <h2 class="canvas-node canvas-lead" style="left:800px; top:40px; width:540px;">
    {t.lead}
  </h2>

  {
    CARDS.map((card) => (
      <a
        class="canvas-node persona-card"
        data-node={`role-${card.role}`}
        style={boxStyle(`role-${card.role}`)}
        href={withBase(isEn ? `en/${card.role}/` : `${card.role}/`)}
        data-persona={card.role}
        data-source="gate"
        data-continue={`${t.continueAs} ${card.label}`}
      >
        <span class="persona-card-eyebrow">{card.label}</span>
        <span class="persona-card-title">{card.title}</span>
        <span class="persona-card-blurb">{card.blurb}</span>
        <span class="persona-card-cta">{card.cta} →</span>
      </a>
    ))
  }

  {/* Placed in the left column's free space below the CTAs, so unhiding it does
      not land it on top of another node. */}
  <p class="audience-note canvas-node" data-persona-continue style="left:80px; top:600px; width:620px;" hidden></p>

  <a
    class="canvas-node persona-all"
    data-node="projects-all"
    style={boxStyle('projects-all')}
    href={withBase(isEn ? 'en/projects/' : 'projects/')}>{t.showAll}</a
  >
</CanvasStage>

<style>
  .canvas-node {
    position: absolute;
    margin: 0;
  }
  .persona-claim {
    max-inline-size: 62ch;
    font-size: 1.0625rem;
    line-height: 1.6;
    text-wrap: pretty;
  }
  .canvas-actions {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }
  .canvas-lead {
    font-size: 1.125rem;
    font-weight: 600;
  }
  .persona-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-5);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: linear-gradient(
      180deg,
      var(--surface-secondary),
      color-mix(in srgb, var(--surface-secondary) 86%, var(--background-secondary))
    );
    color: inherit;
    text-decoration: none;
    overflow: hidden;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .persona-card::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    block-size: 2px;
    background: var(--border-active);
    opacity: 0.4;
    transition: opacity 0.15s ease;
  }
  .persona-card:hover,
  .persona-card:focus-visible {
    border-color: var(--border-active);
    box-shadow: 0 8px 24px -10px var(--shadow-color);
  }
  .persona-card:hover::before,
  .persona-card:focus-visible::before {
    opacity: 1;
  }
  .persona-card:focus-visible {
    outline: 2px solid var(--border-active);
    outline-offset: 2px;
  }
  .persona-card.is-stored,
  .persona-card.is-suggested {
    border-color: var(--border-active);
  }
  .persona-card.is-stored::before,
  .persona-card.is-suggested::before {
    opacity: 1;
  }
  .persona-card-eyebrow {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .persona-card-title {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.25;
    text-wrap: balance;
  }
  .persona-card-blurb {
    flex: 1;
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--text-muted);
    text-wrap: pretty;
  }
  .persona-card-cta {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-color);
    font-size: 0.875rem;
    font-weight: 600;
  }
  .persona-card:hover .persona-card-cta,
  .persona-card:focus-visible .persona-card-cta {
    color: var(--text-accent);
  }
  .persona-all {
    align-self: flex-start;
    font-size: 0.9375rem;
  }
  /* Below the fit threshold the stage goes static, so the nodes must too: they
     stop being absolutely positioned and flow in reading order. */
  @media (max-width: 899px) {
    .canvas-node {
      position: static;
      inset: auto;
      inline-size: auto;
      min-block-size: 0;
    }
    .canvas-lead {
      margin-block-start: var(--space-6);
    }
    .persona-claim,
    .persona-all {
      margin-block-start: var(--space-4);
    }
    .persona-card {
      margin-block-start: var(--space-4);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .persona-card,
    .persona-card::before {
      transition: none;
    }
  }
</style>

<script>
  import { firstTouch, readAudience, track, writeAudience, type ReferrerClass } from '../lib/analytics';
  import type { Audience } from '../lib/projects';

  // Referrer → the entry most visitors from that source actually want. GitHub
  // traffic is analysts and engineers, LinkedIn is recruiters. `google`, `other`
  // and `direct` get no hint — the hero stays neutral rather than guessing.
  const REFERRER_ROLE: Partial<Record<ReferrerClass, Audience>> = {
    github: 'colleague',
    linkedin: 'hr',
  };

  const root = document.querySelector<HTMLElement>('.canvas-nodes');
  if (root) {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
    const stored = readAudience();
    // The visitor's own pick outranks the source guess: a returning recruiter who
    // happened to arrive from GitHub still gets `hr`. The guess only fills the gap
    // where there is no choice to honour (Q11 — neither redirects).
    const suggested = stored ? null : (REFERRER_ROLE[firstTouch().referrer_class] ?? null);
    const highlighted = stored ?? suggested;

    if (highlighted) {
      const card = root.querySelector<HTMLElement>(`[data-persona="${highlighted}"]`);
      card?.classList.add(stored ? 'is-stored' : 'is-suggested');
      const note = root.querySelector<HTMLElement>('[data-persona-continue]');
      // Only a real, stored choice gets the "continue as …" line — a source guess
      // is a suggestion, and claiming continuity the visitor never chose would be
      // a lie in the UI.
      if (note && card && stored) {
        note.hidden = false;
        note.textContent = card.dataset.continue || '';
      }
    }

    track('persona_gate_view', { lang, has_stored_choice: Boolean(stored) });

    // Exposure — the denominator of the exposure→click rate (D3). Fired once per
    // load, unconditionally: a rate whose denominator only counts some views is
    // not a rate.
    const primaryCta = root.querySelector<HTMLElement>('[data-analytics="booking_click"]');
    if (primaryCta) track('cta_exposure', { surface: 'home_hero', lang });

    // No preventDefault: the write and the capture both run before the plain
    // `<a href>` navigation commits.
    for (const card of root.querySelectorAll<HTMLElement>('[data-persona]')) {
      card.addEventListener('click', () => {
        const persona = card.dataset.persona as Audience;
        writeAudience(persona);
        track('persona_selected', { persona, lang, source: 'gate' });
      });
    }
  }
</script>
````

- [ ] **Step 2: Build and inspect the markup**

Run: `bun run build`
Expected: build succeeds; `dist/index.html` contains `<h1 class="hero-name">Продуктовый аналитик</h1>` and three anchors with `href` ending in `hr/`, `manager/`, `colleague/`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PersonaCanvas.astro
git commit -m "feat: re-author the persona gate as canvas nodes wrapping CanvasStage"
```

---

### Task 5: Swap the pages

**Files:**
- Modify: `src/pages/index.astro:8` (import) and `:53` (`<PersonaGate lang="ru" />`)
- Modify: `src/pages/en/index.astro:5` (import) and its `<PersonaGate lang="en" />` line

**Interfaces:**
- Consumes: `PersonaCanvas` from `../components/PersonaCanvas.astro`.
- Produces: nothing new. `ProofBand` on `/` stays exactly where it is; the EN page has no `ProofBand` and still must not gain one. `PersonaGate.astro` stays on disk, unimported.

- [ ] **Step 1: Swap the RU page**

In `src/pages/index.astro`, replace the import line

```astro
import PersonaGate from '../components/PersonaGate.astro';
```

with

```astro
import PersonaCanvas from '../components/PersonaCanvas.astro';
```

and replace

```astro
  <PersonaGate lang="ru" />
```

with

```astro
  <PersonaCanvas lang="ru" />
```

Leave `showCtaRail`, the `jsonLd` block (including `speakable: { cssSelector: ['h1'] }`) and `<ProofBand lang="ru" />` untouched.

- [ ] **Step 2: Swap the EN page**

In `src/pages/en/index.astro`, replace its `PersonaGate` import with `import PersonaCanvas from '../../components/PersonaCanvas.astro';` and its `<PersonaGate lang="en" />` with `<PersonaCanvas lang="en" />`. Leave `canonical`, `activeNav="home"` and the absence of `ProofBand` untouched.

- [ ] **Step 3: Verify the swap is complete**

Run: `grep -rn "PersonaGate" src/pages/ ; echo "--- (no output above = no page imports it)"`
Expected: no matches. `src/components/PersonaGate.astro` still exists — this is intentional (spec: not deleted in this change).

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/pages/en/index.astro
git commit -m "feat: render the canvas gate on / and /en/"
```

---

### Task 6: Tokens for the canvas layer

**Files:**
- Modify: `src/styles/global.css` (append two blocks: the stacked fallback, and the rail inset)
- Modify: `DESIGN.md` (one section)

**Interfaces:**
- Consumes: existing tokens only — `--wallpaper-line`, `--border-color`, `--border-active`, `--text-primary`, `--surface-secondary`, `--radius-md`, `--space-2`, `--space-5`, `--shadow-color`.
- Produces: no new tokens. If a theme needs a different sketch strength, it overrides `--wallpaper-line` for that theme, which the grid already reads.

- [ ] **Step 1: Add the theme-scoped override block**

The canvas needs no new colours, but two rules must live in `global.css`: the sketch stroke strength per theme, and the theme-scoped selectors, which per `reference-astro-pitfalls` must be `:global(...)` or they never match from a scoped component.

Append to `src/styles/global.css`:

```css
/* Canvas layer. Deliberately token-only: the sketch strokes reuse
   --border-color and the dot grid reuses --wallpaper-line, so the canvas
   introduces no second texture colour and no raw hex. The theme-scoped
   selectors are :global() because a scoped component's style cannot match
   `[data-theme='…']` ancestors (see reference-astro-pitfalls). */
.canvas-grid {
  background-image: radial-gradient(circle at 1px 1px, var(--wallpaper-line) 1px, transparent 0);
  background-size: 32px 32px;
}

:global([data-theme='light']) .canvas-sketch {
  stroke: var(--border-color);
}

:global([data-theme='cyberpunk']) .canvas-sketch {
  stroke: var(--border-active);
  stroke-opacity: 0.35;
}

/* Interactive frames never sit on a decorative token: --border-active is the
   only stroke that clears the 3:1 non-text floor in all three themes. */
.canvas-node[data-node^='role-']:focus-visible,
.canvas-node[data-node^='cta-']:focus-visible {
  outline: 2px solid var(--border-active);
  outline-offset: 3px;
}
```

- [ ] **Step 2: Measure contrast in all three themes**

Start the preview (`bun run serve-dist` after a build) and, for each of dark, light and cyberpunk (`data-theme` on `<html>`; the toggle cycles them):

1. Read the sketch stroke colour and the page background from devtools and compute the ratio — it must be **≥ 3:1** for the stroke to be visible at all.
2. Read `--border-active` against its background — must be **≥ 3:1** (the spec records 6.36 dark / 5.72 light / 8.27 cyberpunk).
3. Tab to each role card and confirm the focus ring is visible.

Write the three measured stroke ratios and the three `--border-active` ratios into the note you add in Step 3. If any is below 3:1, raise that theme's `--wallpaper-line` alpha rather than introducing a new token.

- [ ] **Step 3: Screenshot both zoom extremes**

At 1440×900 in dark and light: screenshot the page at `k≈1` and again after pressing `+` until clamped (`k=2.2`).
Expected: at `k=2.2` the h1 is larger and still crisp, not blurry. The spec forbids assuming this. If it is blurry, add `will-change: transform` to `.canvas-world` and re-check; if it stays blurry, say so in the plan's PENDING note rather than shipping a claim.

- [ ] **Step 4: Document the layer**

Append a section to `DESIGN.md`:

```markdown
## Canvas layer (homepage hero)

`/` and `/en/` render their hero and role gate as a transform layer over real
DOM: `.canvas-viewport` (100vh, `overflow: hidden`) → `.canvas-world`
(`translate(--vp-tx, --vp-ty) scale(--vp-k)`, origin `0 0`) → dot grid +
`aria-hidden` sketch SVG + `.canvas-nodes` holding the actual `<h1>`, `<p>`, `<a>`.

- Board is 1440×900; node rects live in `src/lib/canvas-layout.ts` and drive both
  the stylesheet and the DOM.
- Frames are generated by `src/lib/sketch.ts` (seeded per node id, deterministic,
  inlined at build). No runtime dependency.
- Zoom range 0.6–2.2. Wheel scrolls the page; zoom is Cmd/Ctrl+wheel, the
  on-screen buttons, or `+` / `-` / `0`.
- Below 900px the whole layer goes static and the nodes flow in reading order —
  the canvas is progressive enhancement, not a requirement.
- Colour is token-only: grid at `--wallpaper-line`, frames at `--border-color`,
  interactive strokes and focus at `--border-active`. No `--dv-*` on anything
  interactive.
```

- [ ] **Step 5: Clear the fixed CTA rail**

`/` renders `showCtaRail` (the EN page does not). The rail is `position: fixed` from 1100px up, so at 1280–1440 the fitted board's right column — screen x 800–1340 at `k = 1` — sits underneath it and the role cards become unreadable. The spec names this risk and its mitigation: the canvas accounts for `--rail-total`.

Do it with padding, so the controls and the board both move clear in one move. Append to `src/styles/global.css`:

```css
/* The RU homepage's fixed action rail overlays the right edge from 1100px up.
   Padding (not a transform offset) is the fix: it also moves .canvas-controls,
   which is positioned against the same box. */
@media (min-width: 1100px) {
  .canvas-viewport {
    padding-inline-end: var(--rail-total);
  }
}
```

Then make **both** fit call sites subtract that padding, or they will disagree with each other.

In the `is:inline` script, replace the width read:

```js
    var rail = parseFloat(getComputedStyle(el).paddingInlineEnd) || 0;
    var fitW = el.clientWidth - rail;
    var vh = el.clientHeight;
    var k = Math.min(fitW / w, vh / h);
    k = Math.min(maxK, Math.max(minK, k));
    el.style.setProperty('--vp-tx', (fitW - w * k) / 2 + 'px');
```

In the module script, replace `size()`:

```js
    function size(): { w: number; h: number } {
      const rail = parseFloat(getComputedStyle(root!).paddingInlineEnd) || 0;
      return { w: root!.clientWidth - rail, h: root!.clientHeight };
    }
```

(The pointer math in `applyZoomAt` and the drag handler stays in raw client pixels — the anchor is a real cursor position, and the transform is applied to the padded box.)

- [ ] **Step 6: Verify the rail clears the board**

Build and serve (`bun run build && bun run serve-dist`). At **1280×800** on `/`, with the rail visible: screenshot and confirm no role card or zoom control sits under the rail. Repeat at 1100 (rail appears) and 1440. Then open `/en/` at the same widths and confirm the board is still centred correctly with no rail present — a padding value that leaked to a page with no rail would shift it left for no reason.

- [ ] **Step 7: Commit**

```bash
git add src/styles/global.css DESIGN.md
git commit -m "feat: add canvas layer tokens and document the homepage canvas"
```

---

### Task 7: Built-output test

**Files:**
- Create: `tests/built/canvas.test.ts`

**Interfaces:**
- Consumes: `dist/index.html`, `dist/en/index.html` (needs `bun run build` first).
- Produces: nothing importable.

- [ ] **Step 1: Write the test**

Create `tests/built/canvas.test.ts`. It reads the built HTML as a string, with no DOM.

```ts
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
```

- [ ] **Step 2: Run the test**

Run: `bun run build && bun test tests/built/canvas.test.ts`
Expected: PASS.

- [ ] **Step 3: Confirm the test bites**

Comment out the `<div class="canvas-nodes">` wrapper in `CanvasStage.astro`, rebuild, and re-run.
Expected: FAIL on *"renders the stage and the world layer"* **and** on *"renders every layout node exactly once"* (the `data-node` attributes would still be present, so the first failure is the one that bites). Restore and rebuild.

Then change `data-world-w` to a literal `"1600"` in `CanvasStage.astro`, rebuild, re-run.
Expected: FAIL on *"exposes the fit constants the inline script reads"* — this is the binding that keeps the inline `is:inline` script and `canvas-layout.ts` in step. Restore.

- [ ] **Step 4: Run the whole suite**

Run: `make check`
Expected: `bun run check` 0 errors, `bun test`, `bun run test:monitoring`, `bun run test:built` and `check_site.py` all pass. `tests/lib/persona.test.ts` must still pass unchanged — if it does not, the analytics contract was altered and Task 4 Step 1 was not followed verbatim.

- [ ] **Step 5: Commit**

```bash
git add tests/built/canvas.test.ts
git commit -m "test: bind the canvas homepage against the built output"
```

---

### Task 8: Accessibility, both themes, and the real-viewport check

**Files:**
- Modify: `src/components/CanvasStage.astro` and/or `src/components/PersonaCanvas.astro` (fixes only)
- Modify: `docs/superpowers/specs/2026-10-10-canvas-homepage-design.md` (Status line)

**Interfaces:**
- Consumes: everything above.
- Produces: no new files. This task is the gate; it changes code only where a measurement failed.

- [ ] **Step 1: Run the a11y and performance gate in both themes**

Run: `bun run build && bun run audit:lighthouse 2>/dev/null || bunx lhci autorun`
Expected: no regressions against the committed budget.

Because LHCI does not emulate `prefers-color-scheme`, repeat by hand: set the OS to light, run, then to dark, run. Record both.

- [ ] **Step 2: Keyboard and JS-off walkthrough**

At 1440×900:
1. Tab from the top. Confirm focus reaches booking → CV → hr → manager → colleague → projects-all in reading order and each lands inside the viewport.
2. Confirm the page still scrolls with the wheel over the canvas and that `ProofBand` is reachable below.
3. Press `+`, `-`, `0` with focus on the body; confirm zoom and refit.
4. Disable JavaScript (devtools → settings → debugger) and reload. **Review Focus #1:** the h1 and all four links must be visible and clickable at 1440×900. At 1280 and below, note that the right column sits partly off-screen without JS — record this honestly in the note below rather than claiming it works.
5. Enable `prefers-reduced-motion: reduce` (devtools → rendering) and confirm zoom/pan/centring are instant.

- [ ] **Step 3: Fix only what failed**

For each failure, make the smallest change that fixes it and re-run the affected gate. Do **not** widen scope: no node repositioning to make a measurement pass, no new tokens. If a failure needs a design decision (e.g. the JS-off 1280 case), leave it and write it into the PENDING list below.

- [ ] **Step 4: Record the result in the spec**

Change the spec's Status line to:

```markdown
**Status:** implemented — see docs/superpowers/plans/2026-10-10-canvas-homepage.md
```

and append after it:

```markdown
## Measured results (implemented)

| Check | Result |
|---|---|
| `make check` | |
| Lighthouse a11y / perf, dark | |
| Lighthouse a11y / perf, light | |
| Sketch stroke contrast, dark / light / cyberpunk | |
| `--border-active` contrast, dark / light / cyberpunk | |
| Legibility at `k = 2.2` (screenshot) | |
| JS-off at 1440×900 | |

## PENDING

- [ ] Delete `src/components/PersonaGate.astro` once the canvas is confirmed better on a real viewport.
- [ ] The 768–900px band renders the static stack rather than a scaled canvas (see Deviations).
```

Fill every cell with what you measured. A blank cell is a claim the plan did not earn.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-10-canvas-homepage-design.md
git commit -m "docs: record canvas homepage gate results"
```

---

## Notes for the executor

- **The baseline is clean.** The site repo's working tree was clean at `9ecafd6` when this plan was written, and the owner's earlier hero/rail/analytics work is committed. Do not revert anything.
- **Tasks 1, 2, 7 are the test-bearing tasks.** Tasks 3–6 are markup and styling; they have no unit tests by design, which is why Task 7 reads the built output and Task 8 measures in a browser. Do not skip Task 8 on the grounds that `make check` is green — `make check` cannot see a contrast failure or a clipped card.
- **Do not delete `PersonaGate.astro`.** It is unimported after Task 5 and stays on disk. Removing it is a separate change, listed under PENDING.
- **Do not push.** Commits are local until the owner approves a push.
- **The RU and EN pages differ in one way that matters here:** `/` renders the fixed CTA rail, `/en/` does not. Every fit measurement must be taken on both, or the rail inset will look correct on one page and wrong on the other.
