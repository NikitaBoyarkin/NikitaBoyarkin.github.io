// Build-time label placement for the knowledge graph.
//
// The graph's always-on labels used to be offset purely radially outward from
// the world centre with no collision check (see KnowledgeGraph.astro), so nodes
// sharing a ring grew labels that ran into each other, and nodes near the world
// edge grew labels that were clipped by the viewBox.
//
// This module answers one question per label: is there a spot next to its node
// where the text neither overlaps another placed label nor leaves the world?
// It is pure and deterministic (no canvas — there is none at build time), so the
// SSR SVG is reproducible and the same function can re-run in the browser when
// the client swaps in the community layout.
//
// Text width is *estimated* from the glyph classes below, calibrated against
// `getComputedTextLength()` for all 109 real labels at 11px/600 (max observed
// ratio 0.69, on short all-caps ids like "CUPED"). The estimates intentionally
// run a little wide: a label wrongly judged "too tight" is drawn hover-only,
// which is a far smaller defect than one drawn on top of its neighbour.

export interface LabelItem {
  id: string;
  label: string;
  /** Node centre in world (viewBox) units. */
  x: number;
  y: number;
  /** Node radius in world units. */
  size: number;
  /** Lower wins a contested slot: root, then hubs, projects, topics. */
  priority: number;
}

export interface LabelPlacement {
  /** Offset from the node centre to the text anchor point. */
  tx: number;
  ty: number;
  anchor: 'start' | 'middle' | 'end';
  /** False when no candidate was clear — the caller draws it hover-only. */
  placed: boolean;
}

export interface LabelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PlaceLabelOptions {
  width: number;
  height: number;
  fontSize?: number;
  /** World margin a label box must stay inside. */
  pad?: number;
  /** World centre the radial "outward" direction is measured from. */
  center?: { x: number; y: number };
}

/** Per-character advance in `em`, by glyph class (see the calibration note). */
function charWidth(ch: string): number {
  if (ch === ' ') return 0.28;
  const code = ch.charCodeAt(0);
  // Cyrillic lowercase runs ~0.62em in Inter; latin lowercase ~0.56em.
  if (code >= 0x0400 && code <= 0x04ff) return ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? 0.75 : 0.64;
  if (ch >= 'A' && ch <= 'Z') return 0.75;
  if ('.,:;\'"|!()[]·—–-'.includes(ch)) return 0.34;
  if ('iljtfr'.includes(ch)) return 0.32;
  return 0.58;
}

export function estimateTextWidth(label: string, fontSize: number): number {
  let w = 0;
  for (const ch of label) w += charWidth(ch);
  return w * fontSize;
}

/** Box a placement covers, in world units. Baseline sits at `y + ty`. */
export function labelBox(
  item: LabelItem,
  tx: number,
  ty: number,
  anchor: LabelPlacement['anchor'],
  fontSize: number,
): LabelBox {
  const w = estimateTextWidth(item.label, fontSize);
  const x0 =
    anchor === 'start'
      ? item.x + tx
      : anchor === 'end'
        ? item.x + tx - w
        : item.x + tx - w / 2;
  const baseline = item.y + ty;
  return { x0, x1: x0 + w, y0: baseline - fontSize * 0.8, y1: baseline + fontSize * 0.35 };
}

const overlaps = (a: LabelBox, b: LabelBox, gap: number): boolean =>
  a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;

const inside = (b: LabelBox, w: number, h: number, pad: number): boolean =>
  b.x0 >= pad && b.x1 <= w - pad && b.y0 >= pad && b.y1 <= h - pad;

/** Anchor + offsets for one candidate direction (unit vector) around a node. */
function candidate(item: LabelItem, ux: number, uy: number): LabelPlacement {
  const r = item.size;
  const vertical = Math.abs(ux) < 0.35;
  const anchor: LabelPlacement['anchor'] = vertical ? 'middle' : ux >= 0 ? 'start' : 'end';
  const tx = vertical ? 0 : ux * (r + 6);
  const ty = vertical ? (uy >= 0 ? r + 12 : -(r + 12)) : uy * (r + 6) + 4;
  return { tx, ty, anchor, placed: false };
}

/** Candidate directions, in the order they are tried: straight outward first
 *  (the original rule), then fanning around it, then inward — the inward
 *  candidate is what keeps a label on a node near the world edge inside the
 *  viewBox instead of running off it. */
const ANGLE_OFFSETS_DEG = [0, 35, -35, 70, -70, 105, -105, 180];

/** Root sits at the centre, where "outward" is undefined — try up/down/left/right. */
const ROOT_DIRECTIONS: [number, number][] = [
  [0, -1],
  [0, 1],
  [1, 0],
  [-1, 0],
];

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Place every label. Items are processed in `priority` order (ties broken by
 * input order, so the result is stable), each taking the first candidate whose
 * box is clear of every already-placed box and inside the world. Items that
 * find nothing come back `placed: false` carrying their outermost-radial
 * geometry, which the caller renders hover-only.
 */
export function placeLabels(
  items: LabelItem[],
  opts: PlaceLabelOptions,
): Map<string, LabelPlacement> {
  const fontSize = opts.fontSize ?? 11;
  const pad = opts.pad ?? 4;
  const cx = opts.center?.x ?? opts.width / 2;
  const cy = opts.center?.y ?? opts.height / 2;
  const gap = 1.5;
  const out = new Map<string, LabelPlacement>();
  const taken: LabelBox[] = [];

  const ordered = items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => a.item.priority - b.item.priority || a.i - b.i);

  for (const { item } of ordered) {
    const dx = item.x - cx;
    const dy = item.y - cy;
    const base = Math.hypot(dx, dy) < 1 ? null : Math.atan2(dy, dx);
    const angles = base === null ? null : ANGLE_OFFSETS_DEG.map((o) => base + toRad(o));
    const dirs: [number, number][] = angles
      ? angles.map((a) => [Math.cos(a), Math.sin(a)] as [number, number])
      : ROOT_DIRECTIONS;

    const fallback = candidate(item, ...dirs[0]);
    let chosen: LabelPlacement | null = null;
    let chosenBox: LabelBox | null = null;
    for (const [ux, uy] of dirs) {
      const c = candidate(item, ux, uy);
      const box = labelBox(item, c.tx, c.ty, c.anchor, fontSize);
      if (!inside(box, opts.width, opts.height, pad)) continue;
      if (taken.some((t) => overlaps(box, t, gap))) continue;
      chosen = { ...c, placed: true };
      chosenBox = box;
      break;
    }
    if (chosen && chosenBox) taken.push(chosenBox);
    out.set(item.id, chosen ?? fallback);
  }

  return out;
}
