// The force kernel, shared by the build-time layout and the client simulation.
//
// Why this module exists: the same constants used to live twice — inlined in
// `graph-layout.ts` and again in `ProjectGraph.astro` — so a tuning change made
// in one place silently desynced the other. The values here are the build-time
// ones, extracted verbatim; the golden fixture in
// `tests/lib/graph-layout-golden.test.ts` is what proves the extraction moved no
// coordinate.
//
// Pure and deterministic: no randomness, no DOM, no clock. `stepSim` mutates the
// nodes it is handed and returns nothing.

export interface PhysicsParams {
  /** Pairwise repulsion strength; grows with the node count. */
  charge: number;
  /** Pull toward the world centre. */
  gravity: number;
  /** Pull toward a node's community centroid (community mode only). */
  communityGravity: number;
  /** Pull toward a node's `home`; the client's "return to where it was". */
  homeGravity: number;
  /** Velocity retained per tick. */
  damp: number;
  /** Clamp so nothing ends up outside the world. */
  margin: number;
  /** Fraction of `alpha` shed per tick. */
  alphaDecay: number;
  /** Simulation stops once `alpha` falls below this. */
  alphaMin: number;
  /** Hard cap on ticks, whatever `alpha` says. */
  maxFrames: number;
}

/** Cores (group hubs) are pulled toward the world center much harder than
 *  regular nodes so they sit at the hub of the graph. */
export const CORE_GRAVITY = 5;

/** `maxFrames` override keeps `LayoutOptions.maxFrames` meaningful. */
export function physicsParams(N: number, maxFrames?: number): PhysicsParams {
  const n = Math.max(1, N);
  const gravity = 0.004 + 0.001 * Math.sqrt(n);
  return {
    charge: 2200 * Math.sqrt(n),
    gravity,
    // Stronger than the center gravity so clusters stay coherent, weak enough
    // for the pairwise repulsion to spread members inside a cluster.
    communityGravity: gravity * 4,
    homeGravity: 0.05,
    damp: 0.86,
    margin: Math.min(80, 60 + n * 0.5),
    // Alpha-based settling (d3-force style): every force scales with `alpha`,
    // which decays exponentially each tick, so the layout converges and stops on
    // its own instead of running a fixed frame count and shaking.
    alphaDecay: Math.max(0.015, 0.03 - 0.001 * Math.sqrt(n)),
    alphaMin: 0.01,
    maxFrames: maxFrames ?? Math.max(400, n * 10),
  };
}

export interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Hub node: gravity is multiplied by {@link CORE_GRAVITY}. */
  core?: boolean;
  /** Emergent community id, read only when `clusterByCommunity` is set. */
  community?: number;
  /** Where the home spring pulls. Absent → no spring. */
  home?: { x: number; y: number };
  /** Held here while dragging: forces are ignored, coordinates are pinned. */
  fixed?: { x: number; y: number } | null;
  /** Left out of repulsion, springs and integration. */
  hidden?: boolean;
}

/** `source`/`target` are indices into the node array `stepSim` is given. */
export interface SimLink {
  source: number;
  target: number;
  weight: number;
}

export interface StepOptions {
  alpha: number;
  params: PhysicsParams;
  width: number;
  height: number;
  /** Cluster members around their community centroid (community mode). */
  clusterByCommunity?: boolean;
  /** Hard cap on how far a node may travel in one tick.
   *
   *  The build-time schedule never needs it: alpha decays from 1 to 0.01 over
   *  ~230 ticks, so the forces fade before the geometry can fold. An
   *  interactive drag re-arms alpha every time the pointer moves, and there
   *  1/d² repulsion between two near-coincident nodes would otherwise fling
   *  them clear across the world inside a single frame — measured at 764px of
   *  travel per frame, i.e. the whole graph thrashing between the margin
   *  clamps. Undefined → uncapped, so the build-time output is bit-identical. */
  maxStep?: number;
}

/** One tick. Mirrors the retired client loop exactly, so build-time and runtime
 *  agree on forces. */
export function stepSim(nodes: SimNode[], links: SimLink[], opts: StepOptions): void {
  const { alpha, params, width, height } = opts;
  const { charge, gravity, damp, margin } = params;

  // Pairwise repulsion.
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.hidden || b.hidden) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy || 1;
      const d = Math.sqrt(d2);
      const f = (charge / d2) * alpha;
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
  }

  // Link springs: stronger edges pull closer (ideal length shrinks with weight).
  for (const l of links) {
    const s = nodes[l.source];
    const t = nodes[l.target];
    if (!s || !t || s.hidden || t.hidden) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ideal = 60 + 80 * (1 - l.weight);
    const f = (d - ideal) * 0.04 * (0.5 + 0.5 * l.weight) * alpha;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;
    s.vx += fx;
    s.vy += fy;
    t.vx -= fx;
    t.vy -= fy;
  }

  // Community mode: pull each node toward its community's centroid so the
  // cluster reads as one blob (the group-hub springs are excluded by the caller).
  if (opts.clusterByCommunity) {
    const centroids = new Map<number, { x: number; y: number; n: number }>();
    for (const n of nodes) {
      if (n.hidden) continue;
      const c = n.community ?? 0;
      const acc = centroids.get(c) || { x: 0, y: 0, n: 0 };
      acc.x += n.x;
      acc.y += n.y;
      acc.n++;
      centroids.set(c, acc);
    }
    for (const n of nodes) {
      if (n.hidden) continue;
      const acc = centroids.get(n.community ?? 0)!;
      n.vx += (acc.x / acc.n - n.x) * params.communityGravity * alpha;
      n.vy += (acc.y / acc.n - n.y) * params.communityGravity * alpha;
    }
  }

  // Center gravity, home spring, damping, integration.
  for (const n of nodes) {
    if (n.hidden) continue;
    if (n.fixed) {
      // A dragged node holds its cursor position and contributes no velocity.
      n.x = n.fixed.x;
      n.y = n.fixed.y;
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    const g = n.core ? gravity * CORE_GRAVITY : gravity;
    n.vx += (width / 2 - n.x) * g * alpha;
    n.vy += (height / 2 - n.y) * g * alpha;
    if (n.home) {
      n.vx += (n.home.x - n.x) * params.homeGravity * alpha;
      n.vy += (n.home.y - n.y) * params.homeGravity * alpha;
    }
    n.vx *= damp;
    n.vy *= damp;
    if (opts.maxStep) {
      const speed = Math.hypot(n.vx, n.vy);
      if (speed > opts.maxStep) {
        const s = opts.maxStep / speed;
        n.vx *= s;
        n.vy *= s;
      }
    }
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(margin, Math.min(width - margin, n.x));
    n.y = Math.max(margin, Math.min(height - margin, n.y));
  }
}

export interface Point {
  x: number;
  y: number;
}

/** Smoothstep — no overshoot, symmetric, and identical on every platform. */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** One frame of the return phase: `t` runs 0 → 1 and must be driven by the
 *  caller's clock.
 *
 *  The simulation's resting point is not the build-time coordinate (the home
 *  spring and a filtered subset both move the equilibrium), so the last leg back
 *  is interpolation rather than a snap: a threshold-triggered jump pops visibly
 *  and, if any surface is written late, leaves edges hanging on stale
 *  coordinates for a frame. `t >= 1` returns `home` itself — not a lerp that
 *  lands near it — so the caller can write a single atomic frame and be exactly
 *  where the SSR layout started. */
export function easeTo(from: Point[], home: Point[], t: number): Point[] {
  if (t <= 0) return from.map((p) => ({ x: p.x, y: p.y }));
  if (t >= 1) return home.map((p) => ({ x: p.x, y: p.y }));
  const e = smoothstep(t);
  return from.map((p, i) => ({ x: p.x + (home[i].x - p.x) * e, y: p.y + (home[i].y - p.y) * e }));
}
