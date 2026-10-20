import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// One body size outside `.prose`.
//
// The defect this binds: DESIGN.md has said «Prose size is `1.05rem` (16.8px)
// wherever prose appears — body paragraphs, list items, quotes, card
// descriptions. One role, one size» since the editorial pass, but nothing
// measured it. Seven literal sizes (0.85 / 0.9 / 0.92 / 0.9375 / 0.95 / 0.98rem)
// had drifted into roles that carry full sentences — card descriptions, chart
// takeaways, career bullets, consent copy — so the same prose role read at
// 13.6px on `/contact/` and 16.8px on a project page.
//
// The fix is one token, `--text-body`, declared once in `global.css` (the sheet
// every page loads) and consumed by every prose role outside the Markdown layer.
// `.prose` keeps `--prose-size`, which is the same value by a different name:
// the measure in `prose.css` is a `ch` value and must resolve against the
// element that carries it.
//
// What fails when the claim stops being true:
//   - the token is removed, duplicated per theme, or changes value
//   - a role in the list goes back to a literal rem size
//   - the compact STAR card reintroduces a two-line clamp (the defect that hid
//     47% of every value on a phone)
//
// Mutation control at the bottom proves the parser compares real declarations.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Body of the first rule whose selector *starts* with `selector`, comments
 * removed. Anchoring to the start of the selector list matters: the same class
 * also appears inside descendant rules (`.search-result a:hover .search-result-desc`),
 * and a plain `indexOf` would read that rule instead of the base one.
 */
function blockOf(source: string, selector: string): string {
  const clean = stripComments(source);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|[\\n}])\\s*${escaped}\\s*\\{`).exec(clean);
  if (!m) throw new Error(`no ${selector} block`);
  const open = clean.indexOf('{', m.index);
  const close = clean.indexOf('}', open);
  if (open === -1 || close === -1) throw new Error(`unterminated ${selector}`);
  return clean.slice(open + 1, close);
}

/** Prose roles outside `.prose` — sentences, not labels. */
const ROLES: Array<[file: string, selector: string]> = [
  ['src/styles/global.css', '.bento-cell-text'],
  ['src/styles/global.css', '.featured-card-description'],
  ['src/styles/global.css', '.project p'],
  ['src/styles/global.css', '.search-result-desc'],
  ['src/styles/global.css', '.graph-legend-item dd'],
  ['src/styles/blog.css', '.blog-card-excerpt'],
  ['src/styles/blog.css', '.contact-note'],
  ['src/styles/dashboard.css', '.dash-card-desc'],
  ['src/components/HeroGate.astro', '.gate-card-blurb'],
  ['src/components/PersonaCanvas.astro', '.persona-card-blurb'],
  ['src/components/CareerSnapshot.astro', '.career-sub'],
  ['src/components/CareerSnapshot.astro', '.career-list li'],
  ['src/components/ProofBand.astro', '.proof-step-text'],
  ['src/components/charts/ChartCard.astro', '.chart-description'],
  ['src/components/charts/ChartCard.astro', '.chart-conclusions li'],
  ['src/components/ProjectList.astro', '.project-row-description'],
  ['src/components/ExplorerApp.astro', '.xp-item > a > p'],
  ['src/pages/glossary/index.astro', '.term-blurb'],
  ['src/pages/en/glossary/index.astro', '.term-blurb'],
  ['src/pages/topics/index.astro', '.topic-blurb'],
  ['src/pages/projects/index.astro', '.headline-strip-desc'],
];

describe('body type scale', () => {
  it('declares --text-body once, in the sheet every page loads', () => {
    const global = stripComments(read('src/styles/global.css'));
    expect(global).toMatch(/--text-body:\s*1\.05rem;/);
    // Once, not per theme: a per-theme body size would be a second type scale.
    expect(global.match(/--text-body:/g)).toHaveLength(1);
  });

  it.each(ROLES)('%s — %s takes the body size', (file, selector) => {
    const block = blockOf(read(file), selector);
    expect(block).toContain('font-size: var(--text-body)');
  });

  it('previews STAR rows on cards, and never clamps them', () => {
    // The card is a teaser, not a dossier: `compact` keeps a subset of the four
    // rows (`result` alone by default, `task-result` on `/manager/`), so the
    // surviving sentences must not be truncated either.
    const star = read('src/components/StarBlock.astro');
    expect(star).toContain("const keys = compact && preview !== 'none' ? PREVIEW_KEYS[preview] : KEYS;");
    expect(star).toContain('const PREVIEW_KEYS: Record<Exclude<StarPreview');

    const block = blockOf(read('src/styles/global.css'), '.star-compact .star-value');
    expect(block).not.toContain('-webkit-line-clamp');
    expect(block).not.toContain('overflow: hidden');
  });

  it('bites: a literal size is not the body token', () => {
    expect(blockOf('.x { font-size: 0.92rem; }', '.x')).not.toContain(
      'font-size: var(--text-body)',
    );
    expect(blockOf('.x { font-size: var(--text-body); }', '.x')).toContain(
      'font-size: var(--text-body)',
    );
  });
});
