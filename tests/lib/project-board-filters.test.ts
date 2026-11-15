import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The board carries the catalogue's two filters: category tabs and tool chips.
//
// Why: `/hr/` and `/manager/` are boards, and the HR reader matches a vacancy's
// stack, so a catalogue that could only be read top to bottom hid the cases that
// matched. The filters are the board's own components (`ProjectTrackFilter`,
// `ProjectFilter`) and the board's own state contract (`#track-<key>` +
// `?tool=<key>`, one `projects_track_filter` event on a category click).
//
// Retargeted 2026-11-16 from `ProjectList.astro`, which this file bound until the
// colleague lane left the catalogue for a section grid and the list lost its last
// caller. The claims are unchanged; only the surface they read moved to the
// component that still renders them.
//
// What fails when the claim stops being true:
//   - only the tabs are rendered, and the tool filter silently disappears
//   - cards stop carrying `data-track` / `data-tools`, and the script matches
//     nothing (its default state is "all visible", so the page looks fine while
//     every click does nothing)
//   - the disabled-chip guard goes, and a chip leads to an empty board
//   - a filtered-out year keeps its heading, and "2026" hangs over nothing
//
// The rendered markup is asserted by `tests/built/role-landing.test.ts`.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const BOARD = read('src/components/ProjectBoard.astro');
const CARD = read('src/components/ProjectCard.astro');

describe('project board — filter bar', () => {
  it('renders both filters, in the board’s own bar', () => {
    expect(BOARD).toMatch(/<div class="project-filter-bar">/);
    expect(BOARD).toMatch(/<ProjectTrackFilter lang=\{lang\} tracks=\{tracks\} total=\{projects\.length\} \/>/);
    expect(BOARD).toMatch(/<ProjectFilter lang=\{lang\} idPrefix=\{idPrefix\}>/);
  });

  it('counts the tabs over the cards the board renders', () => {
    expect(BOARD).toMatch(
      /const counts = trackCounts\(\s*projects\.map\(\(project\) => \(\{ track: project\.data\.track \}\)\),/,
    );
  });

  it('tags every card for both matchers', () => {
    expect(CARD).toMatch(/data-tools=\{\(tools \?\? \[\]\)\.join\(','\)\.toLowerCase\(\)\}/);
    expect(CARD).toMatch(/data-track=\{track\}/);
  });

  it('filters on category AND tool, and hides a year with its last card', () => {
    expect(BOARD).toMatch(
      /const inTrack = activeTrack === ALL_TRACKS \|\| card\.dataset\.track === activeTrack;/,
    );
    expect(BOARD).toMatch(/matchesTool\(toolsOf\(card\), activeTool\);/);
    expect(BOARD).toMatch(/group\.classList\.toggle\('is-hidden', !any\)/);
  });

  it('disables a chip that cannot match inside the active category', () => {
    expect(BOARD).toMatch(/emptyToolKeys\(/);
    expect(BOARD).toMatch(/btn\.setAttribute\('aria-disabled', String\(disabled\)\);/);
    expect(BOARD).toMatch(/key !== ALL_TOOLS && key !== activeTool && emptyKeys\.includes\(key\)/);
  });

  it('keeps the board’s URL and analytics contract', () => {
    // Same keys and the same event as the catalogue's other surfaces: one filter
    // is one series in PostHog, whichever surface emitted it.
    expect(BOARD).toMatch(/hash\.startsWith\('track-'\)/);
    expect(BOARD).toMatch(/params\.set\('tool', tool\)/);
    expect(BOARD).toMatch(/history\.pushState\(/);
    expect(BOARD).toMatch(/history\.replaceState\(/);
    expect(BOARD).toMatch(/track\('projects_track_filter', \{/);
    expect(BOARD).toMatch(/results_count: visible/);
  });

  it('degrades to the full board without JS', () => {
    // Cards are server-rendered and the script only toggles a class: nothing is
    // built client-side, so a JS-off reader still sees every project.
    expect(BOARD).not.toMatch(/createElement\('article'\)/);
    expect(BOARD).toMatch(/aria-live="polite"/);
    // The empty state is server-rendered too, behind its `data-*` hook.
    expect(BOARD).toMatch(/data-project-empty/);
  });
});
