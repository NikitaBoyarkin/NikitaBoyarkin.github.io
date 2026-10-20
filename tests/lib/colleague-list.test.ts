import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `/colleague/` reads the catalogue as a flat list with one description line per
// project.
//
// What changed and why: the colleague lane rendered the track-grouped card grid
// (`ProjectBoard`), so a reader who came for the method met 22 cards whose body
// was a single Result sentence plus filter chips — the same shape as the manager
// lane, minus the reasoning. The colleague now reads `ProjectList` in
// `variant="summary"`: one row per project, the curated method-first order
// (`ROLE_CURATION.colleague`), each row a title, a track badge, the
// `description:` line and four tools.
//
// What fails when the claim stops being true:
//   - the lane falls back to `ProjectBoard`, and the filters/cards return
//   - `variant="summary"` disappears, and every row grows the four-row STAR
//     skeleton it was meant to replace
//   - `order` disappears, and the method-first angle quietly becomes the
//     chronological order HR already reads
//   - the flat branch re-grows a year `<h3>`, which would print 2026/2025 over a
//     sequence that is deliberately not chronological
//
// The rendered page is asserted by the build (`tests/built/role-landing.test.ts`).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const landing = read('src/components/RoleLanding.astro');
const list = read('src/components/ProjectList.astro');

describe('colleague landing — project list', () => {
  it('renders the list, not the board, on the colleague lane', () => {
    expect(landing).toMatch(/\) : \(\s*<ProjectList/);
    expect(landing).toMatch(/<ProjectList[\s\S]*?variant="summary"[\s\S]*?order=\{ROLE_CURATION\.colleague\}/);
    expect(landing).toMatch(/\{role === 'manager' \? \(\s*<ProjectBoard/);
  });

  it('keeps the manager on the board and HR on the full skeleton', () => {
    expect(landing).toMatch(/\) : role === 'hr' \? \(\s*<ProjectList\s+collection=/);
    expect(landing).not.toMatch(/<ProjectList[\s\S]{0,200}?variant="star"/);
  });

  it('drops the STAR branch in the summary variant', () => {
    expect(list).toMatch(/variant = 'star'/);
    expect(list).toMatch(/variant === 'star' && project\.data\.star \? \(/);
    expect(list).toMatch(/\) : \(\s*<p class="project-row-description">\{project\.data\.description\}<\/p>/);
  });

  it('flattens the curated order instead of grouping it by year', () => {
    expect(list).toMatch(/order\?: readonly string\[\];/);
    expect(list).toMatch(/const curated = order/);
    expect(list).toMatch(/curated\s*\? \[\{ year: null, inYear: curated \}\]/);
    // A flat list has no year <h3>: `year === null` suppresses it.
    expect(list).toMatch(/\{year !== null && \(/);
    // …and its rows step up to h3 so the outline does not skip a level.
    expect(list).toMatch(/const RowHeading = year === null \? 'h3' : 'h4';/);
  });
});
