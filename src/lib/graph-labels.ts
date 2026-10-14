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
 *  `CanvasRenderingContext2D.measureText` in Inter 600 @ 11px — the face and
 *  size `.kg-label` sets (Inter is self-hosted, see global.css). Covers
 *  U+0020–U+007E, the two Cyrillic blocks and the marks the labels use, each
 *  value rounded up at the 4th decimal.
 *
 *  A per-glyph table, not glyph classes: inside "lowercase latin" alone the
 *  advances run 0.26em (`i`) to 0.90em (`m`). One value per class either
 *  under-measured the wide letters — which is what drew `segmentation` on top
 *  of `career` on /en/graph/ — or, raised to the class maximum to fix that,
 *  over-measured every narrow letter about threefold and demoted most of the
 *  graph to hover-only. */
const ADVANCE_EM: Record<string, number> = {
  ' ': 0.2518, '!': 0.3212, '"': 0.523, '#': 0.6437, $: 0.6504,
  '%': 1.0043, '&': 0.6625, "'": 0.3259, '(': 0.3731, ')': 0.3731,
  '*': 0.5397, '+': 0.6731, ',': 0.3187, '-': 0.4653, '.': 0.3187,
  '/': 0.379, '0': 0.6597, '1': 0.4231, '2': 0.6231, '3': 0.6362,
  '4': 0.6663, '5': 0.6125, '6': 0.6399, '7': 0.5763, '8': 0.6403,
  '9': 0.6399, ':': 0.3187, ';': 0.3292, '<': 0.6731, '=': 0.6731,
  '>': 0.6731, '?': 0.5434, '@': 0.9993, A: 0.7278, B: 0.6593,
  C: 0.7367, D: 0.7221, E: 0.6053, F: 0.5881, G: 0.7491,
  H: 0.7457, I: 0.2767, J: 0.5798, K: 0.7034, L: 0.5655,
  M: 0.9224, N: 0.7593, O: 0.7686, P: 0.645, Q: 0.7728,
  R: 0.6524, S: 0.6504, T: 0.6603, U: 0.7361, V: 0.7278,
  W: 1.0202, X: 0.7196, Y: 0.7136, Z: 0.6525, '[': 0.3731,
  '\\': 0.379, ']': 0.3731, '^': 0.4816, _: 0.4695, '`': 0.3511,
  a: 0.5742, b: 0.6243, c: 0.5828, d: 0.6243, e: 0.5915,
  f: 0.3888, g: 0.6256, h: 0.6123, i: 0.2616, j: 0.2616,
  k: 0.5696, l: 0.2616, m: 0.9003, n: 0.612, o: 0.6088,
  p: 0.6243, q: 0.6243, r: 0.3971, s: 0.5495, t: 0.3532,
  u: 0.6123, v: 0.5872, w: 0.8395, x: 0.5688, y: 0.5886,
  z: 0.5658, '{': 0.4548, '|': 0.3588, '}': 0.4548, '~': 0.6731,
  Ё: 0.6053, А: 0.7278, Б: 0.6466, В: 0.6593, Г: 0.5813,
  Д: 0.8519, Е: 0.6053, Ж: 1.0324, З: 0.6362, И: 0.7593,
  Й: 0.7593, К: 0.7034, Л: 0.7492, М: 0.9224, Н: 0.7457,
  О: 0.7686, П: 0.7457, Р: 0.645, С: 0.7367, Т: 0.6603,
  У: 0.6724, Ф: 0.8331, Х: 0.7196, Ц: 0.7517, Ч: 0.705,
  Ш: 0.9785, Щ: 1.0019, Ъ: 0.8256, Ы: 0.9068, Ь: 0.6583,
  Э: 0.7367, Ю: 1.0333, Я: 0.6524, а: 0.5742, б: 0.6043,
  в: 0.5729, г: 0.4472, д: 0.645, е: 0.5915, ж: 0.8461,
  з: 0.5109, и: 0.6123, й: 0.6123, к: 0.5695, л: 0.5944,
  м: 0.798, н: 0.6104, о: 0.6088, п: 0.6048, р: 0.6243,
  с: 0.5828, т: 0.4954, у: 0.5886, ф: 0.747, х: 0.5688,
  ц: 0.6364, ч: 0.5933, ш: 0.8473, щ: 0.8707, ъ: 0.6668,
  ы: 0.7831, ь: 0.5794, э: 0.5833, ю: 0.859, я: 0.5699,
  ё: 0.5915, '«': 0.6342, '»': 0.6342, '—': 1, '–': 0.5,
  '…': 0.9561, '№': 1.0988, '×': 0.6731, '·': 0.3187,
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
