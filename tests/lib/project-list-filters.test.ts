import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The two list lanes (`/hr/` and `/colleague/`) carry the board's two filters:
// category tabs and tool chips.
//
// Why: `ProjectList` shipped with no filtering at all, so `/colleague/` could
// only be read top to bottom, and `/hr/` — the lane whose reader matches a
// vacancy's stack — had to scroll 22 rows past the cases it did not need. The
// filters are the board's own components (`ProjectTrackFilter`, `ProjectFilter`)
// and the board's own state contract (`#track-<key>` + `?tool=<key>`, one
// `projects_track_filter` event on a category click), so the two surfaces share
// one vocabulary instead of growing two.
//
// What fails when the claim stops being true:
//   - `filterable` is dropped from one lane, and that list is read-only again
//   - only the tabs are rendered, and the tool filter silently disappears
//   - rows stop carrying `data-track` / `data-tools`, and the script matches
//     nothing (its default state is "all visible", so the page looks fine while
//     every click does nothing)
//   - the disabled-chip guard goes, and a chip leads to an empty list
//   - a filtered-out year keeps its heading, and "2026" hangs over nothing
//
// The rendered markup is asserted by `tests/built/role-landing.test.ts`.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const landing = read('src/components/RoleLanding.astro');
const list = read('src/components/ProjectList.astro');

describe('project list — filter bar', () => {
  it('is opt-in, and both list lanes opt in', () => {
    expect(list).toMatch(/filterable\?: boolean;/);
    expect(list).toMatch(/filterable = false/);
    // HR
    expect(landing).toMatch(/\) : role === 'hr' \? \(\s*<ProjectList[\s\S]*?filterable/);
    // Colleague
    expect(landing).toMatch(/variant="summary"[\s\S]*?filterable/);
  });

  it('renders both filters, in the board’s own bar', () => {
    expect(list).toMatch(/import ProjectFilter from '\.\/ProjectFilter\.astro';/);
    expect(list).toMatch(/import ProjectTrackFilter from '\.\/ProjectTrackFilter\.astro';/);
    expect(list).toMatch(/<div class="project-filter-bar">[\s\S]*?<ProjectTrackFilter[\s\S]*?<ProjectFilter lang=\{lang\} \/>/);
  });

  it('counts the tabs over the rows the section renders', () => {
    expect(list).toMatch(/const visibleProjects = curated \?\? projects;/);
    expect(list).toMatch(/trackCounts\(\s*visibleProjects\.map/);
    expect(list).toMatch(/total=\{visibleProjects\.length\}/);
  });

  it('tags every row for both matchers', () => {
    expect(list).toMatch(/data-track=\{project\.data\.track\}/);
    expect(list).toMatch(/data-tools=\{project\.data\.tools\.join\(','\)\.toLowerCase\(\)\}/);
  });

  it('filters on category AND tool, and hides a year with its last row', () => {
    expect(list).toMatch(
      /const inTrack = activeTrack === ALL_TRACKS \|\| row\.dataset\.track === activeTrack;/,
    );
    expect(list).toMatch(/const ok = inTrack && matchesTool\(toolsOf\(row\), activeTool\);/);
    expect(list).toMatch(/group\.classList\.toggle\('is-hidden', !any\)/);
    expect(list).toMatch(
      /\.project-row\.is-hidden,\s*\n\s*\.project-year\.is-hidden \{\s*\n\s*display: none;/,
    );
  });

  it('disables a chip that cannot match inside the active category', () => {
    expect(list).toMatch(/emptyToolKeys\(\s*scope\.map/);
    expect(list).toMatch(/btn\.disabled = disabled;/);
    expect(list).toMatch(/key !== ALL_TOOLS && key !== activeTool && emptyKeys\.includes\(key\)/);
  });

  it('keeps the board’s URL and analytics contract', () => {
    // Same keys and the same event as `ProjectBoard.astro`: one filter is one
    // series in PostHog, whichever surface emitted it.
    expect(list).toMatch(/hash\.startsWith\('track-'\)/);
    expect(list).toMatch(/params\.set\('tool', nextTool\)/);
    expect(list).toMatch(/history\.pushState\(/);
    expect(list).toMatch(/history\.replaceState\(/);
    expect(list).toMatch(/track\('projects_track_filter', \{/);
    expect(list).toMatch(/results_count: visible/);
  });

  it('degrades to the full list without JS', () => {
    // Rows are server-rendered and the script only toggles a class: nothing is
    // built client-side, so a JS-off reader still sees every project.
    expect(list).not.toMatch(/createElement\('li'\)/);
    expect(list).toMatch(/aria-live="polite"/);
    expect(list).toMatch(/id="list-filter-empty"/);
  });
});
