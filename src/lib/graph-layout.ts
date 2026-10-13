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
import type { GraphData, GraphNode } from "./graph";
import { NODE_SIZE, ROOT_ID } from "./graph";
import { physicsParams, stepSim, type SimLink, type SimNode } from "./graph-physics";

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

const isCore = (id: string) => id.startsWith("core:");

/** Graph nodes carry the identity the layout needs; positions and velocities
 *  come from the shared kernel. */
type LaidNode = GraphNode & SimNode;

const round2 = (v: number) => Math.round(v * 100) / 100;

export function layoutGraph(graph: GraphData, opts: LayoutOptions = {}): GraphData {
  const width = opts.width ?? 900;
  const height = opts.height ?? 560;
  const world = { w: width, h: height };
  const isCommunity = opts.groupBy === "community";
  // Bucket key: taxonomy group by default, emergent community id otherwise.
  const keyOf = (n: LaidNode) => (isCommunity ? (n.community ?? 0) : n.group);

  // --- Initial positions: ring per bucket (group or community) around the
  // center, cores at the hub. The force loop below only has to refine a
  // near-converged layout instead of pulling a random scatter together (which
  // is what made the old client simulation run ~15s and visibly shake).
  const nodes: LaidNode[] = graph.nodes.map((n) => ({
    ...n,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    core: isCore(n.id),
  }));
  const buckets: Record<string, LaidNode[]> = {};
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
    if (!n.core) continue;
    const a = (coreI++ / 2) * 2 * Math.PI;
    n.x = cx + Math.cos(a) * 42;
    n.y = cy + Math.sin(a) * 42;
  }

  // --- Resolve links to node indices (drop dangling edges defensively).
  const indexOf = new Map(nodes.map((n, i) => [n.id, i]));
  const links: SimLink[] = graph.links.flatMap((l) => {
    const source = indexOf.get(l.source);
    const target = indexOf.get(l.target);
    if (source === undefined || target === undefined) return [];
    // In community mode the group-hub springs (hub -> members) would fight the
    // community pull, dragging members back toward their taxonomy hub.
    if (isCommunity && l.type === "core") return [];
    return [{ source, target, weight: typeof l.weight === "number" ? l.weight : 1 }];
  });

  // --- Force simulation. The constants and the tick itself live in
  // `graph-physics.ts` so the client simulation runs the same forces.
  const params = physicsParams(nodes.length, opts.maxFrames);
  let alpha = 1;

  for (let frame = 0; frame < params.maxFrames && alpha >= params.alphaMin; frame++) {
    stepSim(nodes, links, {
      alpha,
      params,
      width,
      height,
      clusterByCommunity: isCommunity,
    });
    alpha *= 1 - params.alphaDecay;
  }

  return {
    nodes: nodes.map(({ vx, vy, core, home, fixed, hidden, ...n }) => ({
      ...n,
      x: round2(n.x),
      y: round2(n.y),
    })),
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
