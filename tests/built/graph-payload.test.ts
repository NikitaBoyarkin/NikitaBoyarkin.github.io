import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The knowledge graph used to serialise its tooltip copy twice: once into the
// SSR `<title>` of every node/edge, and once into the `#kg-data` JSON as
// `nodeT`/`edgeT` (57 KB raw on /colleague/, 124 789 B of payload in total).
// Both arrays are pure functions of `nodes` + `links`, which already ship, so the
// client rebuilds them with the same `buildGraphTooltips` the server uses.
//
// The failure mode is quiet: dropping the builder call would still render a
// graph — the tooltips would just be `undefined` until someone hovered a node.
//
// `/graph/` now renders three instances (projects, glossary, articles), each
// with its own payload inside its own root; `/colleague/` still renders one,
// keyed `main`. Every payload is parsed from its instance's slice, and the two
// locales are checked for parity so a section graph cannot go missing from one.

const ROOT = resolve(__dirname, '..', '..');
const PAGES = ['/colleague/index.html', '/graph/index.html', '/en/graph/index.html'];

interface Instance {
  key: string;
  rootTag: string;
  html: string;
  data: {
    key?: string;
    section?: string;
    nodes: Array<{ id: string; section: string; url: string }>;
    links: Array<{ source: string; target: string; type: string }>;
    nodeT?: unknown;
    edgeT?: unknown;
  };
}

function readPage(path: string): string {
  const file = resolve(ROOT, `dist${path}`);
  if (!existsSync(file)) throw new Error(`dist${path} missing — run \`bun run build\` first`);
  return readFileSync(file, 'utf8');
}

function instancesOf(html: string): Instance[] {
  const roots = [...html.matchAll(/<div\b[^>]*data-kg="root"[^>]*>/g)];
  return roots.map((m, i) => {
    const inst = html.slice(m.index!, i + 1 < roots.length ? roots[i + 1].index! : html.length);
    const payload = /<script[^>]*data-kg="data"[^>]*>([\s\S]*?)<\/script>/.exec(inst)?.[1] ?? '';
    return {
      key: /data-kg-instance="([^"]*)"/.exec(m[0])?.[1] ?? '',
      rootTag: m[0],
      html: inst,
      data: JSON.parse(payload),
    };
  });
}

const parsed = new Map(PAGES.map((p) => [p, instancesOf(readPage(p))]));

describe('graph payload carries data, not precomputed copy', () => {
  for (const path of PAGES) {
    const instances = () => parsed.get(path)!;

    it(`${path}: every graph root declares its key, locale and analytics slot`, () => {
      const list = instances();
      expect(list.length).toBeGreaterThan(0);
      for (const inst of list) {
        // The root is the client's lookup key — `main` on the legacy pages, the
        // section name on the three /graph/ panels.
        expect(inst.rootTag, path).toContain(`data-kg-instance="${inst.key}"`);
        expect(inst.rootTag, `${path}:${inst.key}`).toMatch(/data-graph-key="([^"]*)"/);
        expect(/data-graph-key="([^"]*)"/.exec(inst.rootTag)![1]).toBe(inst.key);
        // `data-lang` lives on EVERY root: the client rebuilds tooltip copy per
        // instance, so one root without it would ship untranslated tooltips.
        expect(inst.rootTag, `${path}:${inst.key}`).toMatch(/data-lang="(ru|en)"/);
      }
      // Locale is a property of the page, not of a section.
      const expectedLang = path.startsWith('/en/') ? 'en' : 'ru';
      for (const inst of list) {
        expect(inst.rootTag, `${path}:${inst.key}`).toContain(`data-lang="${expectedLang}"`);
      }
      if (path === '/colleague/index.html') {
        expect(list.map((i) => i.key)).toEqual(['main']);
        expect(list[0].rootTag).not.toContain('data-analytics-graph');
      } else {
        expect(list.map((i) => i.key)).toEqual(['projects', 'glossary', 'articles']);
        for (const inst of list) {
          expect(inst.rootTag, `${path}:${inst.key}`).toContain(`data-analytics-graph="${inst.key}"`);
          expect(inst.data.key).toBe(inst.key);
          expect(inst.data.section).toBe(inst.key);
        }
      }
    });

    // The instances each page MUST render. Iterating the page's own list (and
    // returning early on a miss) let a section graph vanish with a green test;
    // now a missing instance fails here, naming the key that was expected.
    const EXPECTED: Record<string, string[]> = {
      '/colleague/index.html': ['main'],
      '/graph/index.html': ['projects', 'glossary', 'articles'],
      '/en/graph/index.html': ['projects', 'glossary', 'articles'],
    };
    for (const key of EXPECTED[path]) {
      const inst = () => {
        const found = instances().find((i) => i.key === key);
        expect(found, `${path}: no instance keyed "${key}" (expected ${EXPECTED[path].join(', ')})`).toBeTruthy();
        return found!;
      };

      it(`${path}:${key}: ships nodes and links`, () => {
        const found = inst();
        expect(Array.isArray(found.data.nodes)).toBe(true);
        expect(found.data.nodes.length).toBeGreaterThan(0);
        expect(Array.isArray(found.data.links)).toBe(true);
        expect(found.data.links.length).toBeGreaterThan(0);
        // Links only reference nodes this payload actually carries.
        const ids = new Set(found.data.nodes.map((n) => n.id));
        for (const l of found.data.links) {
          expect(ids.has(l.source), `${path}:${key}: missing source ${l.source}`).toBe(true);
          expect(ids.has(l.target), `${path}:${key}: missing target ${l.target}`).toBe(true);
        }
      });

      it(`${path}:${key}: drops the duplicated tooltip arrays`, () => {
        const found = inst();
        expect(found.data.nodeT).toBeUndefined();
        expect(found.data.edgeT).toBeUndefined();
      });

      it(`${path}:${key}: still renders tooltip titles in the SVG`, () => {
        // What the dedupe must not cost: the server-rendered <title> lines the
        // hover tooltip and the screen-reader mirror both rely on. Counted per
        // instance, since each instance renders only its own nodes' edges.
        const found = inst();
        expect(found.html.match(/<title>/g)?.length ?? 0).toBeGreaterThan(found.data.nodes.length);
      });
    }
  }
});

describe('graph payload parity across locales', () => {
  const ru = () => parsed.get('/graph/index.html')!;
  const en = () => parsed.get('/en/graph/index.html')!;

  it('renders the same sections in the same order', () => {
    expect(ru().map((i) => i.key)).toEqual(en().map((i) => i.key));
  });

  it('keeps the same section mix and edge-type mix per instance', () => {
    for (let i = 0; i < ru().length; i++) {
      const a = ru()[i];
      const b = en()[i];
      expect(a.key).toBe(b.key);
      // One EN-only project is expected; the *set* of sections is not.
      expect([...new Set(a.data.nodes.map((n) => n.section))].sort()).toEqual(
        [...new Set(b.data.nodes.map((n) => n.section))].sort(),
      );
      expect([...new Set(a.data.links.map((l) => l.type))].sort()).toEqual(
        [...new Set(b.data.links.map((l) => l.type))].sort(),
      );
    }
  });

  it('every RU node exists in the EN graph too', () => {
    // EN falls back to RU pages for untranslated content, so it can only be a
    // superset — a node missing from EN is a section graph that lost content.
    for (let i = 0; i < ru().length; i++) {
      const enIds = new Set(en()[i].data.nodes.map((n) => n.id));
      for (const n of ru()[i].data.nodes) {
        expect(enIds.has(n.id), `${ru()[i].key}: ${n.id} missing from EN`).toBe(true);
      }
    }
  });

  it('locale-prefixes the navigable urls', () => {
    for (let i = 0; i < ru().length; i++) {
      for (const n of ru()[i].data.nodes) {
        // Topic pages are RU-only by design (see graph.ts) and fall back.
        if (n.id.startsWith('topic:')) continue;
        expect(n.url, `${ru()[i].key}: ${n.id}`).not.toMatch(/^en\//);
      }
      for (const n of en()[i].data.nodes) {
        if (n.id.startsWith('topic:')) continue;
        // Post/term/project urls are locale-prefixed or an intentional RU
        // fallback for an untranslated entry; both are non-empty navigable paths.
        expect(n.url, `${en()[i].key}: ${n.id}`).toBeTruthy();
        // Truthy alone let a dead link ship. An English url is either under
        // `en/` or the RU page an untranslated post falls back to
        // (`mergePostsForLocale`), so the page it points at has to be in the
        // build — that is what a reader actually clicks.
        expect(
          existsSync(resolve(ROOT, 'dist', n.url, 'index.html')),
          `${en()[i].key}: ${n.id} -> ${n.url}`,
        ).toBe(true);
      }
    }
  });
});
