// The three role landings, after the stack mosaic was removed from `/manager/`
// (2026-10-20).
//
// Why this exists: `RoleLanding.astro` renders one body for all three personas,
// so every difference between the lanes is a `role` condition inside one file —
// exactly the shape that regresses silently. The manager lane dropped
// `StackCard` (five category cards + its "Все проекты →" exit); a reverted or
// inverted condition would put the mosaic back on the one page whose reader came
// for impact, or take it off the two pages that still ask for it.
//
// Requires `bun run build` first (reads dist/*.html).
import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

const PAGES = [
  { file: 'manager/index.html', stack: false, lang: 'ru' },
  { file: 'en/manager/index.html', stack: false, lang: 'en' },
  { file: 'hr/index.html', stack: true, lang: 'ru' },
  { file: 'en/hr/index.html', stack: true, lang: 'en' },
  { file: 'colleague/index.html', stack: true, lang: 'ru' },
  { file: 'en/colleague/index.html', stack: true, lang: 'en' },
] as const;

const html = new Map<string, string>();

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const page of PAGES) {
    const path = resolve(DIST, page.file);
    if (!existsSync(path)) throw new Error(`built page missing: ${page.file}`);
    html.set(page.file, readFileSync(path, 'utf8'));
  }
});

/** The stack card's own exit link — present iff `StackCard` rendered. */
const STACK_EXIT = { ru: 'Все проекты →', en: 'All projects →' } as const;

describe('role landings — stack mosaic placement', () => {
  for (const page of PAGES) {
    const label = page.stack ? 'renders' : 'does not render';

    it(`${page.file} ${label} the stack card`, () => {
      const source = html.get(page.file)!;
      const exit = STACK_EXIT[page.lang];
      expect(source.includes(exit)).toBe(page.stack);
      // The chips are the card's body; both travel together.
      expect(source.includes('data-analytics="bento_stack"')).toBe(page.stack);
    });
  }

  it('the manager hero still carries the pitch and the board', () => {
    const source = html.get('manager/index.html')!;
    expect(source).toContain('class="hero-pitch"');
    expect(source).toContain('id="project-list"');
  });
});

// Colleague: a list of one-line descriptions, not the card grid. HR: the same
// list with the full STAR skeleton. Both are `ProjectList`, so the difference is
// per-row markup and the absence of year headings on the curated sequence.
describe('role landings — project section shape', () => {
  const rows = (source: string) => (source.match(/class="project-row"/g) ?? []).length;

  it('colleague reads a flat list: rows, descriptions, no board', () => {
    for (const file of ['colleague/index.html', 'en/colleague/index.html']) {
      const source = html.get(file)!;
      expect(source).not.toContain('id="project-list"');
      expect(rows(source)).toBe(26);
      expect(source).toContain('class="project-row-description"');
      // A curated order owns the sequence, so no year headings are printed.
      expect(source).not.toContain('class="project-year-heading"');
      // The four-row skeleton belongs to the HR lane.
      expect(source).not.toMatch(/data-star="situation"/);
    }
  });

  it('HR keeps the year groups and the full skeleton', () => {
    const source = html.get('hr/index.html')!;
    expect(source).toContain('class="project-year-heading"');
    expect(source).toMatch(/data-star="situation"/);
  });

  it('manager keeps the board, not the list', () => {
    const source = html.get('manager/index.html')!;
    expect(source).toContain('id="project-list"');
    expect(source).not.toContain('class="project-row-description"');
  });

  // The list lanes carry both filters: five category tabs (all + four tracks)
  // and six tool chips (all + five tools), with every row tagged for both
  // matchers. The manager keeps the board's own chips.
  it('both list lanes carry the category tabs and the tool chips', () => {
    for (const file of [
      'hr/index.html',
      'en/hr/index.html',
      'colleague/index.html',
      'en/colleague/index.html',
    ]) {
      const source = html.get(file)!;
      const tracks = source.match(/data-track-filter="[a-z]+"/g) ?? [];
      const tools = source.match(/data-tool-filter="[a-z]+"/g) ?? [];
      expect(tracks).toHaveLength(5);
      expect(tools).toHaveLength(6);
      expect(tracks[0]).toContain('all');
      expect(tools[0]).toContain('all');
      // Every row must be matchable by both filters.
      expect(source.match(/data-track="[a-z]+"/g) ?? []).toHaveLength(26);
      expect(source.match(/data-tools="/g) ?? []).toHaveLength(26);
      expect(source).toContain('id="list-filter-status"');
    }
  });

  it('manager keeps the board, with its own filter bar', () => {
    const source = html.get('manager/index.html')!;
    expect(source).toContain('id="project-list"');
    expect(source).not.toContain('data-project-list');
  });
});
