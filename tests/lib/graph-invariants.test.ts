// Graph invariants against the REAL content collections on disk. These guard
// against a graph that silently degrades as content grows: orphan nodes,
// missing URLs, unweighted edges, or duplicate edges.
import { describe, it, expect, beforeAll } from "bun:test";
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { buildGraph, mergePostsForLocale, parseRelatedPath, type GraphData } from '../../src/lib/graph';
import { TOPICS } from '../../src/lib/topics';

const CONTENT = join(__dirname, '..', '..', 'src', 'content');

function loadCollection(name: string): { id: string; data: Record<string, unknown> }[] {
  const dir = join(CONTENT, name);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf-8');
      // Strip the frontmatter fence, keep the YAML block only.
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const data = (m ? parseYaml(m[1]) : {}) as Record<string, unknown>;
      return { id: f, data };
    });
}

let graphs: { ru: GraphData; en: GraphData };

beforeAll(() => {
  type BuildOpts = Parameters<typeof buildGraph>[0];
  const projects = loadCollection('projects') as BuildOpts['projects'];
  const projectsEn = loadCollection('projects-en') as BuildOpts['projects'];
  const posts = loadCollection('posts') as BuildOpts['posts'];
  const postsEn = loadCollection('posts-en') as BuildOpts['posts'];
  const parts = loadCollection('volta-parts') as BuildOpts['parts'];
  const partsEn = loadCollection('volta-parts-en') as BuildOpts['parts'];
  const glossary = loadCollection('glossary') as BuildOpts['glossary'];
  const glossaryEn = loadCollection('glossary-en') as BuildOpts['glossary'];

  graphs = {
    ru: buildGraph({ projects, posts, parts, topics: TOPICS, lang: 'ru', glossary }),
    en: buildGraph({
      projects: projectsEn,
      posts: mergePostsForLocale(posts, postsEn),
      parts: partsEn,
      topics: TOPICS,
      lang: 'en',
      glossary: glossaryEn,
    }),
  };
});

function invariants(name: string, getGraph: () => GraphData) {
  describe(`invariants — ${name} graph`, () => {
    it('has no orphan (disconnected) nodes', () => {
      const g = getGraph();
      const connected = new Set<string>();
      for (const l of g.links) {
        connected.add(l.source);
        connected.add(l.target);
      }
      const orphans = g.nodes.filter((n) => !connected.has(n.id)).map((n) => n.id);
      expect(orphans).toEqual([]);
    });

    it('gives every node a non-empty url', () => {
      const g = getGraph();
      for (const n of g.nodes) {
        expect(n.url, `node ${n.id}`).toBeTruthy();
      }
    });

    it('gives every edge a weight in (0,1] and a known type', () => {
      const g = getGraph();
      for (const l of g.links) {
        expect(l.weight, `edge ${l.source}→${l.target}`).toBeGreaterThan(0);
        expect(l.weight, `edge ${l.source}→${l.target}`).toBeLessThanOrEqual(1);
        expect(['related', 'children', 'topic', 'shared', 'core']).toContain(l.type);
      }
    });

    it('has no duplicate or self edges', () => {
      const g = getGraph();
      const seen = new Set<string>();
      for (const l of g.links) {
        expect(l.source, 'self-edge').not.toBe(l.target);
        const key = [l.source, l.target].sort().join('\u0000');
        expect(seen.has(key), `duplicate edge ${l.source}—${l.target}`).toBe(false);
        seen.add(key);
      }
    });

    it('references only existing nodes', () => {
      const g = getGraph();
      const ids = new Set(g.nodes.map((n) => n.id));
      for (const l of g.links) {
        expect(ids.has(l.source), `missing source ${l.source}`).toBe(true);
        expect(ids.has(l.target), `missing target ${l.target}`).toBe(true);
      }
    });

    it('produces at least one node and one edge', () => {
      const g = getGraph();
      expect(g.nodes.length).toBeGreaterThan(0);
      expect(g.links.length).toBeGreaterThan(0);
    });

    it('keeps every topic node in a non-singleton community', () => {
      // Tool-topic edges (sql/python) are excluded from clustering, so their
      // topic nodes would land in one-node communities — the absorb step must
      // fold them back into their majority-neighbor cluster.
      const g = getGraph();
      const sizes = new Map<number, number>();
      for (const n of g.nodes) {
        const c = n.community ?? 0;
        sizes.set(c, (sizes.get(c) ?? 0) + 1);
      }
      for (const n of g.nodes) {
        if (!n.id.startsWith('topic:')) continue;
        expect(sizes.get(n.community ?? 0), `topic ${n.id} is a singleton`).toBeGreaterThan(1);
      }
    });
  });
}

invariants('ru', () => graphs.ru);
invariants('en', () => graphs.en);

describe('real-content related parsing', () => {
  it('every related entry resolves to a real slug or node', () => {
    const graphsByLocale: Record<'ru' | 'en', GraphData> = { ru: graphs.ru, en: graphs.en };
    for (const coll of ['projects', 'projects-en', 'posts', 'posts-en', 'glossary', 'glossary-en']) {
      // The `-en` collections feed the EN graph; everything else the RU one.
      const lang: 'ru' | 'en' = coll.endsWith('-en') ? 'en' : 'ru';
      const ids = new Set(graphsByLocale[lang].nodes.map((n) => n.id));
      // Glossary terms only point at internal `/glossary/…/` or `/projects/…​/`
      // targets, so an unparsable internal path there is a real regression: a
      // silently-nulled glossary link must fail rather than be skipped.
      const requireInternalParse = coll.startsWith('glossary');
      const entries = loadCollection(coll);
      for (const entry of entries) {
        const related = (entry.data.related as unknown[] | undefined) ?? [];
        for (const rel of related) {
          const parsed = typeof rel === 'string' ? parseRelatedPath(rel) : null;
          if (!parsed) {
            if (requireInternalParse && typeof rel === 'string' && rel.startsWith('/')) {
              expect(parsed, `${coll}/${entry.id} → unparsable internal related ${rel}`).not.toBeNull();
            }
            continue;
          }
          if (parsed.type === 'glossary') {
            // A glossary target must exist as a real `g:<slug>` node in this
            // locale's graph — it must never collapse into a `post:<slug>` id.
            expect(ids.has(`g:${parsed.slug}`), `${coll}/${entry.id} → unresolved ${rel}`).toBe(true);
            continue;
          }
          // A related target may live in either locale (e.g. an EN project
          // linking to a RU-only post) — the link just needs to exist somewhere.
          const candidates = parsed.type === 'project'
            ? [...loadCollection('projects'), ...loadCollection('projects-en')]
            : [...loadCollection('posts'), ...loadCollection('posts-en')];
          expect(
            candidates.some((t) => basename(t.id) === `${parsed.slug}.md`),
            `${coll}/${entry.id} → unresolved ${rel}`,
          ).toBe(true);
        }
      }
    }
  });
});