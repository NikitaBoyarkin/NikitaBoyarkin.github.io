import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Binds the paragraph typography setting in `src/styles/prose.css` to a
 * mechanism.
 *
 * The setting under test: prose is ragged right (`text-align: left`), with no
 * first-line indent and no automatic hyphenation; paragraphs are separated by
 * an interval (`margin-block-start: 0.9em` on `.prose p + p`) instead of an
 * indent. This replaced the earlier justified block with a 1.5em first-line
 * indent.
 *
 * What fails when the claim stops being true:
 *  - `.prose p` goes back to `text-align: justify`
 *  - a non-zero `text-indent` is reintroduced on `.prose p`
 *  - `hyphens: auto` appears on any `.prose` rule
 *  - the interval token (`0.9em`) or the `1.6` line-height drifts
 *
 * Scope: the sweep reads rule *blocks* and only blocks whose selectors are
 * `.prose`-scoped, so a stray property elsewhere in the file (e.g. the
 * `text-align: left` on table cells) is never mistaken for the paragraph rule.
 *
 * Mutation control lives at the bottom: each case substitutes the old value
 * into an in-memory copy and asserts the same detector goes red. No file on
 * disk is touched.
 */

const ROOT = path.resolve(import.meta.dir, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const PROSE = 'src/styles/prose.css';

/** Comments are dropped so prose *about* a property is not a declaration. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

type Rule = { selector: string; body: string };

/** Every `selector { body }` at any depth, at-rule wrappers included. */
function ruleFrames(src: string): Rule[] {
  const out: Rule[] = [];
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

/** The selectors of one rule, split on commas and whitespace-normalised. */
const selectorsOf = (selector: string): string[] =>
  selector
    .split(',')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** Rules whose selector list touches `.prose` — the only ones this gate reads. */
function proseRules(css: string): Rule[] {
  return ruleFrames(stripComments(css)).filter(
    (r) => !r.selector.startsWith('@') && selectorsOf(r.selector).some((s) => s.startsWith('.prose')),
  );
}

/** The last declaration of `prop` in a rule body, or undefined. */
function decl(body: string, prop: string): string | undefined {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body);
  return m ? m[1].trim() : undefined;
}

/** A `text-indent` is "zero" only when it is a literal zero with an optional unit. */
const isZero = (value: string): boolean => /^[+-]?0(?:\.0+)?(?:[a-z%]+)?$/i.test(value.trim());

/** Rules that declare one exact selector (e.g. `.prose p`, not `.prose p + p`). */
const rulesFor = (rules: Rule[], selector: string): Rule[] =>
  rules.filter((r) => selectorsOf(r.selector).includes(selector));

/**
 * Every ragged-right violation across the `.prose` rule blocks. An empty list
 * is the contract; the mutation-control cases prove this list is not vacuous.
 */
function violations(css: string): string[] {
  const found: string[] = [];
  for (const rule of proseRules(css)) {
    const where = selectorsOf(rule.selector).join(', ');

    const align = decl(rule.body, 'text-align');
    if (align !== undefined && /^justify\b/i.test(align)) {
      found.push(`${where}: text-align: ${align}`);
    }

    const hyphens = decl(rule.body, 'hyphens');
    if (hyphens !== undefined && /^auto\b/i.test(hyphens)) {
      found.push(`${where}: hyphens: ${hyphens}`);
    }

    // The indent ban is scoped to the paragraph rule itself, not to any
    // `.prose` descendant that happens to take a `text-indent`.
    if (selectorsOf(rule.selector).includes('.prose p')) {
      const indent = decl(rule.body, 'text-indent');
      if (indent !== undefined && !isZero(indent)) {
        found.push(`.prose p: text-indent: ${indent}`);
      }
    }
  }
  return found;
}

describe('prose setting — ragged right, interval-spaced paragraphs', () => {
  const css = read(PROSE);
  const rules = proseRules(css);

  it('opens .prose p flush-left, un-hyphenated, with no indent', () => {
    const blocks = rulesFor(rules, '.prose p');
    expect(blocks.length, 'no .prose p rule found').toBeGreaterThan(0);
    for (const block of blocks) {
      expect(decl(block.body, 'text-align')).toBe('left');
      expect(decl(block.body, 'hyphens')).toBe('manual');
      expect(decl(block.body, 'text-wrap')).toBe('pretty');
      const indent = decl(block.body, 'text-indent');
      expect(indent, '.prose p must declare text-indent: 0').toBeDefined();
      expect(isZero(indent!), `.prose p text-indent is not zero: ${indent}`).toBe(true);
    }
  });

  it('runs .prose at line-height 1.6', () => {
    const blocks = rulesFor(rules, '.prose');
    expect(blocks.length, 'no .prose rule found').toBeGreaterThan(0);
    for (const block of blocks) {
      expect(decl(block.body, 'line-height')).toBe('1.6');
    }
  });

  it('separates paragraphs with a 0.9em interval', () => {
    const blocks = rulesFor(rules, '.prose p + p');
    expect(blocks.length, 'no .prose p + p rule found').toBeGreaterThan(0);
    for (const block of blocks) {
      expect(decl(block.body, 'margin-block-start')).toBe('0.9em');
    }
  });

  it('has no prose rule reintroducing justify, auto hyphenation, or an indent', () => {
    expect(violations(css)).toEqual([]);
  });
});

describe('mutation control — the gate bites', () => {
  const css = read(PROSE);

  it('flags justify reintroduced only in the .prose p block', () => {
    const mutated = css.replace(/(\.prose p\s*\{[^}]*?text-align:\s*)left/, '$1justify');
    expect(mutated, 'mutation did not apply — the .prose p rule changed shape').not.toBe(css);
    expect(violations(mutated)).toContain('.prose p: text-align: justify');
  });

  it('flags a non-zero text-indent reintroduced on .prose p', () => {
    const mutated = css.replace(/(\.prose p\s*\{[^}]*?)text-indent:\s*0\b/, '$1text-indent: 1.5em');
    expect(mutated, 'mutation did not apply').not.toBe(css);
    expect(violations(mutated)).toContain('.prose p: text-indent: 1.5em');
  });

  it('flags hyphens: auto reappearing on .prose p', () => {
    const mutated = css.replace(/(\.prose p\s*\{[^}]*?)hyphens:\s*manual/, '$1hyphens: auto');
    expect(mutated, 'mutation did not apply').not.toBe(css);
    expect(violations(mutated)).toContain('.prose p: hyphens: auto');
  });

  it('flags a drifted line-height on .prose', () => {
    const mutated = css.replace(/(\.prose\s*\{[^}]*?line-height:\s*)1\.6/, '$11.8');
    expect(mutated, 'mutation did not apply').not.toBe(css);
    const block = rulesFor(proseRules(mutated), '.prose')[0];
    expect(decl(block.body, 'line-height')).not.toBe('1.6');
  });

  it('flags a lost or drifted paragraph interval', () => {
    const mutated = css.replace(/(\.prose p \+ p\s*\{[^}]*?margin-block-start:\s*)0\.9em/, '$10');
    expect(mutated, 'mutation did not apply').not.toBe(css);
    const block = rulesFor(proseRules(mutated), '.prose p + p')[0];
    expect(decl(block.body, 'margin-block-start')).not.toBe('0.9em');
  });
});
