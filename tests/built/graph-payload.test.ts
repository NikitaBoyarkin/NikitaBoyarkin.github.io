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

const ROOT = resolve(__dirname, '..', '..');
const PAGES = ['/colleague/index.html', '/graph/index.html', '/en/graph/index.html'];

describe('graph payload carries data, not precomputed copy', () => {
  for (const path of PAGES) {
    const file = resolve(ROOT, `dist${path}`);
    if (!existsSync(file)) throw new Error(`dist${path} missing — run \`bun run build\` first`);
    const html = readFileSync(file, 'utf8');
    const payload = /<script[^>]*id="kg-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    const data = JSON.parse(payload);

    it(`${path}: ships nodes and links`, () => {
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(data.nodes.length).toBeGreaterThan(0);
      expect(Array.isArray(data.links)).toBe(true);
      expect(data.links.length).toBeGreaterThan(0);
    });

    it(`${path}: drops the duplicated tooltip arrays`, () => {
      expect(data.nodeT).toBeUndefined();
      expect(data.edgeT).toBeUndefined();
    });

    it(`${path}: still renders tooltip titles in the SVG`, () => {
      // What the dedupe must not cost: the server-rendered <title> lines the
      // hover tooltip and the screen-reader mirror both rely on.
      expect(html.match(/<title>/g)?.length ?? 0).toBeGreaterThan(data.nodes.length);
    });

    it(`${path}: carries the locale the client rebuild needs`, () => {
      expect(html).toMatch(/id="kg-root"[^>]*data-lang="(ru|en)"/);
    });
  }
});
