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
