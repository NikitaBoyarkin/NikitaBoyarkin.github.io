// Build-time force-directed layout for the knowledge graph.
//
// Ports the client-side simulation that used to live in KnowledgeGraph.astro to
// a pure, synchronous, deterministic function, so the SVG can be server-rendered
// at `astro build` and the browser only handles zoom/pan/search/legend.
//
// Determinism: there is no randomness anywhere — initial positions are
// deterministic rings, forces are deterministic, and the tick loop runs a fixed
// alpha-decay schedule. The same input always produces the same layout, which
// keeps the SSR SVG and the /graph.json endpoints in agreement across builds.
import type { GraphData, GraphNode, LinkType } from "./graph";
import { NODE_SIZE, ROOT_ID } from "./graph";

export interface LayoutOptions {
  /** World width in viewBox units. */
  width?: number;
  /** World height in viewBox units. */
  height?: number;
  /** Hard cap on simulation ticks (alpha decay usually stops first). */
  maxFrames?: number;
  /** Which grouping the layout clusters: the explicit taxonomy groups
   *  (default) or the emergent communities. */
  groupBy?: "group" | "community";
}

/** Cores (group hubs) are pulled toward the world center much harder than
 *  regular nodes so they sit at the hub of the graph. */
const CORE_GRAVITY = 5;
const isCore = (id: string) => id.startsWith("core:");

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function layoutGraph(graph: GraphData, opts: LayoutOptions = {}): GraphData {
  const width = opts.width ?? 900;
  const height = opts.height ?? 560;
  const world = { w: width, h: height };
  const isCommunity = opts.groupBy === "community";
  // Bucket key: taxonomy group by default, emergent community id otherwise.
  const keyOf = (n: SimNode) => (isCommunity ? (n.community ?? 0) : n.group);

  // --- Initial positions: ring per bucket (group or community) around the
  // center, cores at the hub. The force loop below only has to refine a
  // near-converged layout instead of pulling a random scatter together (which
  // is what made the old client simulation run ~15s and visibly shake).
  const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 }));
  const buckets: Record<string, SimNode[]> = {};
  for (const n of nodes) {
    const k = String(keyOf(n));
    (buckets[k] = buckets[k] || []).push(n);
  }
  const bucketKeys = Object.keys(buckets);
  const cx = world.w / 2;
  const cy = world.h / 2;
  const ringRadius = Math.min(world.w, world.h) * 0.35;
  bucketKeys.forEach((bk, bi) => {
    const ga = (bucketKeys.length === 1 ? 0 : (bi / bucketKeys.length) * 2 * Math.PI) - Math.PI / 2;
    const gx = cx + Math.cos(ga) * ringRadius;
    const gy = cy + Math.sin(ga) * ringRadius;
    buckets[bk].forEach((n, ni) => {
      const a = (ni / Math.max(1, buckets[bk].length)) * 2 * Math.PI;
      const r = 30 + ni * 10;
      n.x = gx + Math.cos(a) * r;
      n.y = gy + Math.sin(a) * r;
    });
  });
  let coreI = 0;
  for (const n of nodes) {
    if (!isCore(n.id)) continue;
    const a = (coreI++ / 2) * 2 * Math.PI;
    n.x = cx + Math.cos(a) * 42;
    n.y = cy + Math.sin(a) * 42;
  }

  // --- Resolve links to node references (drop dangling edges defensively).
  const idx = new Map(nodes.map((n) => [n.id, n]));
  const links = graph.links
    .map((l) => ({
      source: idx.get(l.source),
      target: idx.get(l.target),
      weight: typeof l.weight === "number" ? l.weight : 1,
      type: l.type,
    }))
    .filter(
      (l): l is { source: SimNode; target: SimNode; weight: number; type: LinkType } =>
        // In community mode the group-hub springs (hub -> members) would fight
        // the community pull, dragging members back toward their taxonomy hub.
        Boolean(l.source && l.target) && !(isCommunity && l.type === "core"),
    );

  // --- Force simulation (same constants as the old client renderer).
  const N = Math.max(1, nodes.length);
  const charge = 2200 * Math.sqrt(N); // repulsion grows with N
  const gravity = 0.004 + 0.001 * Math.sqrt(N); // pull-to-center grows mildly
  // Community mode clusters members around their centroid; stronger than the
  // center gravity so clusters stay coherent, weak enough for the pairwise
  // repulsion to spread members inside a cluster.
  const communityGravity = gravity * 4;
  const damp = 0.86;
  const margin = Math.min(80, 60 + N * 0.5);
  // Alpha-based settling (d3-force style): every force scales with `alpha`,
  // which decays exponentially each tick, so the layout converges and stops on
  // its own instead of running a fixed frame count and shaking.
  const alphaDecay = Math.max(0.015, 0.03 - 0.001 * Math.sqrt(N));
  const alphaMin = 0.01;
  const maxFrames = opts.maxFrames ?? Math.max(400, N * 10);
  let alpha = 1;

  for (let frame = 0; frame < maxFrames && alpha >= alphaMin; frame++) {
    // Pairwise repulsion.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
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
      const dx = l.target.x - l.source.x;
      const dy = l.target.y - l.source.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = 60 + 80 * (1 - l.weight);
      const f = (d - ideal) * 0.04 * (0.5 + 0.5 * l.weight) * alpha;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      l.source.vx += fx;
      l.source.vy += fy;
      l.target.vx -= fx;
      l.target.vy -= fy;
    }
    // Community mode: pull each node toward its community's centroid so the
    // cluster reads as one blob (the group-hub springs are excluded above).
    if (isCommunity) {
      const centroids = new Map<number, { x: number; y: number; n: number }>();
      for (const n of nodes) {
        const c = n.community ?? 0;
        const acc = centroids.get(c) || { x: 0, y: 0, n: 0 };
        acc.x += n.x;
        acc.y += n.y;
        acc.n++;
        centroids.set(c, acc);
      }
      for (const n of nodes) {
        const acc = centroids.get(n.community ?? 0)!;
        n.vx += (acc.x / acc.n - n.x) * communityGravity * alpha;
        n.vy += (acc.y / acc.n - n.y) * communityGravity * alpha;
      }
    }
    // Center gravity + integration.
    for (const n of nodes) {
      const g = isCore(n.id) ? gravity * CORE_GRAVITY : gravity;
      n.vx += (world.w / 2 - n.x) * g * alpha;
      n.vy += (world.h / 2 - n.y) * g * alpha;
      n.vx *= damp;
      n.vy *= damp;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(margin, Math.min(world.w - margin, n.x));
      n.y = Math.max(margin, Math.min(world.h - margin, n.y));
    }
    alpha *= 1 - alphaDecay;
  }

  return {
    nodes: nodes.map(({ vx, vy, ...n }) => ({ ...n, x: round2(n.x), y: round2(n.y) })),
    links: graph.links,
  };
}

// ── Root-centered radial layout (the "one center" index graph) ───────────────
//
// Unlike `layoutGraph` — whose forces settle everything into one cloud with the
// hubs merely near the middle — this is a pure, geometric radial placement: the
// root sits at the exact center and every other node is placed on a concentric
// ring by its hop-distance from the root (hubs on ring 1, content on ring 2,
// topics on ring 3). No simulation, no randomness: the same graph always yields
// the same picture, which is what lets a compact SVG ship server-rendered.
//
// The ring radius grows with the number of nodes so the layout can never
// overflow: rings are filled to their arc capacity (`minArc` world px between
// neighbours) and the next ring opens only when the current one is full.

export interface RadialOptions {
  /** World width; the center is at (width/2, height/2). */
  width?: number;
  /** World height. */
  height?: number;
  /** Which node owns the center. Defaults to the graph root. */
  rootId?: string;
  /** Minimum world distance between neighbours on the same ring. */
  minArc?: number;
  /** Radial distance added when a ring fills up. */
  ringStep?: number;
  /** Radius of the first ring (the hub ring). */
  startRadius?: number;
}

export function layoutRadial(graph: GraphData, opts: RadialOptions = {}): GraphData {
  const width = opts.width ?? 1000;
  const height = opts.height ?? 1000;
  const rootId = opts.rootId ?? ROOT_ID;
  const minArc = opts.minArc ?? 40;
  const ringStep = opts.ringStep ?? 64;
  const startRadius = opts.startRadius ?? 84;
  const cx = width / 2;
  const cy = height / 2;

  // Undirected adjacency over the real nodes only.
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const l of graph.links) {
    if (!adj.has(l.source) || !adj.has(l.target)) continue;
    adj.get(l.source)!.push(l.target);
    adj.get(l.target)!.push(l.source);
  }

  // BFS hop-distance from the root.
  const level = new Map<string, number>();
  const hasRoot = graph.nodes.some((n) => n.id === rootId);
  if (hasRoot) {
    level.set(rootId, 0);
    let frontier: string[] = [rootId];
    let depth = 0;
    while (frontier.length > 0) {
      depth++;
      const next: string[] = [];
      for (const id of frontier) {
        for (const nb of adj.get(id) ?? []) {
          if (!level.has(nb)) {
            level.set(nb, depth);
            next.push(nb);
          }
        }
      }
      frontier = next;
    }
  }
  // Anything the root can't reach still has to land somewhere finite.
  const deepest = level.size > 0 ? Math.max(...level.values()) : 0;
  for (const n of graph.nodes) if (!level.has(n.id)) level.set(n.id, deepest + 1);

  // Group by ring, preserving the graph's node order for determinism.
  const byLevel = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) {
    if (n.id === rootId) continue;
    const lv = level.get(n.id)!;
    const bucket = byLevel.get(lv);
    if (bucket) bucket.push(n);
    else byLevel.set(lv, [n]);
  }

  const pos = new Map<string, { x: number; y: number }>();
  if (hasRoot) pos.set(rootId, { x: cx, y: cy });

  let radius = startRadius;
  for (const lv of [...byLevel.keys()].sort((a, b) => a - b)) {
    const ring = byLevel.get(lv)!;
    let i = 0;
    while (i < ring.length) {
      // `-1` so a ring always takes at least one node, even when tiny.
      const capacity = Math.max(1, Math.floor((2 * Math.PI * radius) / minArc));
      const slice = ring.slice(i, i + capacity);
      // Half-slot offset per ring so consecutive rings never line up radially.
      const offset = (radius / minArc) * 0.5 + Math.PI / 2;
      for (let k = 0; k < slice.length; k++) {
        const a = (k / slice.length) * 2 * Math.PI + offset;
        pos.set(slice[k].id, { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
      }
      i += slice.length;
      radius += ringStep;
    }
  }

  // Fit safety: if the outermost ring overflows the world, scale every position
  // toward the center so nothing is clipped at k = 1 (the /graph page renders
  // this layout in its fixed 900x560 viewBox). Spacing shrinks with it, which is
  // acceptable for a zoomable view and never triggers on the square index world.
  let used = 0;
  for (const n of graph.nodes) {
    const p = pos.get(n.id);
    if (!p) continue;
    const r = Math.hypot(p.x - cx, p.y - cy) + (n.size ?? 6) * NODE_SIZE;
    if (r > used) used = r;
  }
  const allowed = Math.min(cx, cy) - 20;
  if (used > allowed && used > 0) {
    const scale = allowed / used;
    for (const [id, p] of pos) {
      pos.set(id, { x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale });
    }
  }

  return {
    nodes: graph.nodes.map((n) => {
      const p = pos.get(n.id) ?? { x: cx, y: cy };
      return { ...n, x: round2(p.x), y: round2(p.y) };
    }),
    links: graph.links,
  };
}
