// Frozen output of `layoutGraph`, on a fixed graph.
//
// Why this file exists: `graph-layout.test.ts` only checks self-consistency
// (deterministic, finite, inside the world, rounded) — every one of those stays
// true if the simulation silently shifts every coordinate, which would move the
// SSR SVG on /graph/ and every /graph.json consumer without failing a test. The
// force constants are about to be extracted into a shared module so the client
// simulation can reuse them; this fixture is the mechanism that catches a typo
// in that move.
//
// It is a golden, not a spec: the numbers below are meaningless except as "what
// the code produced". If a change to the simulation is deliberate, re-record
// them (and say so in the commit) — never edit one row to make a test pass.
//
// Re-recorded 2026-10-20, deliberately: the core ring divided the angle by a
// hardcoded 2, so the third core (glossary) landed exactly on the first and
// could never be separated by repulsion; and the Louvain gain doubled its whole
// bracket instead of only the penalty, over-merging communities. Both fixes
// move every coordinate, which is exactly what this fixture should report.
//
// The fixture graph is built here, not imported from the sibling test, so an
// edit to `sampleGraph()` cannot silently move this golden.

import { describe, it, expect } from "bun:test";
import { createHash } from "node:crypto";
import { buildGraph } from '../../src/lib/graph';
import { layoutGraph } from '../../src/lib/graph-layout';
import { TOPICS } from '../../src/lib/topics';

const project = (
  slug: string,
  extra: Partial<{ track: string; related: string[]; children: string[]; description: string }> = {},
) => ({
  id: `${slug}.md`,
  data: {
    title: slug,
    track: extra.track,
    related: extra.related ?? [],
    children: extra.children ?? [],
    tools: [],
    description: extra.description ?? '',
  },
});

const post = (
  slug: string,
  extra: Partial<{ category: string; tags: string[]; related: string[] }> = {},
) => ({
  id: `${slug}.md`,
  data: {
    title: slug,
    category: extra.category ?? 'note',
    tags: extra.tags ?? [],
    related: extra.related ?? [],
  },
});

/** Small but structurally complete: two taxonomy groups, a shared topic, a
 *  children edge, an explicit related edge and the three cores. */
function goldenGraph() {
  return buildGraph({
    projects: [
      project('volta', { track: 'experiments', children: ['funnel'], related: ['/posts/ab-calibration/'] }),
      project('rfm', { track: 'experiments', related: ['/projects/volta/'] }),
      project('supabase', { track: 'fullstack', description: 'retention cohort segmentation' }),
      project('streamlit', { track: 'fullstack', description: 'retention segmentation funnel' }),
    ],
    posts: [
      post('ab-calibration', { category: 'guide', tags: ['ab-testing'], related: ['/projects/volta/'] }),
      post('cohort-triangles', { category: 'note', tags: ['retention', 'cohort-analysis'] }),
    ],
    parts: [{ id: 'funnel.md', data: { title: 'Funnel' } }],
    topics: TOPICS,
    lang: 'ru',
  });
}

type Frozen = [id: string, x: number, y: number];

const GOLDEN_GROUP: Frozen[] = [
  ['core:me', 471.45, 276.31],
  ['core:projects', 460.24, 346.81],
  ['core:posts', 431.65, 220.86],
  ['p:volta', 557.2, 305.94],
  ['p:rfm', 537.94, 395.21],
  ['p:supabase', 380.36, 315.25],
  ['p:streamlit', 360.87, 385.33],
  ['post:ab-calibration', 528.49, 203.54],
  ['post:cohort-triangles', 337.95, 253.73],
  ['vp:funnel', 644.99, 288.51],
  ['topic:ab-testing', 506.03, 93.51],
  ['topic:retention', 251.14, 323.8],
  ['topic:segmentation', 307.69, 196.85],
];

const GOLDEN_COMMUNITY: Frozen[] = [
  ['core:me', 536.87, 285.62],
  ['core:projects', 452.06, 294.58],
  ['core:posts', 486.68, 224.06],
  ['p:volta', 421.93, 452.87],
  ['p:rfm', 491.21, 452.35],
  ['p:supabase', 408.55, 160.8],
  ['p:streamlit', 352.47, 218.06],
  ['post:ab-calibration', 364.69, 480.29],
  ['post:cohort-triangles', 277.66, 219.55],
  ['vp:funnel', 352.53, 404],
  ['topic:ab-testing', 426.89, 385.23],
  ['topic:retention', 290.17, 135.45],
  ['topic:segmentation', 353.12, 95.86],
];

// Second, cheaper lock on the same thing: catches a shift that the per-node
// table would still catch, but in one line and without a 13-row diff to read.
const GOLDEN_GROUP_HASH = '3aab7ff76ad90218a09625bee96e58da670b64711379c3b998cc7a9628e0bd05';
const GOLDEN_COMMUNITY_HASH = '443a08f53b1c90a6c492178099f85605c13a3279b65a29fef99eab5db23d1607';

const layout = (groupBy?: 'group' | 'community') => {
  const out = layoutGraph(goldenGraph(), groupBy ? { groupBy } : {}) as {
    nodes: ({ id: string; x: number; y: number })[];
  };
  return out.nodes.map((n) => [n.id, n.x, n.y] as Frozen);
};

const hashOf = (rows: Frozen[]) =>
  createHash('sha256')
    .update(rows.map(([id, x, y]) => `${id} ${x.toFixed(2)} ${y.toFixed(2)}`).join('\n'))
    .digest('hex');

describe('layoutGraph golden (group mode)', () => {
  it('produces exactly the frozen coordinates', () => {
    expect(layout()).toEqual(GOLDEN_GROUP);
  });

  it('hashes to the frozen value', () => {
    expect(hashOf(layout())).toBe(GOLDEN_GROUP_HASH);
  });
});

describe('layoutGraph golden (community mode)', () => {
  it('produces exactly the frozen coordinates', () => {
    expect(layout('community')).toEqual(GOLDEN_COMMUNITY);
  });

  it('hashes to the frozen value', () => {
    expect(hashOf(layout('community'))).toBe(GOLDEN_COMMUNITY_HASH);
  });
});

describe('the golden is a live constraint, not decoration', () => {
  it('fails for a different simulation budget', () => {
    // Mutation control in miniature: if the tick loop were skipped, stubbed or
    // its constants changed, the output would land somewhere else and this
    // comparison would go red — which is the only thing that makes the frozen
    // rows above meaningful.
    const truncated = layoutGraph(goldenGraph(), { maxFrames: 1 }) as {
      nodes: ({ id: string; x: number; y: number })[];
    };
    const rows = truncated.nodes.map((n) => [n.id, n.x, n.y] as Frozen);
    expect(hashOf(rows)).not.toBe(GOLDEN_GROUP_HASH);
  });

  it('keeps the two modes distinguishable, so neither hash is a shared constant', () => {
    expect(GOLDEN_GROUP_HASH).not.toBe(GOLDEN_COMMUNITY_HASH);
  });
});
