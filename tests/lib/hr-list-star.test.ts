import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The HR list describes each project by its full STAR skeleton.
//
// The defect this binds: `/hr/` is the screening surface — a recruiter scans
// titles and dates, then judges the reasoning. Its rows rendered the single
// `description:` line while the manager/colleague boards already rendered
// STAR, so the one reader who needs Situation → Task → Actions → Result got
// the least of it. The row now renders the same four rows as the project page.
//
// What fails when the claim stops being true:
//   - the import or the conditional disappears, and the row silently falls back
//     to `description`
//   - the `compact` flag creeps in, which would render Result only (that is the
//     card preview, not the HR list)
//   - the measure cap is dropped, letting a value line run the full 1180px frame
//
// The rendered result (four rows per project in the built HTML) is asserted by
// the build itself, not here.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = readFileSync(join(ROOT, 'src/components/ProjectList.astro'), 'utf8');

describe('HR project list', () => {
  it('imports and renders the STAR block when the entry carries one', () => {
    expect(SOURCE).toContain("import StarBlock from './StarBlock.astro';");
    expect(SOURCE).toMatch(/variant === 'star' && project\.data\.star \? \(/);
    expect(SOURCE).toMatch(/<StarBlock star=\{project\.data\.star\} lang=\{lang\} \/>/);
  });

  it('keeps `description` as the fallback, and as the colleague row body', () => {
    expect(SOURCE).toMatch(/\) : \(\s*<p class="project-row-description">/);
    // `variant="summary"` (the colleague lane) skips the STAR branch entirely.
    expect(SOURCE).toMatch(/variant = 'star'/);
  });

  it('renders the full skeleton, not the card preview', () => {
    expect(SOURCE).not.toMatch(/<StarBlock[^>]*\bcompact\b/);
  });

  it('caps the block at the reading measure', () => {
    expect(SOURCE).toMatch(/\.project-row-star \{[^}]*max-width: 66ch;/);
  });
});
