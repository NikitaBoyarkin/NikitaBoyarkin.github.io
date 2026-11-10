// Unit tests for the per-section split of the combined graph.
//
// /graph/ renders three `<KnowledgeGraph>` instances — projects, glossary,
// articles — each built from `sectionSubgraph`, with `bridgeCounts` /
// `bridgeTargets` summarising the edges that leave the section as a `→N` badge.
// The failure modes are quiet: a topic leaking into a graph it does not touch,
// a link whose endpoint was filtered out, a badge that over- or under-counts
// the edges it stands for. None of them shows up in dist/ assertions, so they
// are pinned here against a small synthetic fixture whose expected numbers are
// worked out by hand.
import { describe, it, expect } from 'bun:test';
import {
  sectionSubgraph,
  bridgeCounts,
  bridgeTargets,
  GRAPH_SECTIONS,
  type GraphData,
  type GraphLink,
  type GraphNode,
  type LinkType,
} from '../../src/lib/graph';

const node = (id: string, section: string): GraphNode => ({
  id,
  label: id,
  group: section,
  section,
  url: `test/${id}/`,
});

const link = (source: string, target: string, type: LinkType): GraphLink => ({
  source,
  target,
  weight: 0.5,
  type,
});

/**
 * Sections in the fixture: `root` (the person), `talks` (an external hub),
 * `projects`, `glossary`, `articles` and `topic`. Edges are:
 *
 *   p1–t1 topic      projects ↔ its own topic
 *   p1–a1 related    projects → articles bridge
 *   p1–p2 shared     inside projects
 *   p2–a2 related    projects → articles bridge
 *   a1–t2 topic      articles ↔ its own topic
 *   g1–t1 topic      glossary ↔ a topic it shares with projects
 *   core:me–p1 core  projects → root bridge
 *   core:me–event:program core  outside every section graph
 *
 * `t3` is an edge-less topic; `p3` is an edge-less project.
 */
const FIXTURE: GraphData = {
  nodes: [
    node('core:me', 'root'),
    node('event:program', 'talks'),
    node('p1', 'projects'),
    node('p2', 'projects'),
    node('p3', 'projects'),
    node('a1', 'articles'),
    node('a2', 'articles'),
    node('g1', 'glossary'),
    node('t1', 'topic'),
    node('t2', 'topic'),
    node('t3', 'topic'),
  ],
  links: [
    link('p1', 't1', 'topic'),
    link('p1', 'a1', 'related'),
    link('p1', 'p2', 'shared'),
    link('p2', 'a2', 'related'),
    link('a1', 't2', 'topic'),
    link('g1', 't1', 'topic'),
    link('core:me', 'p1', 'core'),
    link('core:me', 'event:program', 'core'),
  ],
};

const ids = (g: GraphData) => g.nodes.map((n) => n.id).sort();
const sectionOf = new Map(FIXTURE.nodes.map((n) => [n.id, n.section]));

/** Degree in the full fixture graph (each link counted once per endpoint). */
function fullDegree(id: string): number {
  return FIXTURE.links.filter((l) => l.source === id || l.target === id).length;
}

/** Degree among the links the section graph kept. */
function internalDegree(g: GraphData, id: string): number {
  return g.links.filter((l) => l.source === id || l.target === id).length;
}

describe('sectionSubgraph', () => {
  it('keeps every node of the section, even an isolated one', () => {
    const g = sectionSubgraph(FIXTURE, 'projects');
    expect(ids(g)).toContain('p3');
  });

  it('lets a topic in only when an edge ties it to the section’s own nodes', () => {
    // t1 links to p1 (projects) → enters the projects graph.
    expect(ids(sectionSubgraph(FIXTURE, 'projects'))).toContain('t1');
    // t2 links only to a1 (articles) → must NOT enter the projects graph.
    expect(ids(sectionSubgraph(FIXTURE, 'projects'))).not.toContain('t2');
    // t1 links to g1 (glossary) and p1 → enters both; t2 only articles.
    expect(ids(sectionSubgraph(FIXTURE, 'glossary'))).toContain('t1');
    expect(ids(sectionSubgraph(FIXTURE, 'glossary'))).not.toContain('t2');
    expect(ids(sectionSubgraph(FIXTURE, 'articles'))).toContain('t2');
    expect(ids(sectionSubgraph(FIXTURE, 'articles'))).not.toContain('t1');
    // A topic nobody links to never enters any graph.
    for (const s of GRAPH_SECTIONS) {
      expect(ids(sectionSubgraph(FIXTURE, s)), s).not.toContain('t3');
    }
  });

  it('never admits a node of another section as a guest', () => {
    const projects = ids(sectionSubgraph(FIXTURE, 'projects'));
    for (const foreign of ['a1', 'a2', 'g1', 'core:me', 'event:program']) {
      expect(projects, foreign).not.toContain(foreign);
    }
  });

  it('returns only links with both endpoints inside the node set', () => {
    for (const s of GRAPH_SECTIONS) {
      const g = sectionSubgraph(FIXTURE, s);
      const inside = new Set(ids(g));
      for (const l of g.links) {
        expect(inside.has(l.source), `${s}: ${l.source}`).toBe(true);
        expect(inside.has(l.target), `${s}: ${l.target}`).toBe(true);
      }
    }
  });

  it('projects keeps its two internal links and drops the bridges', () => {
    const g = sectionSubgraph(FIXTURE, 'projects');
    expect(ids(g)).toEqual(['p1', 'p2', 'p3', 't1']);
    expect(g.links.map((l) => [l.source, l.target].sort().join('—')).sort()).toEqual([
      'p1—p2',
      'p1—t1',
    ]);
  });
});

describe('bridgeCounts', () => {
  it('counts each edge leaving the section, keyed by destination section', () => {
    expect(bridgeCounts(FIXTURE, 'projects')).toEqual({
      p1: { articles: 1, root: 1 },
      p2: { articles: 1 },
      t1: { glossary: 1 },
    });
  });

  it('does not count edges that stay inside, or edges nowhere near the section', () => {
    // p1–p2 and p1–t1 are internal; core:me–event:program touches nothing in
    // projects. Only the four outgoing edges remain.
    const total = Object.values(bridgeCounts(FIXTURE, 'projects')).reduce(
      (a, per) => a + Object.values(per).reduce((x, y) => x + y, 0),
      0,
    );
    expect(total).toBe(4);
  });

  it('charges every incident edge exactly once: bridges + internal === full degree', () => {
    // The invariant a `→N` badge stands on. If a bridge were double-counted or
    // an internal edge dropped, the badge would promise edges the drawing
    // does not have (or hide ones it does).
    for (const s of GRAPH_SECTIONS) {
      const g = sectionSubgraph(FIXTURE, s);
      const bridges = bridgeCounts(FIXTURE, s);
      for (const n of g.nodes) {
        const bridged = Object.values(bridges[n.id] ?? {}).reduce((a, b) => a + b, 0);
        expect(bridged + internalDegree(g, n.id), `${s}: ${n.id}`).toBe(fullDegree(n.id));
      }
    }
  });

  it('leaves out nodes with no outgoing bridge', () => {
    const bridges = bridgeCounts(FIXTURE, 'projects');
    expect(bridges.p3).toBeUndefined();
  });
});

describe('bridgeTargets', () => {
  it('names the nodes each badge points at', () => {
    expect(bridgeTargets(FIXTURE, 'projects')).toEqual({
      p1: { articles: ['a1'], root: ['core:me'] },
      p2: { articles: ['a2'] },
      t1: { glossary: ['g1'] },
    });
  });

  it('agrees with bridgeCounts everywhere', () => {
    for (const s of GRAPH_SECTIONS) {
      const counts = bridgeCounts(FIXTURE, s);
      const targets = bridgeTargets(FIXTURE, s);
      const froms = new Set([...Object.keys(counts), ...Object.keys(targets)]);
      for (const from of froms) {
        const perCount = counts[from] ?? {};
        const perTarget = targets[from] ?? {};
        const sections = new Set([...Object.keys(perCount), ...Object.keys(perTarget)]);
        for (const to of sections) {
          expect(perTarget[to]?.length ?? 0, `${s}: ${from}→${to}`).toBe(perCount[to] ?? 0);
        }
      }
    }
  });

  it('points only at real nodes of the destination section, never into the subgraph', () => {
    for (const s of GRAPH_SECTIONS) {
      const inside = new Set(ids(sectionSubgraph(FIXTURE, s)));
      for (const [from, per] of Object.entries(bridgeTargets(FIXTURE, s))) {
        for (const [to, targets] of Object.entries(per)) {
          for (const id of targets) {
            expect(sectionOf.has(id), `${s}: unknown target ${id}`).toBe(true);
            expect(sectionOf.get(id), `${s}: ${from}→${id} section`).toBe(to);
            expect(inside.has(id), `${s}: ${from}→${id} inside`).toBe(false);
          }
        }
      }
    }
  });
});
