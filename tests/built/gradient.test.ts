// The gradient family against the REAL built CSS (dist/_astro/*.css), not the
// source. Companion to tests/lib/gradient-tokens.test.ts.
//
// Why both exist: the lib test binds the family's maths and shape against
// src/styles/global.css — the text. That is the right home for the contrast
// sampling, but it cannot see a rule the build drops, rewrites, or reorders.
// docs/prd-gradient-family.md §9 records exactly that hole: the flat-collapse
// block under print / forced-colors / prefers-contrast was confirmed by hand in
// dist/_astro/Base.*.css and nothing enforced it. This file is the enforcement.
//
// What it does NOT prove: that the gradients look right. That is the browser
// pass (docs/prd-gradient-family.md §9, §10).
//
// Requires `bun run build` first.

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ASTRO_DIR = resolve(__dirname, '../../dist/_astro');

/** Every emitted stylesheet concatenated — the family must survive the union. */
function allBuiltCss(): string {
  if (!existsSync(ASTRO_DIR)) throw new Error('dist/_astro missing — run `bun run build` first');
  return readdirSync(ASTRO_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(resolve(ASTRO_DIR, f), 'utf8'))
    .join('\n');
}

/** The sheet(s) that actually carry the family. Astro hashes filenames per build. */
function familyCss(all: string): string {
  return readdirSync(ASTRO_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(resolve(ASTRO_DIR, f), 'utf8'))
    .filter((css) => css.includes('--gradient-hero'))
    .join('\n');
}

/**
 * Body of the at-rule whose header starts at `at`, brace-matched. The built
 * block nests `html:root{…}`, so a `[^}]*` regex would stop one level early —
 * which is precisely how the hand-checked assertion could pass on nothing.
 */
function bracedBody(css: string, at: number): string {
  const open = css.indexOf('{', at);
  if (open === -1) throw new Error('no opening brace after at-rule');
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('unbalanced braces in built CSS');
}

const COLLAPSE_HEADER = /@media\s+print\s*,\s*\(forced-colors:\s*active\)\s*,\s*\(prefers-contrast:\s*more\)\s*\{/;
const FAMILY = ['gradient-hero', 'gradient-surface', 'gradient-button', 'gradient-rule', 'gradient-page'];

/** The four application rules the family is allowed to drive. */
const APPLICATIONS = [
  { token: 'gradient-hero', note: '#intro::before' },
  { token: 'gradient-button', note: '.button' },
  { token: 'gradient-rule', note: '#projects h2::after' },
  { token: 'gradient-page', note: 'html' },
] as const;

let ALL = '';
let FAMILY_ONLY = '';
let COLLAPSE = '';

beforeAll(() => {
  ALL = allBuiltCss();
  FAMILY_ONLY = familyCss(ALL);
  const at = FAMILY_ONLY.search(COLLAPSE_HEADER);
  COLLAPSE = at === -1 ? '' : bracedBody(FAMILY_ONLY, at);
});

describe('gradient family in built CSS', () => {
  it('emits all five token definitions', () => {
    const missing = FAMILY.filter((name) => !new RegExp(`--${name}\\s*:`).test(FAMILY_ONLY));
    expect(missing).toEqual([]);
  });

  it('emits the per-theme overrides as composition only', () => {
    // :root at 88%, light at 94% (the shipped .persona-card precedent), cyberpunk
    // hero at 14%. If the build collapsed these, the theme would silently lose
    // its gentler ramp — the lib test would still be green on the source.
    expect(FAMILY_ONLY).toContain('var(--card-background) 94%');
    expect(FAMILY_ONLY).toContain('var(--text-accent) 14%');
    expect(FAMILY_ONLY).toContain('var(--card-background) 88%');
    expect(FAMILY_ONLY).toContain('var(--text-accent) 10%');
  });

  it('emits an application rule for every family member that drives a surface', () => {
    const missing = APPLICATIONS.filter(
      ({ token }) => !new RegExp(`background\\s*:\\s*var\\(--${token}\\)`).test(ALL),
    ).map(({ token, note }) => `${token} (${note})`);
    expect(missing).toEqual([]);
    // --gradient-surface drives two cards (.featured/.project) and .blog-card.
    const surfaces = ALL.match(/background\s*:\s*var\(--gradient-surface\)/g) ?? [];
    expect(surfaces.length).toBeGreaterThanOrEqual(3);
  });

  it('emits the flat-collapse block for print / forced-colors / prefers-contrast', () => {
    expect(COLLAPSE).not.toBe('');
    const missing = FAMILY.filter((name) => !new RegExp(`--${name}\\s*:`).test(COLLAPSE));
    expect(missing).toEqual([]);
    expect(COLLAPSE).toContain('--gradient-hero:none');
    expect(COLLAPSE).toContain('--gradient-surface:var(--card-background)');
  });

  it('keeps the collapse block out of the default cascade', () => {
    // The reset must live inside the at-rule, not leak into the base sheet:
    // `--gradient-hero:none` outside it would kill the hero in every theme.
    const beforeAtRule = FAMILY_ONLY.slice(0, FAMILY_ONLY.search(COLLAPSE_HEADER));
    expect(beforeAtRule).not.toContain('--gradient-hero:none');
  });
});

describe('the built gate bites', () => {
  it('goes red when the collapse block is dropped', () => {
    const mutated = FAMILY_ONLY.replace(COLLAPSE_HEADER, '@media print,');
    expect(mutated).not.toBe(FAMILY_ONLY);
    const at = mutated.search(COLLAPSE_HEADER);
    expect(at === -1 ? '' : bracedBody(mutated, at)).toBe('');
  });

  it('goes red when a token is reset without the others', () => {
    // Deleting one reset to "fix" a print artefact must not pass: the other
    // three would keep painting in a context that cannot render them.
    const mutated = FAMILY_ONLY.replace(COLLAPSE, COLLAPSE.replace(/--gradient-rule\s*:\s*[^;}]+;?/, ''));
    expect(mutated).not.toBe(FAMILY_ONLY);
    const at = mutated.search(COLLAPSE_HEADER);
    const body = at === -1 ? '' : bracedBody(mutated, at);
    expect(body).not.toContain('--gradient-rule:');
  });

  it('brace-matches past a nested close instead of stopping at it', () => {
    // Honest scope: in today's emitted block every token sits inside the nested
    // `html:root{…}`, so a naive slice-to-first-`}` happens to find them all.
    // This case is a guard on the helper, not on the content — it fails if the
    // body is ever truncated one level early, which is how a hand-checked
    // assertion can pass on nothing.
    const synthetic =
      '@media print,(forced-colors:active),(prefers-contrast:more){html:root{--a:1}--gradient-rule:none}';
    const at = synthetic.search(COLLAPSE_HEADER);
    expect(at).toBeGreaterThan(-1);

    const naiveOpen = synthetic.indexOf('{', at);
    const naive = synthetic.slice(naiveOpen + 1, synthetic.indexOf('}', naiveOpen + 1));
    expect(naive).not.toContain('--gradient-rule:none');

    const matched = bracedBody(synthetic, at);
    expect(matched).toContain('--gradient-rule:none');
    expect(matched).toContain('html:root{--a:1}');
  });
});
