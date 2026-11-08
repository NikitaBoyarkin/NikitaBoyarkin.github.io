import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `/projects/` — the catalogue: cover on the card, no Result on it, one section
// per track.
//
// The defect this binds: the board's cards carried the STAR preview (one Result
// sentence) and, at ≥1140px, no cover at all — the CSS hid the image to buy width
// for that sentence. On the catalogue page that reads wrong: the reader is
// browsing the work, so the card should show the work (its cover) and stop
// asserting an outcome before anyone opened the case. The Result stays on
// `/manager/` (Task → Result) and on the project page itself.
//
// What fails when the claim stops being true:
//   - `/projects/` stops passing `grouped`, and the catalogue loses its track
//     headings (the Bases `groupBy` view it exists to mirror);
//   - it stops passing `starPreview="none"`, and every card grows a Result line;
//   - the `none` branch in `ProjectCard` loses its `description` fallback, and
//     the card body goes empty;
//   - `.project-grid` loses its stacked-cover rules, and the grid falls back to
//     the horizontal board card, whose cover clamp cannot fit a 360px column;
//   - a role landing inherits `grouped`, and its curated sequence is cut into
//     tracks it was never ordered by.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const RU = read('src/pages/projects/index.astro');
const EN = read('src/pages/en/projects/index.astro');
const BOARD = read('src/components/ProjectBoard.astro');
const CARD = read('src/components/ProjectCard.astro');
const STAR = read('src/components/StarBlock.astro');
const CSS = read('src/styles/global.css');

describe('/projects/ catalogue — cover on, Result off, grouped by track', () => {
  it('asks for the grouped board and no STAR preview, in both locales', () => {
    expect(RU).toMatch(/<ProjectBoard starPreview="none" grouped sphereFilter \/>/);
    expect(EN).toMatch(/<ProjectBoard[^>]*starPreview="none" grouped sphereFilter \/>/);
  });

  it('scopes grouping to the catalogue, never to a role landing', () => {
    expect(BOARD).toMatch(/grouped\?: boolean;/);
    expect(BOARD).toMatch(/const sections = grouped/);
    expect(BOARD).toMatch(/class="project-group"/);
    expect(BOARD).toMatch(/class="project-grid"/);
    // The role boards render the flat grid and must not turn grouping on.
    expect(read('src/components/RoleLanding.astro')).not.toMatch(/<ProjectBoard[\s\S]*?\bgrouped\b/);
    // `ProjectList` (the HR list) is a different component and stays a list.
    expect(read('src/components/ProjectList.astro')).not.toMatch(/\bgrouped=/);
  });

  it('renders the description when the preview is `none`', () => {
    expect(CARD).toMatch(/starPreview !== 'none' \? \(/);
    // The description stays plain: the card is a clamped three-line teaser, and
    // a figure span (bold, ≥18.75px) would push every line carrying one taller
    // than its neighbours and eat a line of copy. Figures in card prose were
    // tried on 2026-11-01 and reverted for exactly that reason.
    expect(CARD).toMatch(/\) : \(\s*<p title=\{description\}>\{description\}<\/p>/);
    expect(STAR).toMatch(/star && preview !== 'none' && \(/);
    expect(read('src/lib/projects.ts')).toMatch(
      /export type StarPreview = 'result' \| 'task-result' \| 'none';/,
    );
  });

  it('gives the grouped grid its own stacked-card recipe', () => {
    // The horizontal board card needs the full width for its 260–420px cover
    // clamp; a 360px grid column cannot give it one, so the cover moves on top.
    const grid = CSS.indexOf('.project-grid {');
    expect(grid).toBeGreaterThan(-1);
    const block = CSS.slice(grid, grid + 900);
    expect(block).toMatch(/grid-template-columns: repeat\(auto-fill/);
    expect(block).toMatch(/\.project-grid \.project\.compact \{\s*flex-direction: column;/);
    expect(block).toMatch(/\.project-grid \.project\.compact img \{\s*flex: none;\s*width: 100%;/);
    // The section heading is a group marker, not a new card style.
    expect(CSS).toMatch(/\.project-group-heading \{/);
    expect(CSS).toMatch(/\.project-group\.is-hidden \{\s*display: none;/);
    // The old single-row catalogue is gone — one rule would otherwise bring the
    // carousel back without its nav.
    expect(CSS).not.toContain('project-board-cover');
  });
});
