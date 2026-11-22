import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// One KPI shelf for every demo board.
//
// The defect this binds: the bento strip of metric tiles at the top of a board
// was declared thirteen times, inline, in thirteen hand-authored HTML files —
// eight different `minmax` floors (102 / 104 / 112 / 118 / 132 / 168px),
// `repeat(3,1fr)`, `repeat(5,1fr)` and two different gaps. Nothing compared the
// copies, so the same component read differently on every page, and a
// fractional track let a tile grow to 450px at 1920 while its own number stayed
// 24px. Both recipes now live in `public/demos/demo.css`: `.kpis` fills the
// panel it sits in, `.kpis--shelf` caps a page-level strip at 150px per track.
//
// What fails when the claim stops being true:
//   1. a board re-declares `grid-template-columns` on `.kpis` — the drift, and
//      because a board's inline `<style>` follows the stylesheet link, that copy
//      would silently win;
//   2. the page-level shelf loses its cap and goes back to a fractional track,
//      or the default loses the 84px floor and stops fitting narrow columns;
//   3. the value/label scale creeps back up.

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const DEMOS = join(ROOT, 'public', 'demos');

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the FIRST `selector { … }` block. */
function blockOf(css: string, selector: string): string {
  const clean = stripComments(css);
  const at = clean.indexOf(`${selector} {`);
  if (at === -1) throw new Error(`no ${selector} block`);
  const open = clean.indexOf('{', at);
  const close = clean.indexOf('}', open);
  if (open === -1 || close === -1) throw new Error(`unterminated ${selector}`);
  return clean.slice(open + 1, close);
}

/** Every `<style>` body a board ships. */
function inlineStyles(html: string): string[] {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
}

/**
 * Every `grid-template-columns` a board still declares for `.kpis` (or its
 * named variants, `.kpis--fill`). A declaration counts when its selector list
 * ends in that class and does not narrow it (`.kpis > *` and `.kpis .kpi` are
 * tile rules, not the grid). Media-query bodies are one-liners on some boards,
 * so the scan is textual rather than a CSS parse: find the class, walk to the
 * next `{`, take that block.
 */
function kpiGridDeclarations(styles: string[]): string[] {
  const found: string[] = [];
  for (const style of styles) {
    const clean = stripComments(style);
    for (const match of clean.matchAll(/([^{}]*\.kpis(?:--[\w-]+)?)\s*\{([^{}]*)\}/g)) {
      const selector = match[1].trim().split(/\n/).pop() ?? '';
      // `@media … { .kpis{…` — the captured selector carries the at-rule text.
      const tail = selector.slice(Math.max(0, selector.lastIndexOf('@')));
      if (
        !/^@media[^{]*\.kpis(?:--[\w-]+)?$/.test(tail.trim()) &&
        !/(?:^|[\s,])\.kpis(?:--[\w-]+)?$/.test(selector)
      ) {
        continue;
      }
      const decl = /grid-template-columns\s*:\s*([^;}]+)/.exec(match[2]);
      if (decl) found.push(decl[1].trim());
    }
  }
  return found;
}

const BOARDS = readdirSync(DEMOS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .filter((entry) => existsSync(join(DEMOS, entry.name, 'index.html')))
  .map((entry) => entry.name)
  .sort();

const SHELF_BOARDS = BOARDS.filter((slug) =>
  /class="kpis(?:\s|")/.test(read(join('public', 'demos', slug, 'index.html'))),
);

describe('KPI shelf', () => {
  it('declares the default strip once, in demo.css, filling its panel', () => {
    const block = blockOf(read('public/demos/demo.css'), '.kpis');
    const columns = /grid-template-columns\s*:\s*([^;]+);/.exec(block)?.[1].trim() ?? '';
    const gap = /(?:^|[;\s])gap\s*:\s*([^;]+);/.exec(block)?.[1].trim();
    // A floor and fill: the count follows 84px, so five tiles share one row in
    // a narrow column instead of wrapping to two.
    expect(columns).toStartWith('repeat(auto-fit, minmax(84px, 1fr))');
    expect(gap).toBeTruthy();
  });

  it('declares the page-level shelf with a capped track', () => {
    const block = blockOf(read('public/demos/demo.css'), '.kpis--shelf');
    const columns = /grid-template-columns\s*:\s*([^;]+);/.exec(block)?.[1].trim() ?? '';
    expect(columns).toStartWith('repeat(auto-fill, minmax(');
    // A capped max, not `1fr`: the tile must stop growing with the viewport.
    const max = /minmax\(\s*[\d.]+px\s*,\s*([^)]+)\)/.exec(columns)?.[1].trim();
    expect(max).toMatch(/^\d+px$/);
    expect(Number.parseFloat(max!)).toBeLessThanOrEqual(150);
  });

  it('gives a tile its column layout for both spellings (.kpi and a bare child)', () => {
    const css = stripComments(read('public/demos/demo.css'));
    expect(css).toMatch(/\.kpis > \*,\s*\n\.kpi \{/);
  });

  it('keeps the page-level shelf in the same file, as a named recipe', () => {
    // One strip is not inside a panel (volta's) and is the only one that opts
    // into the cap; it says so with a class, so the choice is visible at the
    // markup rather than hidden in a per-board stylesheet.
    expect(read('public/demos/volta/index.html')).toMatch(/class="kpis kpis--shelf"/);
  });

  it('keeps the value/label on the compact scale', () => {
    const value = blockOf(read('public/demos/demo.css'), '.demo-kpi-value');
    const label = blockOf(read('public/demos/demo.css'), '.demo-kpi-label');
    const valueSize = /font-size\s*:\s*([^;]+);/.exec(value)?.[1].trim() ?? '';
    const labelSize = /font-size\s*:\s*([^;]+);/.exec(label)?.[1].trim() ?? '';
    expect(Number.parseFloat(valueSize)).toBeLessThanOrEqual(1.25);
    expect(valueSize).toEndWith('rem');
    expect(Number.parseFloat(labelSize)).toBeLessThanOrEqual(11.5);
    expect(labelSize).toEndWith('px');
  });

  it('finds the strips it claims to cover', () => {
    // Guard against the scan silently matching nothing: the shelf is on at
    // least a dozen boards, and a page that grew one would be covered here the
    // moment it ships.
    expect(SHELF_BOARDS.length).toBeGreaterThanOrEqual(12);
  });

  for (const slug of SHELF_BOARDS) {
    it(`${slug} lets the shared shelf own the grid`, () => {
      const styles = inlineStyles(read(join('public', 'demos', slug, 'index.html')));
      expect(kpiGridDeclarations(styles)).toEqual([]);
    });
  }

  it('bites: a board that re-declares the grid is flagged', () => {
    // Mutation control — without it a green run could mean the matcher found
    // nothing and compared two empty arrays.
    const drifted = ['  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-3)}'];
    expect(kpiGridDeclarations(drifted)).toEqual(['repeat(5,1fr)']);

    const inMedia = ['  @media (max-width:520px){ .kpis{grid-template-columns:repeat(2,1fr)} }'];
    expect(kpiGridDeclarations(inMedia)).toEqual(['repeat(2,1fr)']);

    // …and a tile rule is not the grid.
    const tileRule = ['  .kpis > *{display:flex;flex-direction:column}\n  .kpis .kpi{padding:8px}'];
    expect(kpiGridDeclarations(tileRule)).toEqual([]);

    // …and the named variant is scanned too, so it cannot drift per board.
    const variant = ['  .kpis--shelf{grid-template-columns:repeat(4,1fr)}'];
    expect(kpiGridDeclarations(variant)).toEqual(['repeat(4,1fr)']);
  });
});
