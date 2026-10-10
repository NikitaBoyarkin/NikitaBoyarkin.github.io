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
