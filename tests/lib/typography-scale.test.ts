import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// REQ-008 — a page <h1> is never smaller than a section <h2>.
//
// The defect this binds: `.page-title` was a fixed `2rem` while the section
// heading token ran `clamp(1.9rem, 2.3vw, 2.4rem)`, so past ~1391px every
// section <h2> outgrew the page title. Typography is theme-invariant, so the
// fix is a pair of scale tokens and a single consolidated `h1` rule — nothing
// in this file touches a theme colour block.
//
// What fails when the claim stops being true:
//   - the page-title minimum drops to or below the section maximum (the
//     hierarchy inverts at some viewport)
//   - a second `h1 { font-size: … }` rule appears — split levels drift back
//     into the 8 ad-hoc rules REQ-008 counted
//   - `.page-title` goes back to a literal size instead of the level token
//
// Like brand.test.ts and demo-tokens.test.ts, the gate proves it bites: the
// mutation-control cases at the bottom must go red, so a green run means the
// parser really compared values.

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const STYLES: Record<string, string> = {
  'src/styles/global.css': read('src/styles/global.css'),
  'src/styles/blog.css': read('src/styles/blog.css'),
  'src/styles/prose.css': read('src/styles/prose.css'),
};
const GLOBAL = STYLES['src/styles/global.css'];

/** Drop comments so a commented-out declaration is not mistaken for one. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// The registered heading levels. `.page-title` / `.page-title`-level consumers
// take the first; section headings take the second. An `h1` is never a section,
// so the first list is the whole registry the h1-rule count is frozen against.
const HEADING_LEVELS = {
  'page-title': '--type-page-title',
  'section-h2': '--type-section-h2',
} as const;
const H1_LEVELS = ['page-title'] as const;

/**
 * min/max of a `clamp(min, …, max)` whose outer bounds are plain rem values.
 * A non-rem or calc() bound throws — the scale contract is two comparable
 * numbers, and a value the parser silently skipped would be a value the gate
 * cannot check.
 */
function clampBounds(css: string, token: string): { min: number; max: number } {
  const m = new RegExp(`${token}\\s*:\\s*clamp\\(([^)]*)\\)`).exec(stripComments(css));
  if (!m) throw new Error(`no clamp() for ${token}`);
  const parts = m[1].split(',').map((s) => s.trim());
  if (parts.length !== 3) throw new Error(`${token} clamp() must have three arguments`);
  const rem = (s: string): number => {
    const r = /^([\d.]+)rem$/.exec(s);
    if (!r) throw new Error(`${token} bound is not a plain rem value: ${s}`);
    return Number(r[1]);
  };
  return { min: rem(parts[0]), max: rem(parts[2]) };
}

/** Every `selector { body }` at any depth, at-rule wrappers included. */
function ruleFrames(src: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const stack: Array<{ selector: string; declStart: number }> = [];
  let selStart = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      const selector = src.slice(selStart, i).trim().split(/[};]/).pop()!.trim();
      stack.push({ selector, declStart: i + 1 });
      selStart = i + 1;
    } else if (ch === '}') {
      const frame = stack.pop();
      if (frame) out.push({ selector: frame.selector, body: src.slice(frame.declStart, i) });
      selStart = i + 1;
    }
  }
  return out;
}

/** Rules that set a font-size on a selector naming an `h1` element. */
function h1FontSizeRules(source: string): Array<{ selector: string; value: string }> {
  const found: Array<{ selector: string; value: string }> = [];
  for (const frame of ruleFrames(stripComments(source))) {
    if (frame.selector.startsWith('@')) continue;
    if (!/\bh1\b/.test(frame.selector)) continue;
    const m = /font-size\s*:\s*([^;]+)/.exec(frame.body);
    if (!m) continue;
    found.push({ selector: frame.selector, value: m[1].trim() });
  }
  return found;
}

/** The selectors of one rule, split on commas and whitespace-normalised. */
const selectorsOf = (selector: string): string[] =>
  selector
    .split(',')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

describe('heading scale (REQ-008)', () => {
  it('registers a page-title level whose minimum is strictly above the section maximum', () => {
    const page = clampBounds(GLOBAL, HEADING_LEVELS['page-title']);
    const section = clampBounds(GLOBAL, HEADING_LEVELS['section-h2']);
    expect(page.min).toBeGreaterThan(section.max);
  });

  it('declares both levels as tokens', () => {
    for (const token of Object.values(HEADING_LEVELS)) {
      expect(GLOBAL).toMatch(new RegExp(`${token}\\s*:`));
    }
  });

  it('resolves .page-title to the page-title level', () => {
    const rules = h1FontSizeRules(GLOBAL);
    const level = rules.find((r) => selectorsOf(r.selector).includes('.page-title'));
    expect(level, '.page-title must be carried by the single h1 rule').toBeDefined();
    expect(level!.value).toBe(`var(${HEADING_LEVELS['page-title']})`);
    // The blog block itself must not restate a size — that would shadow the level.
    const block = /\.page-title\s*\{([^}]*)\}/.exec(stripComments(STYLES['src/styles/blog.css']));
    expect(block).not.toBeNull();
    expect(block![1]).not.toContain('font-size');
  });

  it('freezes the number of h1 font-size rules at the level-registry size', () => {
    const rules = Object.values(STYLES).flatMap(h1FontSizeRules);
    expect(rules.length).toBeLessThanOrEqual(H1_LEVELS.length);
    for (const r of rules) {
      expect(r.value).toBe(`var(${HEADING_LEVELS[H1_LEVELS[0]]})`);
    }
  });

  it('bites when the page-title minimum drops below the section maximum', () => {
    const mutated = GLOBAL.replace(/(--type-page-title:\s*clamp\()2\.5rem/, '$12.2rem');
    expect(mutated).not.toBe(GLOBAL);
    const page = clampBounds(mutated, HEADING_LEVELS['page-title']);
    const section = clampBounds(mutated, HEADING_LEVELS['section-h2']);
    expect(page.min > section.max).toBe(false);
  });

  it('bites when an extra h1 rule creeps in', () => {
    const mutated = GLOBAL + '\nh1 { font-size: 5rem; }\n';
    expect(h1FontSizeRules(mutated).length).toBeGreaterThan(H1_LEVELS.length);
  });
});
