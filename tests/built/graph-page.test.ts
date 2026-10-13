// The graph page as a full-width board, against the REAL built output.
//
// Why this file exists: `bare` (component) and `bleed` (layout) are two optional
// props whose absence is silent — the page still builds and still shows a graph,
// only inside a card in a 1180px column, which is exactly the state the board
// replaced. Nothing in tests/lib can see a prop; only dist/ can.
//
// The card the role landings embed must survive untouched, so `/colleague/` is
// asserted as the control: same component, no `kg-bare`.
//
// Requires `bun run build` first (reads dist/*.html).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

const PAGES = [
  { file: 'graph/index.html', h1: 'Граф контента', note: 'Собирается из коллекций на build-time' },
  { file: 'en/graph/index.html', h1: 'Content graph', note: 'Built from the content collections' },
] as const;

const CONTROL = 'colleague/index.html';

const html = new Map<string, string>();

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const p of [...PAGES.map((p) => p.file), CONTROL]) {
    const path = resolve(DIST, p);
    if (!existsSync(path)) throw new Error(`built page missing: ${p}`);
    html.set(p, readFileSync(path, 'utf8'));
  }
});

describe('graph page board (built HTML)', () => {
  for (const { file, h1, note } of PAGES) {
    const doc = () => html.get(file)!;

    it(`${file}: is a board page, not a locked full-screen canvas`, () => {
      // `bleed` releases the reading column; `canvas-fullbleed` would instead
      // lock the document to 100dvh, which this page must not do (it scrolls).
      expect(doc()).toMatch(/<html[^>]*class="[^"]*\bbleed\b[^"]*"/);
      expect(doc()).not.toMatch(/class="[^"]*canvas-fullbleed/);
      expect(doc()).toContain('canvas-static');
    });

    it(`${file}: the section is the board, not a container`, () => {
      expect(doc()).toContain('class="graph-board reveal"');
      expect(doc()).toContain('graph-board-head');
      expect(doc()).toContain('graph-board-gen');
      expect(doc()).not.toContain('<section class="container');
    });

    it(`${file}: exactly one h1, and it is the page title`, () => {
      const h1s = doc().match(/<h1[\s>]/g) ?? [];
      expect(h1s.length).toBe(1);
      expect(doc()).toContain(`>${h1}</h1>`);
      expect(doc()).toContain(note);
    });

    it(`${file}: the graph renders bare (no card surface)`, () => {
      expect(doc()).toMatch(/id="kg-root"[^>]*class="[^"]*\bkg-bare\b/);
    });

    it(`${file}: the drawing is unchanged and cannot be stretched`, () => {
      expect(doc()).toContain('viewBox="0 0 900 560"');
      expect(doc()).toMatch(/preserveAspectRatio="[^"]*meet[^"]*"/);
    });

    it(`${file}: the JS-off and screen-reader content survives the rework`, () => {
      expect(doc()).toContain('id="kg-sr-desc"');
      expect(doc()).toContain('src/lib/graph.ts');
    });

    it(`${file}: both cores carry their owner-specified colour`, () => {
      // articles is a theme token, not a hex: #1400c3 is unreadable on the dark
      // page, so the themes lighten it (see the token test below). projects is
      // one orange in every theme.
      expect(doc()).toContain('fill="var(--kg-core-articles)"');
      expect(doc()).toContain('fill="#ff4e02"');
    });
  }

  it(`${CONTROL}: the embedded graph keeps its card`, () => {
    const doc = html.get(CONTROL)!;
    expect(doc).toContain('id="kg-root"');
    expect(doc).not.toContain('kg-bare');
    expect(doc).not.toContain('class="graph-board');
  });
});

describe('graph core colour token (built CSS)', () => {
  it('defines --kg-core-articles once per theme, and only light keeps the hex', () => {
    // Three values, three scopes, one order. Nothing else in the build binds
    // them: drop the light override and the cream page silently gets the
    // washed-out #6a5cff, keep the hex on dark and the hub disappears at 1.3:1.
    const dir = resolve(DIST, '_astro');
    const css = readdirSync(dir)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(resolve(dir, f), 'utf8'))
      .join('\n');

    const scopes = [...css.matchAll(/--kg-core-articles:\s*(#[0-9a-fA-F]{6})/g)].map((m) => {
      const before = css.slice(0, m.index);
      return [before.slice(before.lastIndexOf('}') + 1, before.lastIndexOf('{')).trim(), m[1]];
    });

    expect(scopes).toEqual([
      [':root', '#6a5cff'],
      ['[data-theme=light]', '#1400c3'],
      ['[data-theme=cyberpunk]', '#6a5cff'],
    ]);
  });
});
