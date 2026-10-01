import { describe, it, expect } from "bun:test";
import { buildGraph, isDirected, mergePostsForLocale, parseRelatedPath, subgraphAround } from '../../src/lib/graph';
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
    expect(coreEdges).toHaveLength(4);
    expect(coreEdges.some((l) => l.source === 'core:projects' && l.target === 'p:a' && l.weight === 1)).toBe(true);
    expect(coreEdges.some((l) => l.source === 'core:projects' && l.target === 'p:b')).toBe(true);
    expect(coreEdges.some((l) => l.source === 'core:posts' && l.target === 'post:x')).toBe(true);
    expect(coreEdges.some((l) => l.source === 'core:posts' && l.target === 'post:y')).toBe(true);
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
});