import { describe, it, expect } from "bun:test";
import { buildGraph, detectCommunities, isDirected, mergePostsForLocale, parseRelatedPath, subgraphAround } from '../../src/lib/graph';
import { TOPICS } from '../../src/lib/topics';

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

describe('isDirected', () => {
  it('marks related, children and topic edges as directed', () => {
    expect(isDirected('related')).toBe(true);
    expect(isDirected('children')).toBe(true);
    expect(isDirected('topic')).toBe(true);
  });

  it('marks shared (lateral) edges as undirected', () => {
    expect(isDirected('shared')).toBe(false);
  });

  it('marks core (hub) edges as directed', () => {
    expect(isDirected('core')).toBe(true);
  });
});

describe('parseRelatedPath', () => {
  it('parses project and post paths in both locales', () => {
    expect(parseRelatedPath('/projects/volta/')).toEqual({ type: 'project', slug: 'volta' });
    expect(parseRelatedPath('/en/projects/volta/')).toEqual({ type: 'project', slug: 'volta' });
    expect(parseRelatedPath('/posts/bayesian-ab-testing/')).toEqual({ type: 'post', slug: 'bayesian-ab-testing' });
    expect(parseRelatedPath('/en/posts/x/')).toEqual({ type: 'post', slug: 'x' });
  });

  it('parses glossary paths in both locales', () => {
    expect(parseRelatedPath('/glossary/cuped/')).toEqual({ type: 'glossary', slug: 'cuped' });
    expect(parseRelatedPath('/en/glossary/cuped/')).toEqual({ type: 'glossary', slug: 'cuped' });
  });

  it('rejects external URLs and non-project/post paths', () => {
    expect(parseRelatedPath('https://github.com/foo/bar')).toBeNull();
    expect(parseRelatedPath('/topics/sql/')).toBeNull();
    expect(parseRelatedPath('/posts/')).toBeNull();
  });
});

describe('mergePostsForLocale', () => {
  it('keeps the EN entry for translated posts', () => {
    const ru = [post('ab-calibration', { title: 'Калибровка A/B' })];
    const en = [post('ab-calibration', { title: 'A/B Calibration' })];
    const merged = mergePostsForLocale(ru, en);
    expect(merged).toHaveLength(1);
    expect(merged[0].data.title).toBe('A/B Calibration');
    expect(merged[0].data.url).toBeUndefined();
  });

  it('falls back to the RU entry with a RU url for untranslated posts', () => {
    const ru = [post('cohort-triangles', { title: 'Треугольники когорт' })];
    const merged = mergePostsForLocale(ru, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].data.title).toBe('Треугольники когорт');
    expect(merged[0].data.url).toBe('posts/cohort-triangles/');
  });

  it('drops EN-only posts that have no RU counterpart', () => {
    const ru = [post('a')];
    const en = [post('a'), post('en-only')];
    const merged = mergePostsForLocale(ru, en);
    expect(merged.map((p) => p.id)).toEqual(['a.md']);
  });
});

describe('subgraphAround', () => {
  it('returns the 1-hop neighborhood of a node', () => {
    const g = buildGraph({
      projects: [
        project('volta', { related: ['/posts/ab-calibration/'] }),
        project('ab', { related: ['/posts/ab-calibration/'] }),
      ],
      posts: [post('ab-calibration', { related: ['/projects/ab/'] })],
      parts: [],
      topics: TOPICS,
    });
    const sub = subgraphAround(g, 'p:volta');
    const ids = sub.nodes.map((n) => n.id);
    expect(ids).toContain('p:volta');
    expect(ids).toContain('post:ab-calibration');
    // p:ab is 2 hops away (volta → post → ab) — not in a 1-hop subgraph.
    expect(ids).not.toContain('p:ab');
    // Every link in the subgraph connects two included nodes.
    for (const l of sub.links) {
      expect(ids).toContain(l.source);
      expect(ids).toContain(l.target);
    }
  });

  it('expands to 2 hops when asked', () => {
    const g = buildGraph({
      projects: [
        project('volta', { related: ['/posts/ab-calibration/'] }),
        project('ab', { related: ['/posts/ab-calibration/'] }),
      ],
      posts: [post('ab-calibration', { related: ['/projects/ab/'] })],
      parts: [],
      topics: TOPICS,
    });
    const sub = subgraphAround(g, 'p:volta', 2);
    expect(sub.nodes.map((n) => n.id)).toContain('p:ab');
  });

  it('returns an empty graph for a missing center', () => {
    const g = buildGraph({ projects: [project('a')], posts: [], parts: [], topics: TOPICS });
    const sub = subgraphAround(g, 'p:nope');
    expect(sub.nodes).toEqual([]);
    expect(sub.links).toEqual([]);
  });
});

describe('buildGraph', () => {
  it('creates nodes for projects, posts, parts and topics with expected groups', () => {
    const g = buildGraph({
      projects: [project('volta', { track: 'experiments' })],
      posts: [post('ab-calibration', { category: 'guide', tags: ['ab-testing'] })],
      parts: [{ id: 'funnel.md', data: { title: 'Funnel' } }],
      topics: TOPICS,
      lang: 'ru',
    });
    expect(g.nodes.find((n) => n.id === 'p:volta')?.group).toBe('experiments');
    expect(g.nodes.find((n) => n.id === 'post:ab-calibration')?.group).toBe('guide');
    expect(g.nodes.find((n) => n.id === 'vp:funnel')?.group).toBe('experiments');
    expect(g.nodes.find((n) => n.id === 'topic:ab-testing')?.label).toBe('A/B-тестирование');
  });

  it('uses english topic keys as labels in en mode', () => {
    const g = buildGraph({
      projects: [project('volta', { description: 'ab testing methodology' })],
      posts: [],
      parts: [],
      topics: TOPICS,
      lang: 'en',
    });
    expect(g.nodes.find((n) => n.id === 'topic:ab-testing')?.label).toBe('ab-testing');
  });

  it('drops topic nodes that have no edges in a locale', () => {
    const g = buildGraph({
      projects: [],
      posts: [],
      parts: [],
      topics: TOPICS,
      lang: 'en',
    });
    expect(g.nodes.some((n) => n.id.startsWith('topic:'))).toBe(false);
  });

  it('links projects via related and volta children', () => {
    const g = buildGraph({
      projects: [
        project('volta', { children: ['funnel', 'ab'] }),
        project('ab', { related: ['/projects/volta/'] }),
      ],
      posts: [],
      parts: [
        { id: 'funnel.md', data: { title: 'Funnel' } },
        { id: 'ab.md', data: { title: 'AB' } },
      ],
      topics: TOPICS,
    });
    const keys = g.links.map((l) => [l.source, l.target].sort().join('|'));
    expect(keys).toContain('p:ab|p:volta');
    expect(keys).toContain('p:volta|vp:funnel');
    expect(keys).toContain('p:volta|vp:ab');
  });

  it('dedupes reversed edges', () => {
    const g = buildGraph({
      projects: [
        project('a', { related: ['/projects/b/'] }),
        project('b', { related: ['/projects/a/'] }),
      ],
      posts: [],
      parts: [],
      topics: TOPICS,
    });
    const ab = g.links.filter(
      (l) => [l.source, l.target].sort().join('|') === 'p:a|p:b',
    );
    expect(ab).toHaveLength(1);
  });

  it('links posts to topics by tag', () => {
    const g = buildGraph({
      projects: [],
      posts: [post('x', { tags: ['retention', 'cohort-analysis'] })],
      parts: [],
      topics: TOPICS,
    });
    expect(g.links.some((l) => l.source === 'post:x' && l.target === 'topic:retention')).toBe(true);
  });

  it('adds a hub-scaled size to nodes', () => {
    const g = buildGraph({
      projects: [project('a', { related: ['/projects/b/', '/projects/c/'] })],
      posts: [],
      parts: [],
      topics: TOPICS,
    });
    // 'a' has 2 edges, 'b'/'c' have 1 → 'a' is bigger.
    const a = g.nodes.find((n) => n.id === 'p:a');
    const b = g.nodes.find((n) => n.id === 'p:b');
    expect(a?.size).toBeGreaterThan(b?.size ?? 0);
    expect(g.nodes.every((n) => typeof n.size === 'number' && n.size > 0)).toBe(true);
  });

  it('assigns url and weight/type to nodes and edges', () => {
    const g = buildGraph({
      projects: [
        project('volta', { children: ['funnel'] }),
        project('ab', { related: ['/projects/volta/'] }),
      ],
      posts: [],
      parts: [{ id: 'funnel.md', data: { title: 'Funnel' } }],
      topics: TOPICS,
    });
    const volta = g.nodes.find((n) => n.id === 'p:volta');
    expect(volta?.url).toBe('projects/volta/');
    expect(g.nodes.find((n) => n.id === 'vp:funnel')?.url).toBe('projects/volta/funnel/');
    const abEdge = g.links.find(
      (l) => [l.source, l.target].sort().join('|') === 'p:ab|p:volta',
    );
    expect(abEdge?.weight).toBe(1);
    expect(abEdge?.type).toBe('related');
    const childEdge = g.links.find(
      (l) => [l.source, l.target].sort().join('|') === 'p:volta|vp:funnel',
    );
    expect(childEdge?.type).toBe('children');
  });

  it('adds locale prefix to urls in en mode', () => {
    const g = buildGraph({
      projects: [project('volta')],
      posts: [],
      parts: [],
      topics: TOPICS,
      lang: 'en',
    });
    expect(g.nodes.find((n) => n.id === 'p:volta')?.url).toBe('en/projects/volta/');
  });

  it('does not create python/sql project→topic edges from tools signal', () => {
    // Project advertises Python in tools but not in slug/title/desc.
    const g = buildGraph({
      projects: [project('foo', { tools: ['Python'], title: 'Foo', description: 'bar' })],
      posts: [],
      parts: [],
      topics: TOPICS,
    });
    expect(g.links.some((l) => l.source === 'p:foo' && l.target === 'topic:python')).toBe(false);
  });

  it('adds project↔project edge when two projects share ≥2 topics', () => {
    const g = buildGraph({
      projects: [
        project('a', { description: 'retention cohort segmentation' }),
        project('b', { description: 'retention segmentation funnel' }),
      ],
      posts: [],
      parts: [],
      topics: TOPICS,
    });
    const edge = g.links.find((l) => [l.source, l.target].sort().join('|') === 'p:a|p:b');
    expect(edge).toBeDefined();
    expect(edge?.type).toBe('shared');
    expect(edge?.weight).toBeGreaterThan(0);
    expect(edge?.weight).toBeLessThanOrEqual(1);
  });

  it('does not create dangling edges to missing nodes', () => {
    const g = buildGraph({
      projects: [project('a', { related: ['/projects/missing/', '/posts/ghost/'] })],
      posts: [],
      parts: [],
      topics: TOPICS,
    });
    const dangling = g.links.filter((l) => l.source === 'p:a');
    expect(dangling).toHaveLength(0);
  });

  it('creates core hub nodes for projects and posts', () => {
    const g = buildGraph({
      projects: [project('volta', { track: 'experiments' })],
      posts: [post('ab-calibration', { category: 'guide' })],
      parts: [],
      topics: TOPICS,
      lang: 'ru',
    });
    const projectsCore = g.nodes.find((n) => n.id === 'core:projects');
    const postsCore = g.nodes.find((n) => n.id === 'core:posts');
    expect(projectsCore?.label).toBe('Проекты');
    expect(projectsCore?.group).toBe('projects');
    expect(projectsCore?.url).toBe('projects/');
    expect(postsCore?.label).toBe('Статьи');
    expect(postsCore?.group).toBe('articles');
    expect(postsCore?.url).toBe('writing/');
  });

  it('links every project to the projects core and every post to the posts core', () => {
    const g = buildGraph({
      projects: [project('a'), project('b')],
      posts: [post('x'), post('y')],
      parts: [],
      topics: TOPICS,
    });
    const coreEdges = g.links.filter((l) => l.type === 'core');
    // 4 member→hub edges + the 2 root→hub edges (projects, posts).
    expect(coreEdges).toHaveLength(6);
    expect(coreEdges.some((l) => l.source === 'core:projects' && l.target === 'p:a' && l.weight === 1)).toBe(true);
    expect(coreEdges.some((l) => l.source === 'core:projects' && l.target === 'p:b')).toBe(true);
    expect(coreEdges.some((l) => l.source === 'core:posts' && l.target === 'post:x')).toBe(true);
    expect(coreEdges.some((l) => l.source === 'core:posts' && l.target === 'post:y')).toBe(true);
  });

  it('adds the single root and wires it to the non-empty type hubs', () => {
    const g = buildGraph({
      projects: [project('a')],
      posts: [post('x')],
      parts: [],
      topics: TOPICS,
    });
    const root = g.nodes.find((n) => n.id === 'core:me');
    expect(root, 'the graph has no root').toBeDefined();
    expect(root?.group).toBe('root');
    const rootEdges = g.links.filter((l) => l.type === 'core' && l.source === 'core:me');
    expect(rootEdges.map((l) => l.target).sort()).toEqual(['core:posts', 'core:projects']);
    // Every real node is reachable from the root (one connected center).
    const adj = new Map<string, string[]>();
    for (const n of g.nodes) adj.set(n.id, []);
    for (const l of g.links) {
      adj.get(l.source)?.push(l.target);
      adj.get(l.target)?.push(l.source);
    }
    const seen = new Set<string>(['core:me']);
    const queue = ['core:me'];
    while (queue.length) {
      for (const nb of adj.get(queue.shift()!) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    expect(seen.size).toBe(g.nodes.length);
  });

  it('skips root edges to empty hubs, so a content-less graph stays edge-less', () => {
    const g = buildGraph({ projects: [], posts: [], parts: [], topics: TOPICS });
    expect(g.links).toEqual([]);
  });

  it('uses english labels and urls for cores in en mode', () => {
    const g = buildGraph({
      projects: [project('a')],
      posts: [],
      parts: [],
      topics: TOPICS,
      lang: 'en',
    });
    expect(g.nodes.find((n) => n.id === 'core:projects')?.label).toBe('Projects');
    expect(g.nodes.find((n) => n.id === 'core:projects')?.url).toBe('en/projects/');
    expect(g.nodes.find((n) => n.id === 'core:posts')?.label).toBe('Articles');
    expect(g.nodes.find((n) => n.id === 'core:posts')?.url).toBe('en/writing/');
  });

  it('sizes core hubs larger than regular nodes', () => {
    const g = buildGraph({
      projects: [project('a', { related: ['/projects/b/'] }), project('b')],
      posts: [],
      parts: [],
      topics: TOPICS,
    });
    const core = g.nodes.find((n) => n.id === 'core:projects');
    const a = g.nodes.find((n) => n.id === 'p:a');
    expect(core?.size).toBeGreaterThan(a?.size ?? 0);
  });

  // Member counts chosen so every core clears the floor (16 edges) — below it
  // the hubs are deliberately pinned equal, which is the floor's job, not the
  // behaviour under test.
  const hubFixture = () =>
    buildGraph({
      projects: Array.from({ length: 18 }, (_, i) => project(`p${i}`)),
      posts: Array.from({ length: 22 }, (_, i) => post(`a${i}`)),
      parts: [],
      glossary: Array.from({ length: 28 }, (_, i) => ({ id: `t${i}.md`, data: { title: `t${i}` } })),
      topics: TOPICS,
    });

  it('paints every member by its section, not by its taxonomy group', () => {
    const g = buildGraph({
      projects: [project('volta', { track: 'experiments' }), project('ab', { track: 'analytics' })],
      posts: [post('x', { category: 'guide' })],
      parts: [{ id: 'funnel.md', data: { title: 'Funnel' } }],
      topics: TOPICS,
    });
    const sec = (id: string) => g.nodes.find((n) => n.id === id)?.section;
    // Hub and every member of the family share one section, so «Проекты» reads
    // as one colour wherever a node sits.
    for (const id of ['core:projects', 'p:volta', 'p:ab', 'vp:funnel']) {
      expect(sec(id), id).toBe('projects');
    }
    expect(sec('core:posts')).toBe('articles');
    expect(sec('post:x')).toBe('articles');
    // The taxonomy survives as `group`, which is what the layout clusters by —
    // recolouring a section must not reshuffle the graph.
    expect(g.nodes.find((n) => n.id === 'p:volta')?.group).toBe('experiments');
    expect(g.nodes.find((n) => n.id === 'post:x')?.group).toBe('guide');
  });

  it('sizes each hub by its own edge count, not all alike', () => {
    const g = hubFixture();
    const size = (id: string) => g.nodes.find((n) => n.id === id)?.size ?? 0;
    const projects = size('core:projects');
    const posts = size('core:posts');
    const glossary = size('core:glossary');
    // Each core also holds one edge to the root: 19 / 23 / 29 edges.
    expect(posts).toBeGreaterThan(projects);
    expect(glossary).toBeGreaterThan(posts);
    // The old log curve kept these within half a world unit of each other,
    // which is why every hub read as the same size on screen.
    expect(glossary - projects).toBeGreaterThan(3);
  });

  it('keeps the root above every hub even though it has the fewest edges', () => {
    const g = hubFixture();
    const deg = new Map<string, number>();
    for (const l of g.links) {
      deg.set(l.source, (deg.get(l.source) ?? 0) + 1);
      deg.set(l.target, (deg.get(l.target) ?? 0) + 1);
    }
    const rootSize = g.nodes.find((n) => n.id === 'core:me')?.size ?? 0;
    const hubs = g.nodes.filter((n) => n.id.startsWith('core:') && n.id !== 'core:me');
    expect(deg.get('core:me')).toBe(3);
    for (const h of hubs) {
      expect(deg.get(h.id) ?? 0).toBeGreaterThan(3);
      expect(rootSize).toBeGreaterThan(h.size ?? 0);
    }
  });
});
describe('detectCommunities', () => {
  it('does not merge two dense clusters across a few bridges', () => {
    // Two 4-cliques joined by 5 bridges: 17 edges, so the bridge share is
    // 5/17 ≈ 0.29 — below the 0.5 that would justify one merged community.
    // The gain used to double its whole bracket, which doubled the edge term
    // while leaving the penalty short, so this pair cleared ΔQ > 0 and the
    // graph collapsed into a single blob.
    const cluster = (p: string) => [1, 2, 3, 4].map((i) => `${p}${i}`);
    const nodes = [...cluster('a'), ...cluster('b')].map((id) => ({ id }));
    const links: { source: string; target: string }[] = [];
    for (const p of ['a', 'b']) {
      const ids = cluster(p);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) links.push({ source: ids[i], target: ids[j] });
      }
    }
    for (let i = 0; i < 5; i++) links.push({ source: `a${(i % 4) + 1}`, target: `b${(i % 4) + 1}` });

    const comm = detectCommunities(nodes, links);
    const communities = new Set(comm.values());
    // Greedy merge order may attach a bridge endpoint to a cluster, so the exact
    // partition is not the spec — collapsing everything into ONE community is.
    // With the old doubled bracket this graph produced a single community of 8.
    expect(communities.size).toBeGreaterThan(1);
    expect([...comm.values()].every((c) => c === comm.get('a1'))).toBe(false);
  });
});
