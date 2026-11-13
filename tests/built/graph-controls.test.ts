// The graph's controls, against the REAL built output.
//
// Why this file exists: the controls are reworked in markup while their
// behaviour lives in a client script, so a change can compile, build and still
// leave the toolbar unreadable — which is exactly what happened. The legend, the
// search dropdown and its empty state are built with `createElement`, and Astro
// scopes its <style> by stamping `data-astro-cid-…` on rendered elements, so
// none of those rules matched and the legend shipped as loose unstyled text with
// a native checkbox in it. That half is runtime (the script copies the
// component's scope attribute onto JS-made nodes) and only a browser can prove
// it; the half below is what dist/ can hold still: the controls each carry an
// icon or a label of their own, none of them is a bare font glyph, and no count
// is welded into a button's text.
//
// Requires `bun run build` first (reads dist/*.html).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

// Same component, card variant — the controls must not diverge between the
// board and the embedded graph.
const PAGES = ['graph/index.html', 'en/graph/index.html', 'hire/colleague/index.html'] as const;

const html = new Map<string, string>();

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const p of PAGES) {
    const path = resolve(DIST, p);
    if (!existsSync(path)) throw new Error(`built page missing: ${p}`);
    html.set(p, readFileSync(path, 'utf8'));
  }
});

/** Every element in the document carrying `data-kg-action`. */
function actionButtons(doc: string): string[] {
  return doc.match(/<(?:button)[^>]*data-kg-action="[^"]*"[^>]*>[\s\S]*?<\/(?:button)>/g) ?? [];
}

/** One rendered `<KnowledgeGraph>` instance. `/graph/` draws three (projects,
 *  glossary, articles), each with its own control bar; `/colleague/` draws the
 *  one combined graph, keyed `main`. Controls are asserted per instance so a
 *  section graph that lost its toolbar cannot hide behind a sibling that kept
 *  one. */
interface Instance {
  key: string;
  html: string;
}

function instancesOf(doc: string): Instance[] {
  const roots = [...doc.matchAll(/<div\b[^>]*data-kg="root"[^>]*>/g)];
  return roots.map((m, i) => ({
    key: /data-kg-instance="([^"]*)"/.exec(m[0])?.[1] ?? '',
    html: doc.slice(m.index!, i + 1 < roots.length ? roots[i + 1].index! : doc.length),
  }));
}

/** The instance keys each page is expected to render, in order. */
const KEYS: Record<string, string[]> = {
  'graph/index.html': ['projects', 'glossary', 'articles'],
  'en/graph/index.html': ['projects', 'glossary', 'articles'],
  'hire/colleague/index.html': ['main'],
};

/** The JSON payload an instance ships for its client — nodes and links. */
function payloadOf(inst: string): { nodes: unknown[]; links: { type: string }[] } {
  return JSON.parse(
    /<script[^>]*data-kg="data"[^>]*>([\s\S]*?)<\/script>/.exec(inst)![1],
  );
}

describe('graph controls (built HTML)', () => {
  for (const file of PAGES) {
    const doc = () => html.get(file)!;

    it(`${file}: renders one control bar per graph instance`, () => {
      // /graph/ is three graphs in a row, /colleague/ one embedded graph.
      expect(instancesOf(doc()).map((i) => i.key)).toEqual(KEYS[file]);
    });

    it(`${file}: no font glyph survives as visible text`, () => {
      // `+ − ⟲ ⛶` came from whatever font won the fallback chain, so weight and
      // optical size drifted per platform and two of them risked a tofu box.
      for (const glyph of ['>+<', '>−<', '>⟲<', '>⛶<']) {
        expect(doc()).not.toContain(glyph);
      }
    });

    for (const key of KEYS[file]) {
      const inst = () => {
        const found = instancesOf(doc()).find((i) => i.key === key);
        if (!found) throw new Error(`${file}: no instance keyed ${key}`);
        return found.html;
      };

      it(`${file}:${key}: the four view controls render as drawn icons, not font glyphs`, () => {
        for (const action of ['zoom-in', 'zoom-out', 'reset', 'fullscreen']) {
          const btn = actionButtons(inst()).find((b) => b.includes(`data-kg-action="${action}"`));
          expect(btn, `${action} button`).toBeTruthy();
          expect(btn!).toContain('<svg');
          expect(btn!).toMatch(/aria-hidden="true"/);
          expect(btn!).toMatch(/aria-label="[^"]+"/);
        }
      });

      it(`${file}:${key}: the zoom trio is one labelled group, fullscreen sits outside it`, () => {
        const zoom = inst().match(/<div[^>]*class="kg-zoom"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? '';
        expect(zoom).toContain('role="group"');
        expect(zoom).toMatch(/aria-label="[^"]+"/);
        expect((zoom.match(/data-kg-action="/g) ?? []).length).toBe(3);
        expect(zoom).not.toContain('fullscreen');
        expect(inst()).toMatch(/data-kg-action="fullscreen"/);
      });

      it(`${file}:${key}: the physics toggle is a labelled toggle, outside the zoom trio`, () => {
        const btn = actionButtons(inst()).find((b) => b.includes('data-kg-action="toggle-physics"'));
        expect(btn, 'physics button').toBeTruthy();
        // A toggle in the same row as Color/Arrows/Focus: it carries its own word
        // and its pressed state, and its accessible name is what tells the user
        // that dragging is what starts the simulation and releasing ends it.
        expect(btn!).toContain('kg-btn-toggle');
        expect(btn!).toMatch(/aria-pressed="false"/);
        expect(btn!).toMatch(/aria-label="[^"]+"/);
        expect(btn!).not.toContain('<svg');
        // Physics is on only when the toggle says so, and the zoom group beside
        // it is asserted at exactly three actions elsewhere — this one must not
        // have landed inside it.
        const zoom = inst().match(/<div[^>]*class="kg-zoom"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? '';
        expect(zoom).not.toContain('toggle-physics');
      });

      it(`${file}:${key}: every preset chip separates its label from its count`, () => {
        const chips = inst().match(/<button[^>]*class="kg-chip"[^>]*>[\s\S]*?<\/button>/g) ?? [];
        expect(chips.length).toBe(6);
        for (const chip of chips) {
          expect(chip).toContain('kg-chip-label');
          expect(chip).toContain('kg-chip-count');
          expect(chip).toMatch(/data-kg-preset="[^"]*"/);
          expect(chip).toMatch(/data-label="[^"]+"/);
        }
        // The count used to be welded into the button's text as `Все (109)`, which
        // made every chip a different width and threw the span away on each render.
        expect(inst()).not.toMatch(/>[^<>]*\(\d+\)</);
      });

      it(`${file}:${key}: edge filters list exactly the types this subgraph has`, () => {
        // The panel is data-driven: only the edge types present in the
        // instance's own payload get a row (a section graph has no
        // project↔project `shared` edges, so no `shared` row). A fixed count
        // would either pin a defect or fail on the next content change, so the
        // expectation comes from the payload the client reads.
        const data = payloadOf(inst());
        const present = new Set<string>(data.links.map((l: { type: string }) => l.type));
        const rows = inst().match(/<label[^>]*class="kg-edge-toggle"[^>]*>[\s\S]*?<\/label>/g) ?? [];
        expect(rows.length, `${file}:${key}: rows`).toBe(present.size);
        const types = rows.map((row) => /data-kg-type="([a-z]+)"/.exec(row)?.[1] ?? '');
        expect(new Set(types).size, `${file}:${key}: unique types`).toBe(rows.length);
        expect(types.sort(), `${file}:${key}: types`).toEqual([...present].sort());
        // Consistency with the payload alone lets an edge type vanish from the
        // payload without a word. `/colleague/` is the combined graph and must
        // carry the full vocabulary literally; the section graphs may drop a
        // type they have no edges of, but only from that vocabulary.
        const VOCAB = ['related', 'children', 'topic', 'shared', 'core'];
        if (file === 'hire/colleague/index.html') {
          expect([...present].sort(), `${file}:${key}: exactly five edge types`).toEqual(
            [...VOCAB].sort(),
          );
        } else {
          expect(present.size, `${file}:${key}: edge types present`).toBeGreaterThan(0);
          for (const t of present) {
            expect(VOCAB, `${file}:${key}: unknown edge type "${t}"`).toContain(t);
          }
        }
        for (const row of rows) {
          expect(row, `${file}:${key}`).toMatch(/data-kg-type="[a-z]+"/);
          expect(row.indexOf('<input'), `${file}:${key}`).toBeLessThan(row.indexOf('kg-edge-swatch'));
        }
      });

      it(`${file}:${key}: the legend is still a list, and the search box keeps its label`, () => {
        // `id="kg-legend"` / `id="kg-search-input"` were page-unique when one
        // graph rendered; three instances need per-instance hooks, so the
        // controls are found by `data-kg` role and the results panel by its
        // key-suffixed id.
        expect(inst()).toMatch(/data-kg="legend"[^>]*role="list"/);
        expect(inst()).toMatch(/data-kg="legend"[^>]*aria-label="[^"]+"/);
        expect(inst()).toMatch(/data-kg="search-input"[\s\S]*?aria-label="[^"]+"/);
        expect(inst()).toContain(`aria-controls="kg-search-results-${key}"`);
        expect(inst()).toContain(`id="kg-search-results-${key}"`);
      });
    }
  }
});
