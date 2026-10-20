import { describe, it, expect } from "bun:test";
import { buildGraph, ROOT_ID, type GraphNode } from '../../src/lib/graph';
import { layoutGraph, layoutRadial } from '../../src/lib/graph-layout';
import { TOPICS } from '../../src/lib/topics';

// layoutGraph fills x/y on every node; the GraphNode type keeps them optional
// (absent before layout), so tests narrow the result.
type LaidNode = GraphNode & { x: number; y: number };
const laid = (graph: ReturnType<typeof buildGraph>, opts?: Parameters<typeof layoutGraph>[1]) =>
  layoutGraph(graph, opts) as { nodes: LaidNode[]; links: ReturnType<typeof buildGraph>['links'] };

const project = (
  slug: string,
  extra: Partial<{ track: string; related: string[]; children: string[]; tools: string[]; description: string; title: string }> = {},
) => ({
  id: `${slug}.md`,
  data: {
    title: extra.title ?? slug,
    track: extra.track,
    related: extra.related ?? [],
    children: extra.children ?? [],
    tools: extra.tools ?? [],
    description: extra.description ?? '',
  },
});

const post = (
  slug: string,
  extra: Partial<{ category: string; tags: string[]; related: string[]; title: string }> = {},
) => ({
  id: `${slug}.md`,
  data: {
    title: extra.title ?? slug,
    category: extra.category ?? 'note',
    tags: extra.tags ?? [],
    related: extra.related ?? [],
  },
});

function sampleGraph() {
  return buildGraph({
    projects: [
      project('volta', { track: 'experiments', children: ['funnel', 'ab'], related: ['/posts/ab-calibration/'] }),
      project('rfm', { track: 'experiments', related: ['/posts/cohort-triangles/'] }),
      project('supabase', { track: 'fullstack', description: 'retention cohort segmentation' }),
      project('streamlit', { track: 'fullstack', description: 'retention segmentation funnel' }),
    ],
    posts: [
      post('ab-calibration', { category: 'guide', tags: ['ab-testing'], related: ['/projects/volta/'] }),
      post('cohort-triangles', { category: 'note', tags: ['retention', 'cohort-analysis'] }),
    ],
    parts: [
      { id: 'funnel.md', data: { title: 'Funnel' } },
      { id: 'ab.md', data: { title: 'AB' } },
    ],
    topics: TOPICS,
    lang: 'ru',
  });
}

describe('layoutGraph', () => {
  it('is deterministic: the same input always produces the same positions', () => {
    const graph = sampleGraph();
    const a = laid(graph);
    const b = laid(graph);
    expect(a.nodes).toHaveLength(b.nodes.length);
    for (let i = 0; i < a.nodes.length; i++) {
      expect(a.nodes[i].x).toBe(b.nodes[i].x);
      expect(a.nodes[i].y).toBe(b.nodes[i].y);
    }
  });

  it('places every node at finite coordinates inside the world', () => {
    const graph = sampleGraph();
    const out = laid(graph, { width: 900, height: 560 });
    for (const n of out.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(900);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(560);
    }
  });

  it('rounds positions to 2 decimals', () => {
    const graph = sampleGraph();
    const out = laid(graph);
    for (const n of out.nodes) {
      expect(n.x).toBe(Math.round(n.x * 100) / 100);
      expect(n.y).toBe(Math.round(n.y * 100) / 100);
    }
  });

  it('pulls core hubs toward the center more than regular nodes', () => {
    const graph = sampleGraph();
    const out = laid(graph);
    const cx = 450;
    const cy = 280;
    const dist = (n: { x: number; y: number }) => Math.hypot(n.x - cx, n.y - cy);
    const cores = out.nodes.filter((n) => n.id.startsWith('core:'));
    const regular = out.nodes.filter((n) => !n.id.startsWith('core:'));
    expect(cores.length).toBeGreaterThan(0);
    const avgCore = cores.reduce((s, n) => s + dist(n), 0) / cores.length;
    const avgRegular = regular.reduce((s, n) => s + dist(n), 0) / regular.length;
    expect(avgCore).toBeLessThan(avgRegular);
  });

  it('keeps the node set and links intact', () => {
    const graph = sampleGraph();
    const out = laid(graph);
    expect(out.nodes.map((n) => n.id).sort()).toEqual(graph.nodes.map((n) => n.id).sort());
    expect(out.links).toHaveLength(graph.links.length);
    for (let i = 0; i < graph.links.length; i++) {
      expect(out.links[i].source).toBe(graph.links[i].source);
      expect(out.links[i].target).toBe(graph.links[i].target);
    }
  });

  it('handles a graph with no content (only core hubs) without crashing', () => {
    const graph = buildGraph({ projects: [], posts: [], parts: [], topics: TOPICS });
    const out = laid(graph);
    // buildGraph still emits the two core hubs; layout must place them finitely.
    expect(out.links).toEqual([]);
    expect(out.nodes.length).toBeGreaterThan(0);
    for (const n of out.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});

describe('layoutGraph community mode', () => {
  const meanDist = (ns: { x: number; y: number }[]) => {
    let total = 0;
    let count = 0;
    for (let i = 0; i < ns.length; i++)
      for (let j = i + 1; j < ns.length; j++) {
        total += Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y);
        count++;
      }
    return count ? total / count : 0;
  };

  it('is deterministic (same input always produces the same positions)', () => {
    const graph = sampleGraph();
    const a = laid(graph, { groupBy: 'community' });
    const b = laid(graph, { groupBy: 'community' });
    for (let i = 0; i < a.nodes.length; i++) {
      expect(a.nodes[i].x).toBe(b.nodes[i].x);
      expect(a.nodes[i].y).toBe(b.nodes[i].y);
    }
  });

  it('repositions nodes relative to the group layout', () => {
    const graph = sampleGraph();
    const groupPos = laid(graph);
    const communityPos = laid(graph, { groupBy: 'community' });
    const moved = communityPos.nodes.filter((n) => {
      const g = groupPos.nodes.find((x) => x.id === n.id)!;
      return g.x !== n.x || g.y !== n.y;
    });
    expect(moved.length).toBeGreaterThan(0);
  });

  it('places every node at finite coordinates inside the world', () => {
    const graph = sampleGraph();
    const out = laid(graph, { groupBy: 'community', width: 900, height: 560 });
    for (const n of out.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(900);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(560);
    }
  });

  it('clusters multi-member communities tightly around their centroids', () => {
    const graph = sampleGraph();
    const out = laid(graph, { groupBy: 'community' });
    const byCommunity = new Map<number, { x: number; y: number }[]>();
    for (const n of out.nodes) {
      const c = n.community ?? 0;
      if (!byCommunity.has(c)) byCommunity.set(c, []);
      byCommunity.get(c)!.push(n);
    }
    const multi = [...byCommunity.values()].filter((m) => m.length >= 2);
    expect(multi.length).toBeGreaterThan(0);
    const allNodes = out.nodes;
    const overall = meanDist(allNodes);
    // Measured on the sample graph: within-cluster mean ~60, overall ~193.
    // Assert compactness structurally: members hugging their centroid and the
    // cluster far tighter than the graph as a whole.
    for (const members of multi) {
      const ccx = members.reduce((s, n) => s + n.x, 0) / members.length;
      const ccy = members.reduce((s, n) => s + n.y, 0) / members.length;
      const dists = members.map((n) => Math.hypot(n.x - ccx, n.y - ccy));
      const dMean = dists.reduce((s, v) => s + v, 0) / dists.length;
      const dMax = Math.max(...dists);
      expect(dMean).toBeLessThan(100);
      expect(dMax).toBeLessThan(140);
      expect(dMean).toBeLessThan(0.5 * overall);
    }
  });

  it('keeps the node set and links intact', () => {
    const graph = sampleGraph();
    const out = laid(graph, { groupBy: 'community' });
    expect(out.nodes.map((n) => n.id).sort()).toEqual(graph.nodes.map((n) => n.id).sort());
    for (let i = 0; i < graph.links.length; i++) {
      expect(out.links[i].source).toBe(graph.links[i].source);
      expect(out.links[i].target).toBe(graph.links[i].target);
    }
  });
});

describe('layoutRadial (the single-center index graph)', () => {
  const radial = (graph = sampleGraph()) =>
    layoutRadial(graph, { width: 1000, height: 1000 }) as {
      nodes: LaidNode[];
      links: ReturnType<typeof buildGraph>['links'];
    };

  it('pins the root at the exact center', () => {
    const out = radial();
    const root = out.nodes.find((n) => n.id === ROOT_ID)!;
    expect(root).toBeDefined();
    expect(root.x).toBe(500);
    expect(root.y).toBe(500);
  });

  it('is deterministic: the same input always produces the same positions', () => {
    const a = radial();
    const b = radial();
    for (let i = 0; i < a.nodes.length; i++) {
      expect(a.nodes[i].x).toBe(b.nodes[i].x);
      expect(a.nodes[i].y).toBe(b.nodes[i].y);
    }
  });

  it('places nodes farther out the more hops they are from the root', () => {
    const g = sampleGraph();
    const out = radial(g);
    const dist = (n: { x: number; y: number }) => Math.hypot(n.x - 500, n.y - 500);
    // Hop distance from the root, over the same undirected graph.
    const adj = new Map<string, string[]>();
    for (const n of g.nodes) adj.set(n.id, []);
    for (const l of g.links) {
      adj.get(l.source)?.push(l.target);
      adj.get(l.target)?.push(l.source);
    }
    const level = new Map<string, number>([[ROOT_ID, 0]]);
    let frontier = [ROOT_ID];
    for (let d = 1; frontier.length; d++) {
      const next: string[] = [];
      for (const id of frontier)
        for (const nb of adj.get(id) ?? [])
          if (!level.has(nb)) {
            level.set(nb, d);
            next.push(nb);
          }
      frontier = next;
    }
    const maxAt = (lv: number) =>
      Math.max(...out.nodes.filter((n) => level.get(n.id) === lv).map(dist));
    const minAt = (lv: number) =>
      Math.min(...out.nodes.filter((n) => level.get(n.id) === lv).map(dist));
    // Ring 2 begins beyond ring 1's farthest node.
    expect(minAt(2)).toBeGreaterThan(maxAt(1));
  });

  it('keeps every node finite and inside the world', () => {
    for (const n of radial().nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(1000);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(1000);
    }
  });

  it('keeps the node set and links intact', () => {
    const graph = sampleGraph();
    const out = radial(graph);
    expect(out.nodes.map((n) => n.id).sort()).toEqual(graph.nodes.map((n) => n.id).sort());
    expect(out.links).toHaveLength(graph.links.length);
  });

  it('fits the /graph 900x560 world with the root at its centre', () => {
    const out = layoutRadial(sampleGraph(), {
      width: 900,
      height: 560,
      minArc: 34,
      ringStep: 48,
      startRadius: 84,
    });
    const root = out.nodes.find((n) => n.id === ROOT_ID)!;
    expect(root.x).toBe(450);
    expect(root.y).toBe(280);
    for (const n of out.nodes) {
      expect(n.x, `${n.id} x`).toBeGreaterThanOrEqual(0);
      expect(n.x, `${n.id} x`).toBeLessThanOrEqual(900);
      expect(n.y, `${n.id} y`).toBeGreaterThanOrEqual(0);
      expect(n.y, `${n.id} y`).toBeLessThanOrEqual(560);
    }
  });

  it('scales the rings down when a big graph would overflow the world', () => {
    const big = buildGraph({
      projects: Array.from({ length: 120 }, (_, i) => project(`p${i}`)),
      posts: [],
      parts: [],
      topics: [],
      lang: 'ru',
    });
    const out = layoutRadial(big, {
      width: 900,
      height: 560,
      minArc: 34,
      ringStep: 48,
      startRadius: 84,
    });
    for (const n of out.nodes) {
      expect(n.x, `${n.id} x`).toBeGreaterThanOrEqual(0);
      expect(n.x, `${n.id} x`).toBeLessThanOrEqual(900);
      expect(n.y, `${n.id} y`).toBeGreaterThanOrEqual(0);
      expect(n.y, `${n.id} y`).toBeLessThanOrEqual(560);
    }
  });
});

describe('core placement', () => {
  it('never lays two core nodes on the same point', () => {
    // Cores (me / projects / posts) sit on an inner ring. The angle used to be
    // divided by a hardcoded 2, so with three cores the third landed at 2π —
    // on top of the first — and d = 0 meant repulsion could never separate
    // them afterwards. A collision here is not cosmetic: both labels stack.
    for (const mode of [undefined, 'group', 'community'] as const) {
      const graph = sampleGraph();
      // `core` is a layout-internal flag stripped from the returned nodes, so
      // identify the cores by id on the input graph.
      const coreIds = new Set(graph.nodes.filter((n) => n.id.startsWith('core:')).map((n) => n.id));
      const nodes = laid(graph, mode ? { groupBy: mode } : undefined).nodes;
      const cores = nodes.filter((n) => coreIds.has(n.id)).map((n) => `${n.x},${n.y}`);
      expect(cores.length).toBeGreaterThanOrEqual(3);
      expect(new Set(cores).size, `duplicate core position in ${mode ?? 'default'} mode`).toBe(
        cores.length,
      );
    }
  });
});
