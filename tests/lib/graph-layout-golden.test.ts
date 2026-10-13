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
  ['core:me', 454.1, 279.66],
  ['core:projects', 456.88, 350.98],
  ['core:posts', 453.54, 211.77],
  ['p:volta', 554.7, 303.23],
  ['p:rfm', 538.11, 391.25],
  ['p:supabase', 380.22, 348.53],
  ['p:streamlit', 341.47, 404.88],
  ['post:ab-calibration', 543.29, 200.24],
  ['post:cohort-triangles', 369.58, 184.8],
  ['vp:funnel', 643.63, 286.35],
  ['topic:ab-testing', 511.13, 89.54],
  ['topic:retention', 303.46, 262.98],
  ['topic:segmentation', 239.27, 321.96],
];

const GOLDEN_COMMUNITY: Frozen[] = [
  ['core:me', 515.16, 268.7],
  ['core:projects', 429.24, 275.66],
  ['core:posts', 515.16, 268.7],
  ['p:volta', 425.04, 451.15],
  ['p:rfm', 493.98, 460.67],
  ['p:supabase', 415.42, 152.45],
  ['p:streamlit', 355.64, 207.47],
  ['post:ab-calibration', 365.64, 471.73],
  ['post:cohort-triangles', 280.44, 218.15],
  ['vp:funnel', 365.37, 394.71],
  ['topic:ab-testing', 448.08, 387.22],
  ['topic:retention', 290.31, 132.72],
  ['topic:segmentation', 351.95, 91.27],
];

// Second, cheaper lock on the same thing: catches a shift that the per-node
// table would still catch, but in one line and without a 13-row diff to read.
const GOLDEN_GROUP_HASH = '556b4b68f368134d982404137ba85d8d22bd6a475a288d733cff6910c90fb56f';
const GOLDEN_COMMUNITY_HASH = 'ba2bf5df122e6cd3eaa763e9bf984bf559325ab9a9d00b329b817cf644b8c894';

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
