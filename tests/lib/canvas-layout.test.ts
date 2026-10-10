// Canvas node geometry and viewport math.
//
// Two claims here are load-bearing and neither is visible in a screenshot:
// (a) every node box sits fully inside the world, so the fitted viewport can
// place it without clipping it at the board edge; (b) the fitted viewport
// contains every node CENTRE at the widths the site actually gets (900, 1024,
// 1280, 1440), which is what keeps the role gate working without any
// interaction. A regression in either silently ships a clipped card.
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
  it('declares all four nodes with unique ids', () => {
    expect(NODES.length).toBe(4);
    expect(new Set(NODES.map((n) => n.id)).size).toBe(4);
  });

  it('keeps the reading order, independent of visual position', () => {
    expect(NODES.map((n) => n.id)).toEqual([
      'identity',
      'role-hr',
      'role-manager',
      'role-colleague',
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

  // One lane, no CTA row (docs/prd-homepage-canvas-polish.md §13, second wave).
  // The board first paired a left hero column with a right column of role cards,
  // which left a ~290px void under the hero; the owner then took the CV and
  // Contact buttons off the board entirely. The gate is now the `h1` with the
  // three cards under it, reading top-to-bottom in a single 620px lane, and the
  // right half of the 1440px board is deliberately empty. Three things have to
  // hold for that to stay true, and a single moved `y` breaks at least one.
  it('stays a single lane with the cards closed up under the h1', () => {
    const byId = (id: string): NodeBox => {
      const n = NODES.find((b) => b.id === id);
      expect(n, `${id} is not a declared node`).toBeDefined();
      return n!;
    };
    const head = byId('identity');
    const firstCard = byId('role-hr');

    // The void that used to open below the hero is what the move fixed.
    expect(
      firstCard.y - (head.y + head.h),
      'the void under the h1 must stay inside the 40px budget'
    ).toBeLessThanOrEqual(40);

    // The lane fills the board instead of stopping short of the bottom edge.
    expect(
      WORLD.h - Math.max(...NODES.map((n) => n.y + n.h)),
      'the lane must reach the bottom of the world within 60px'
    ).toBeLessThanOrEqual(60);

    // Every box sits in the left lane. The right half of the board is empty by the
    // owner's call, and it stops being empty the moment a box is parked there.
    for (const n of NODES) {
      expect(n.x, `${n.id} leaves the left lane`).toBeLessThanOrEqual(340);
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
    expect(focusNode(nodeById('role-colleague'), { w: 1200, h: 800 }, 8).k).toBe(MAX_ZOOM);
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
