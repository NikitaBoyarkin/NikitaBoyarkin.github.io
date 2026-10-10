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
 *
 * Both columns start at y = 90 so the eye reads them as one composition rather
 * than as a shift (the fork's lead-in is the right column's first box, and it
 * sits at the same top as the hero words). Each column then keeps its own even
 * rhythm: 180 between the left column's three blocks, 40 between the right
 * column's four. The two columns end 20 apart (836 against 856), so the board has
 * no empty corner below the CTAs. Changing any single `y` here breaks that
 * pairing — move a column, not a box.
 */
export const NODES: NodeBox[] = [
  { id: 'identity', x: 80, y: 90, w: 620, h: 210, kind: 'text' },
  { id: 'claim', x: 80, y: 480, w: 620, h: 120, kind: 'text' },
  { id: 'cta-booking', x: 80, y: 780, w: 240, h: 56, kind: 'link' },
  { id: 'cta-cv', x: 340, y: 780, w: 130, h: 56, kind: 'link' },
  { id: 'role-hr', x: 800, y: 140, w: 540, h: 180, kind: 'link' },
  { id: 'role-manager', x: 800, y: 360, w: 540, h: 180, kind: 'link' },
  { id: 'role-colleague', x: 800, y: 580, w: 540, h: 180, kind: 'link' },
  { id: 'projects-all', x: 800, y: 800, w: 540, h: 56, kind: 'link' },
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
