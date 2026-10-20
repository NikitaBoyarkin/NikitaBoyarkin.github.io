import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `/projects/` — the catalogue board: cover on the card, no Result on it.
//
// The defect this binds: the board's cards carried the STAR preview (one Result
// sentence) and, at ≥1140px, no cover at all — the CSS hid the image to buy width
// for that sentence. On the catalogue page that reads wrong: the reader is
// browsing the work, so the card should show the work (its cover) and stop
// asserting an outcome before anyone opened the case. The Result stays on
// `/manager/` (Task → Result) and on the project page itself.
//
// What fails when the claim stops being true:
//   - `/projects/` stops passing `cover`, and the covers vanish again on desktop
//   - it stops passing `starPreview="none"`, and every card grows a Result line
//   - the `none` branch in `ProjectCard` loses its `description` fallback, and
//     the card body goes empty
//   - the cover override is moved above the ≥1140px hide rule, so the two rules
//     tie on specificity and the hide wins on source order
//   - the manager board inherits the override, and its Task → Result cards lose
//     the width the STAR block needs

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const RU = read('src/pages/projects/index.astro');
const EN = read('src/pages/en/projects/index.astro');
const BOARD = read('src/components/ProjectBoard.astro');
const CARD = read('src/components/ProjectCard.astro');
const STAR = read('src/components/StarBlock.astro');
const CSS = read('src/styles/global.css');

describe('/projects/ board — cover on, Result off', () => {
  it('asks for the cover and for no STAR preview, in both locales', () => {
    expect(RU).toMatch(/<ProjectBoard starPreview="none" cover \/>/);
    expect(EN).toMatch(/<ProjectBoard[^>]*starPreview="none" cover \/>/);
  });

  it('scopes the cover override to the catalogue board', () => {
    expect(BOARD).toMatch(/cover\?: boolean;/);
    expect(BOARD).toMatch(
      /class:list=\{\['project-track-grid', cover && 'project-board-cover'\]\}/,
    );
    // The role boards must not turn it on.
    expect(read('src/components/RoleLanding.astro')).not.toMatch(/<ProjectBoard[\s\S]*?\bcover\b/);
  });

  it('renders the description when the preview is `none`', () => {
    expect(CARD).toMatch(/starPreview !== 'none' \? \(/);
    expect(CARD).toMatch(/\) : \(\s*<p>\{description\}<\/p>/);
    expect(STAR).toMatch(/star && preview !== 'none' && \(/);
    expect(read('src/lib/projects.ts')).toMatch(
      /export type StarPreview = 'result' \| 'task-result' \| 'none';/,
    );
  });

  it('keeps the cover visible where the boards hide it, after the hide rule', () => {
    // Below 1140px the cover already sits beside the body; only the two-column
    // branch needs an override. The block must come after the hide rule: the two
    // selectors tie on specificity, so source order is what decides.
    const hide = CSS.indexOf('#project-list.project-track-grid .project.compact img');
    const show = CSS.indexOf('#project-list.project-board-cover .project.compact img');
    expect(hide).toBeGreaterThan(-1);
    expect(show).toBeGreaterThan(hide);
    expect(CSS.slice(show, show + 260)).toMatch(/display: block;/);
    expect(CSS.slice(show, show + 260)).toMatch(/width: 100%;/);
    // …and the override lives inside the same ≥1140px breakpoint: the only
    // `@media` between that breakpoint and the selector is the one opening it.
    const media = CSS.lastIndexOf('@media (min-width: 1140px)', show);
    expect(media).toBeGreaterThan(-1);
    expect(CSS.slice(media, show).match(/@media/g) ?? []).toHaveLength(1);
  });
});
