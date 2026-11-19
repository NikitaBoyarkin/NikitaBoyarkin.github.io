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
// Text width is *estimated* from the per-glyph advance table below, calibrated
// against `getComputedTextLength()` for every label of the built RU and EN
// graphs at 11px/600. The estimates carry a 2% margin so they never fall short
// of the real width: a label wrongly judged "too tight" is drawn hover-only,
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

/** A node ring a label prefers not to cover. */
export interface LabelObstacle {
  /** Owner id, so an item is never asked to dodge its own node. */
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface PlaceLabelOptions {
  width: number;
  height: number;
  fontSize?: number;
  /** World margin a label box must stay inside. */
  pad?: number;
  /** World centre the radial "outward" direction is measured from. */
  center?: { x: number; y: number };
  /** The node rings in the world. Among the slots clear of every placed label,
   *  a label takes the one covering the fewest of these — chasing a cover costs
   *  the label its outward direction, so it is never traded for a tie. See the
   *  candidate loop in `placeLabels`. */
  obstacles?: LabelObstacle[];
}

/** Per-glyph advance width in `em`, measured on the built page with
 *  `CanvasRenderingContext2D.measureText` in Rubik 600 @ 11px — the family,
 *  weight and size `.kg-label` resolves to (Rubik is self-hosted and is the
 *  first entry of `--font-sans`, see global.css). Covers U+0020–U+007E, the
 *  two Cyrillic blocks and the marks the labels use, each value rounded up
 *  at the 4th decimal.
 *
 *  A per-glyph table, not glyph classes: inside "lowercase latin" alone the
 *  advances run 0.27em (`i`) to 0.91em (`m`). One value per class either
 *  under-measured the wide letters — which is what drew `segmentation` on top
 *  of `career` on /en/graph/ — or, raised to the class maximum to fix that,
 *  over-measured every narrow letter about threefold and demoted most of the
 *  graph to hover-only. */
const ADVANCE_EM: Record<string, number> = {
  ' ': 0.2211, '!': 0.2789, '"': 0.4318, '#': 0.6887, $: 0.655,
  '%': 0.7949, '&': 0.7299, '\'': 0.2363, '(': 0.3724, ')': 0.3724,
  '*': 0.445, '+': 0.6106, ',': 0.2709, '-': 0.4788, '.': 0.276,
  '/': 0.5206, '0': 0.6683, '1': 0.4795, '2': 0.6339, '3': 0.6442,
  '4': 0.6668, '5': 0.6325, '6': 0.6384, '7': 0.5578, '8': 0.6662,
  '9': 0.6289, ':': 0.2826, ';': 0.2929, '<': 0.5103, '=': 0.5669,
  '>': 0.5098, '?': 0.5799, '@': 0.8414, A: 0.7039, B: 0.6946,
  C: 0.6931, D: 0.7093, E: 0.6305, F: 0.609, G: 0.7097,
  H: 0.7369, I: 0.311, J: 0.6611, K: 0.6468, L: 0.588,
  M: 0.819, N: 0.7128, O: 0.7031, P: 0.6675, Q: 0.7031,
  R: 0.6821, S: 0.6522, T: 0.617, U: 0.7192, V: 0.6831,
  W: 0.8229, X: 0.6757, Y: 0.672, Z: 0.6375, '[': 0.3682,
  '\\': 0.52, ']': 0.3682, '^': 0.456, _: 0.7387, '`': 0.3823,
  a: 0.5801, b: 0.6216, c: 0.5801, d: 0.6216, e: 0.5855,
  f: 0.4277, g: 0.6246, h: 0.6392, i: 0.2743, j: 0.2905,
  k: 0.567, l: 0.2753, m: 0.9088, n: 0.6331, o: 0.6011,
  p: 0.6221, q: 0.6221, r: 0.4352, s: 0.5423, t: 0.4477,
  u: 0.6307, v: 0.5842, w: 0.8286, x: 0.5755, y: 0.5854,
  z: 0.5413, '{': 0.4107, '|': 0.2565, '}': 0.4107, '~': 0.5559,
  'Ё': 0.6305, 'А': 0.7039, 'Б': 0.6526, 'В': 0.6946, 'Г': 0.5532,
  'Д': 0.7627, 'Е': 0.6305, 'Ж': 1.0488, 'З': 0.6585, 'И': 0.7691,
  'Й': 0.7691, 'К': 0.6853, 'Л': 0.7482, 'М': 0.819, 'Н': 0.7369,
  'О': 0.7031, 'П': 0.7369, 'Р': 0.6675, 'С': 0.6931, 'Т': 0.617,
  'У': 0.6338, 'Ф': 0.9096, 'Х': 0.6757, 'Ц': 0.7679, 'Ч': 0.6873,
  'Ш': 0.9799, 'Щ': 1.0108, 'Ъ': 0.7515, 'Ы': 0.913, 'Ь': 0.6441,
  'Э': 0.678, 'Ю': 1.0145, 'Я': 0.6907, 'а': 0.5801, 'б': 0.6055,
  'в': 0.5943, 'г': 0.4519, 'д': 0.6417, 'е': 0.5855, 'ж': 0.8844,
  'з': 0.5464, 'и': 0.6304, 'й': 0.6304, 'к': 0.5881, 'л': 0.6138,
  'м': 0.7132, 'н': 0.6304, 'о': 0.6011, 'п': 0.6206, 'р': 0.6221,
  'с': 0.5801, 'т': 0.5391, 'у': 0.5813, 'ф': 0.7836, 'х': 0.5755,
  'ц': 0.6462, 'ч': 0.5911, 'ш': 0.8193, 'щ': 0.8448, 'ъ': 0.6293,
  'ы': 0.7933, 'ь': 0.5437, 'э': 0.5853, 'ю': 0.8522, 'я': 0.5888,
  'ё': 0.5855, '«': 0.6179, '»': 0.6179, '—': 0.7588, '–': 0.5688,
  '…': 0.7086, '№': 1.2049, '×': 0.5913, '·': 0.33,
};

/** A glyph outside the measured set. Deliberately generous — see the
 *  calibration note above: over-measuring costs a hover-only label, while
 *  under-measuring costs one drawn across its neighbour. */
function fallbackAdvance(ch: string): number {
  if (ch === '\u00a0') return ADVANCE_EM[' '];
  const code = ch.charCodeAt(0);
  if (code >= 0x0400 && code <= 0x04ff) return 1.04; // Cyrillic
  if (code >= 0x41 && code <= 0x5a) return 1.03; // A–Z
  if (code >= 0x61 && code <= 0x7a) return 0.91; // a–z
  return 1.1; // digits, symbols, emoji
}

/** Kerning shaves a little off the sum of the per-glyph advances — measured at
 *  up to 0.5% across the real label set — so every estimate carries this margin
 *  and cannot fall short of the rendered width. */
const WIDTH_SAFETY = 1.02;

function charWidth(ch: string): number {
  return ADVANCE_EM[ch] ?? fallbackAdvance(ch);
}

export function estimateTextWidth(label: string, fontSize: number): number {
  let w = 0;
  for (const ch of label) w += charWidth(ch);
  return w * fontSize * WIDTH_SAFETY;
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

/** The width of the background halo every label paints (`stroke-width` on
 *  `.kg-label`, so 2.5 world units reach past the glyph box on each side; the
 *  component reads this same constant into `--kg-label-halo`).
 *
 *  This is the collision gap, not a token margin: two boxes closer than the
 *  full halo width leave the later label's halo painting over the earlier
 *  label's letters — the "names on top of each other" defect, at its worst
 *  where the SVG is scaled down. */
export const LABEL_HALO = 5;

/** True when two label boxes sit closer than `gap` — by default the label
 *  halo, i.e. when one label's halo would paint over the other's glyphs. The
 *  invariant `placeLabels` maintains, exposed so the built-SVG test can assert
 *  it on the real placement instead of re-deriving the formula. */
export const labelsTooClose = (a: LabelBox, b: LabelBox, gap: number = LABEL_HALO): boolean =>
  overlaps(a, b, gap);

const inside = (b: LabelBox, w: number, h: number, pad: number): boolean =>
  b.x0 >= pad && b.x1 <= w - pad && b.y0 >= pad && b.y1 <= h - pad;

/** Clearance a label box keeps from a node ring. The label's own halo reaches
 *  `LABEL_HALO / 2` past the box, and the ring is stroked `1.6` wide, so
 *  anything under this and the halo paints across the ring it was dodging. */
const CIRCLE_CLEARANCE = LABEL_HALO / 2 + 1;

/** Circle vs axis-aligned box: distance from the centre to the nearest point
 *  on the box. A rectangle approximation of the ring would either over-reserve
 *  on the diagonals (for the big hubs, ~40 units square) or clip the ring. */
function circleHitsBox(
  box: LabelBox,
  cx: number,
  cy: number,
  r: number,
  clearance: number = CIRCLE_CLEARANCE,
): boolean {
  const nx = Math.max(box.x0, Math.min(cx, box.x1));
  const ny = Math.max(box.y0, Math.min(cy, box.y1));
  return Math.hypot(cx - nx, cy - ny) < r + clearance;
}

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
 * box is clear of every already-placed box, inside the world, and — on the
 * first pass — clear of every node ring. A label that finds nothing while
 * dodging the rings retries with that constraint dropped, so avoiding a node is
 * a preference and never costs the picture a label; only when no slot is clear
 * of the *other labels* either does it come back `placed: false`, which the
 * caller renders hover-only.
 */
export function placeLabels(
  items: LabelItem[],
  opts: PlaceLabelOptions,
): Map<string, LabelPlacement> {
  const fontSize = opts.fontSize ?? 11;
  const pad = opts.pad ?? 4;
  const cx = opts.center?.x ?? opts.width / 2;
  const cy = opts.center?.y ?? opts.height / 2;
  const gap = LABEL_HALO;
  const obstacles = opts.obstacles ?? [];
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
    // Among the slots that are inside the world and clear of every placed
    // label, take the one covering the fewest node rings. The direction order is
    // still the association order — outward first — because only a *strictly*
    // fewer cover wins, so a label never drifts to a worse direction for a tie.
    let bestHits = Infinity;
    for (const [ux, uy] of dirs) {
      const c = candidate(item, ux, uy);
      const box = labelBox(item, c.tx, c.ty, c.anchor, fontSize);
      if (!inside(box, opts.width, opts.height, pad)) continue;
      if (taken.some((t) => overlaps(box, t, gap))) continue;
      const hits = obstacles.reduce(
        (n, o) => n + (o.id !== item.id && circleHitsBox(box, o.x, o.y, o.r) ? 1 : 0),
        0,
      );
      if (hits < bestHits) {
        bestHits = hits;
        chosen = { ...c, placed: true };
        chosenBox = box;
        if (hits === 0) break; // nothing can beat a clean slot
      }
    }
    if (chosen && chosenBox) taken.push(chosenBox);
    out.set(item.id, chosen ?? fallback);
  }

  return out;
}
