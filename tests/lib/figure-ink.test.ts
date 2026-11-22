import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Binding for the one claim the figure ink rests on: `.figure` is declared once,
// and it is declared big enough to be large text. Both halves were true only by
// comment until 2026-11-01 — a second copy had appeared in `prose.css`, and the
// hero proof line applied the ink at 13px/400, where the light theme's 3.14:1
// misses the 4.5:1 normal-text floor. This test is what makes that regression
// fail loudly instead of shipping.

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, '..', '..', rel), 'utf8');

const GLOBAL = read('src/styles/global.css');
const PROSE = read('src/styles/prose.css');
const FIGURE_TEXT = read('src/components/FigureText.astro');

/**
 * The CSS a file actually ships. For `.astro` that is the `<style>` block only —
 * scanning the whole component once matched `span.figure ? <span class="figure">`
 * in the template and reported a rule that does not exist.
 */
const cssOf = (source: string) => {
  // `.astro` files start with a frontmatter fence; their shipped CSS is only
  // what sits in `<style>` blocks (none, for FigureText). A plain stylesheet is
  // scanned whole.
  const isAstro = source.startsWith('---');
  const css = isAstro
    ? [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
    : source;
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
};

// Any selector that targets `.figure`, whatever the prefix or list it sits in —
// `.figure`, `.prose .figure`, `.figure,` — so a re-introduced copy is found.
const RULES = /([^{}\n]*\.figure[^{}\n]*)\{([^}]*)\}/g;
const rulesIn = (source: string) =>
  [...cssOf(source).matchAll(RULES)].map((m) => ({ selector: m[1].trim(), body: m[2] }));

describe('figure ink: one declaration, at the large-text threshold', () => {
  it('declares .figure exactly once in global.css and nowhere else', () => {
    expect(rulesIn(GLOBAL)).toHaveLength(1);
    expect(rulesIn(PROSE), 'a second copy in prose.css drifts from the first').toHaveLength(0);
    expect(
      rulesIn(FIGURE_TEXT),
      'a scoped copy cannot reach mdast output and will drift',
    ).toHaveLength(0);
  });

  it('keeps the ink, the weight and the size floor together', () => {
    const [rule] = rulesIn(GLOBAL);
    expect(rule.selector).toBe('.figure');
    expect(rule.body).toContain('color: var(--text-accent-figure)');
    expect(rule.body).toContain('font-weight: 700');
    // 14pt bold = 18.66px; the rule must not fall under it, or the 3:1 large-text
    // claim stops applying and the ink fails the 4.5:1 floor on the indigo page.
    expect(rule.body).toContain('font-size: max(1em, 18.75px)');
  });

  it('takes the figure token, never the interactive accent', () => {
    const [rule] = rulesIn(GLOBAL);
    expect(rule.body).not.toContain('var(--text-accent)');
    expect(rule.body).not.toContain('--text-accent-hover');
  });

  it('bites when the rule is duplicated or shrunk', () => {
    const duplicated = `${GLOBAL}\n.figure { color: var(--text-accent-figure); }`;
    expect(rulesIn(duplicated)).toHaveLength(2);

    // The exact regression this guard exists for: a duplicate under a prefix.
    const proseCopy = '.prose .figure {\n  color: var(--text-accent-figure);\n}\n';
    expect(rulesIn(proseCopy), 'a `.prose .figure` copy must be found').toHaveLength(1);
    expect(rulesIn(`${GLOBAL}\n${proseCopy}`)).toHaveLength(2);

    // And a copy hidden in an .astro <style> block.
    const scopedCopy = `<style>\n.figure { color: var(--text-accent-figure); }\n</style>`;
    expect(rulesIn(scopedCopy)).toHaveLength(1);

    const shrunk = GLOBAL.replace(/font-size: max\(1em, 18\.75px\);/, 'font-size: 1em;');
    expect(shrunk).not.toBe(GLOBAL);
    expect(rulesIn(shrunk)[0].body).not.toContain('18.75px');
  });
});

// ---------------------------------------------------------------------------
// The same claim, for every *other* rule that paints with the figure ink.
// `.figure` is the documented home of that ink, but four components use it
// directly, and nothing bound their size until /projects/volta/ failed
// Lighthouse (run 44641509229): `.ps-value` resolved to 18.47px at 412px —
// 0.19px under 14pt — so it was judged as normal text and its 3.25:1 orange
// had to clear 4.5:1. A rule may not paint with this ink below the large-text
// floor, whatever its selector.
// ---------------------------------------------------------------------------

const FLOOR_PX = 18.66; // 14pt bold: WCAG's large-text threshold.
const INK_RULES = [
  'src/components/ProofStrip.astro',
  'src/components/about/ValueOffers.astro',
  'src/components/KeyFigures.astro',
  'src/components/GithubActivity.astro',
];

/** Every rule in a stylesheet, not just the ones matching `.figure`. */
const anyRulesIn = (source: string) =>
  [...cssOf(source).matchAll(/([^{}\n]*)\{([^}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));

/** Split a CSS function's arguments on top-level commas only. */
const args = (list: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
};

/** Smallest px a `font-size` declaration guarantees at any viewport. */
const sizeFloor = (declaration: string): number => {
  const floorOf = (expr: string): number => {
    const e = expr.trim();
    const max = e.match(/^max\(([\s\S]*)\)$/);
    if (max) return Math.max(...args(max[1]).map(floorOf));
    // clamp(MIN, PREFERRED, MAX): only the first argument is a guarantee.
    const clamp = e.match(/^clamp\(([\s\S]*)\)$/);
    if (clamp) return floorOf(args(clamp[1])[0]);
    const single = e.match(/^([\d.]+)(px|rem|em)$/);
    if (!single) return Number.NaN;
    const n = Number(single[1]);
    // `em` is resolved against the 16px root: the only rule using it here
    // (`.figure`) sits on that base, and its `max()` makes the floor explicit.
    return single[2] === 'px' ? n : n * 16;
  };
  const match = declaration.match(/font-size:\s*([^;]+);/);
  if (!match) return Number.NaN;
  // A bare value ends at the first token; a function must be read whole.
  const value = match[1].trim();
  return floorOf(/^(max|clamp)\(/.test(value) ? value : value.split(/\s+/)[0]);
};

// ---------------------------------------------------------------------------
// The same claim, for every *other* rule that paints with the figure ink.
// `.figure` is the documented home of that ink, but four components use it
// directly, and nothing bound their size until /projects/volta/ failed
// Lighthouse (run 44641509229): `.ps-value` resolved to 18.47px at 412px —
// 0.19px under 14pt — so it was judged as normal text and its 3.25:1 orange
// had to clear 4.5:1. A rule may not paint with this ink below the large-text
// floor, whatever its selector.
// ---------------------------------------------------------------------------
describe('figure ink: every rule that paints with it clears the size floor', () => {
  it('finds the component rules (a scan that finds nothing proves nothing)', () => {
    const painted = INK_RULES.flatMap((rel) =>
      anyRulesIn(read(rel)).filter((r) => r.body.includes('color: var(--text-accent-figure)')),
    );
    expect(painted.map((r) => r.selector)).toEqual([
      '.ps-value',
      '.value-metric b',
      '.kf-value',
      '.gh-stat-value',
    ]);
  });

  it('keeps each of them at or above 14pt bold', () => {
    for (const rel of INK_RULES) {
      const painted = anyRulesIn(read(rel)).filter((r) =>
        r.body.includes('color: var(--text-accent-figure)'),
      );
      for (const rule of painted) {
        expect(sizeFloor(rule.body), `${rel} ${rule.selector}`).toBeGreaterThanOrEqual(FLOOR_PX);
      }
    }
  });

  it('bites on the declaration that shipped 18.47px', () => {
    const before =
      '.ps-value { color: var(--text-accent-figure); font-size: clamp(1.15rem, 1rem + 0.6vw, 1.5rem); }';
    expect(sizeFloor(before)).toBeLessThan(FLOOR_PX);
    expect(sizeFloor(before)).toBeCloseTo(18.4, 1);

    const after =
      '.ps-value { color: var(--text-accent-figure); font-size: max(18.75px, clamp(1.15rem, 1rem + 0.6vw, 1.5rem)); }';
    expect(sizeFloor(after)).toBeGreaterThanOrEqual(FLOOR_PX);
  });
});
