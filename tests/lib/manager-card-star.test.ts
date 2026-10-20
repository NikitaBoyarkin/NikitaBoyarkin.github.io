import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `/manager/` card describes a case as Task → Result.
//
// The defect this binds: the board card previewed the Result row alone
// (`StarBlock compact`), so on the one landing whose reader asks "what was
// asked, and what moved?" a number appeared with no brief in front of it — the
// reader had to open the case to find out what the number was even a result of.
// `/manager/` now previews Task + Result; `/projects/` and `/colleague/` keep the
// outcome-only teaser, because there the card is an index entry.
//
// What fails when the claim stops being true:
//   - `RoleLanding` stops passing `starPreview`, and every board silently falls
//     back to the Result row only
//   - the manager/colleague conditional collapses, so `/colleague/` and
//     `/projects/` grow a second row too
//   - `ProjectBoard` / `ProjectCard` drop the prop, and the value never reaches
//     `StarBlock`
//   - `StarBlock`'s `task-result` mapping loses `task`
//
// The rendered rows are asserted by the build (`tests/built`), not here.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const landing = read('src/components/RoleLanding.astro');
const board = read('src/components/ProjectBoard.astro');
const card = read('src/components/ProjectCard.astro');
const star = read('src/components/StarBlock.astro');
const lib = read('src/lib/projects.ts');

describe('manager landing — card previews Task + Result', () => {
  it('asks the manager board for the two-row teaser inline', () => {
    // The board is the manager's lane alone now, so the teaser is a literal on
    // the one call that renders it rather than a role-derived const.
    expect(landing).toMatch(/<ProjectBoard[\s\S]*?starPreview="task-result"/);
    expect(landing).toMatch(/\{role === 'manager' \? \(\s*<ProjectBoard/);
  });

  it('keeps the HR and colleague lanes off the board', () => {
    // Both read `ProjectList`; the manager is the only board (`data-track-filter`,
    // drag reorder). The two list lanes must not receive the teaser at all.
    expect(landing).toMatch(/\) : role === 'hr' \? \(\s*<ProjectList/);
    expect(landing).toMatch(/<ProjectList[\s\S]*?variant="summary"/);
    expect(landing).not.toMatch(/<ProjectList[^>]*starPreview/);
  });

  it('threads the prop board → card → block', () => {
    expect(board).toMatch(/starPreview\?: StarPreview;/);
    expect(board).toMatch(/starPreview = 'result'/);
    expect(board).toMatch(/starPreview=\{starPreview\}/);
    expect(card).toMatch(/starPreview\?: StarPreview;/);
    expect(card).toMatch(/<StarBlock star=\{star\} lang=\{lang\} compact preview=\{starPreview\} \/>/);
  });

  it('maps `task-result` to the task and result rows', () => {
    expect(lib).toMatch(/export type StarPreview = 'result' \| 'task-result' \| 'none';/);
    expect(star).toMatch(/'task-result': \['task', 'result'\],/);
    expect(star).toMatch(/result: \['result'\],/);
  });

  it('defaults to the outcome-only teaser everywhere else', () => {
    expect(star).toMatch(/preview = 'result'/);
    expect(card).toMatch(/starPreview = 'result'/);
    expect(board).toMatch(/starPreview = 'result'/);
  });
});
