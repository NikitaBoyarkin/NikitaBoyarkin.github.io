import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// One card recipe for every repeated card unit.
//
// The defect this binds: `.project`, `.blog-card`, `.dash-card` and
// `.gate-card` had drifted into two paddings (24px / 20px) and two radii
// (16px / 12px) with nothing behind either pair, so a reader moving from `/`
// to `/projects/` to `/writing/` met three card systems. Radius and padding now
// live once as `--card-padding` / `--card-radius`; this test is what stops the
// next card from inventing a fourth.
//
// What fails when the claim stops being true: a card goes back to a literal
// px/rem value, or the tokens stop being defined in `global.css` (the one sheet
// every page loads).

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Card units and the file each one is declared in. */
const UNITS: Array<[name: string, file: string, selector: string]> = [
  ['project card', 'src/styles/global.css', '.project {'],
  ['blog card', 'src/styles/blog.css', '.blog-card {'],
];

/** The body of the first `selector { … }` block, comments removed. */
function blockOf(css: string, selector: string): string {
  const clean = stripComments(css);
  const at = clean.indexOf(selector);
  if (at === -1) throw new Error(`no ${selector} block`);
  const open = clean.indexOf('{', at);
  const close = clean.indexOf('}', open);
  if (open === -1 || close === -1) throw new Error(`unterminated ${selector}`);
  return clean.slice(open + 1, close);
}

/** Padding and radius declared directly on a card block. */
function recipeOf(block: string): { padding?: string; radius?: string } {
  const padding = /(?:^|[;\s])padding:\s*([^;]+);/.exec(block);
  const radius = /(?:^|[;\s])border-radius:\s*([^;]+);/.exec(block);
  return { padding: padding?.[1].trim(), radius: radius?.[1].trim() };
}

const RECIPE = { padding: 'var(--card-padding)', radius: 'var(--card-radius)' };

describe('card recipe', () => {
  it('defines the two tokens once, in the sheet every page loads', () => {
    const global = stripComments(read('src/styles/global.css'));
    expect(global).toMatch(/--card-padding:\s*[\w()-]+;/);
    expect(global).toMatch(/--card-radius:\s*[\w()-]+;/);
    // Once, not per theme block: a per-theme override would be a fourth recipe.
    expect(global.match(/--card-padding:/g)).toHaveLength(1);
    expect(global.match(/--card-radius:/g)).toHaveLength(1);
  });

  for (const [name, file, selector] of UNITS) {
    it(`${name} takes the shared padding and radius`, () => {
      expect(recipeOf(blockOf(read(file), selector))).toEqual(RECIPE);
    });
  }

  it('bites: a literal value on a card is not the recipe', () => {
    // Mutation control — without it a green run could mean the parser found
    // nothing and compared two `undefined`s.
    expect(recipeOf('padding: 24px; border-radius: 16px;')).not.toEqual(RECIPE);
    expect(recipeOf('padding: var(--space-5); border-radius: var(--radius-lg);')).not.toEqual(
      RECIPE,
    );
  });
});
