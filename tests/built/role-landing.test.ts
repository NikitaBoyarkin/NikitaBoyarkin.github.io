// The three role bodies, after they merged onto one page (2026-11-15).
//
// Why this exists: `RoleLanding.astro` renders one body for all three personas,
// so every difference between the lanes is a `role` condition inside one file —
// exactly the shape that regresses silently. The manager lane dropped
// `StackCard` (five category cards + its "Все проекты →" exit); a reverted or
// inverted condition would put the mosaic back on the body whose reader came for
// impact, or take it off the two that still ask for it.
//
// Until 2026-11-15 each lane was its own route (`/hire/{hr,manager,colleague}/`)
// and the whole page was the body. Now the three are `role="tabpanel"` sections of
// `dist/hire/index.html`, so every assertion below slices its panel first. The
// invariants are unchanged; only the way a body is located is.
//
// Requires `bun run build` first (reads dist/*.html).
import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

const PAGES = [
  { file: 'hire/index.html', lang: 'ru' },
  { file: 'en/hire/index.html', lang: 'en' },
] as const;

const ROLES = ['hr', 'manager', 'colleague'] as const;

const html = new Map<string, string>();

/**
 * One tab panel of a merged page: from its `data-role-panel="<key>"` anchor up to
 * the next panel, or to `</main>` for the last one — otherwise the colleague
 * slice would swallow the footer and every page-wide assertion would pass on it.
 */
function panelOf(source: string, key: string): string {
  const start = source.indexOf(`data-role-panel="${key}"`);
  if (start === -1) return '';
  const nextPanel = source.indexOf('data-role-panel="', start + 1);
  const mainEnd = source.indexOf('</main>', start);
  const end = nextPanel === -1 ? (mainEnd === -1 ? source.length : mainEnd) : nextPanel;
  return source.slice(start, end);
}

const panel = (file: string, key: string) => panelOf(html.get(file)!, key);

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

describe('hiring page — three bodies, one document', () => {
  for (const page of PAGES) {
    it(`${page.file} renders one panel per role`, () => {
      const source = html.get(page.file)!;
      for (const role of ROLES) {
        expect(panelOf(source, role), `missing the ${role} panel`).not.toBe('');
      }
      // A panel body is the persona body, not a stub: the tab strip points at it.
      expect(source).toContain('role="tablist"');
    });

    it(`${page.file} keeps every id unique across the three bodies`, () => {
      // The reason the panels are namespaced: an id is unique per document, and
      // three bodies would otherwise write `intro`, `projects`, `projects-heading`
      // and the filter status span three times each. A duplicate here is not a
      // cosmetic problem — the client controllers resolve their roots by id.
      const ids = html.get(page.file)!.match(/id="[^"]*"/g) ?? [];
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const id of ids) {
        if (seen.has(id)) duplicates.push(id);
        seen.add(id);
      }
      expect(duplicates, `duplicate ids in ${page.file}`).toEqual([]);
    });
  }

  it('namespaces the list ids per panel', () => {
    const source = html.get('hire/index.html')!;
    expect(source).toContain('id="hr-projects"');
    expect(source).toContain('id="manager-projects"');
    expect(source).toContain('id="colleague-projects"');
    expect(source).toContain('id="hr-project-filter-status"');
    expect(source).toContain('id="colleague-list-filter-empty"');
    expect(source).toContain('id="hr-project-list"');
    expect(source).toContain('id="manager-project-list"');
  });
});

describe('hiring page — stack mosaic placement', () => {
  for (const page of PAGES) {
    for (const role of ROLES) {
      const stack = role !== 'manager';
      const label = stack ? 'renders' : 'does not render';

      it(`${page.file} ${role} panel ${label} the stack card`, () => {
        const body = panel(page.file, role);
        expect(body.includes(STACK_EXIT[page.lang])).toBe(stack);
        // The chips are the card's body; both travel together.
        expect(body.includes('data-analytics="bento_stack"')).toBe(stack);
      });
    }
  }

  it('the manager hero still carries the pitch and the board', () => {
    const source = panel('hire/index.html', 'manager');
    expect(source).toContain('class="hero-pitch"');
    expect(source).toContain('id="manager-project-list"');
  });
});

// Colleague: a list of one-line descriptions. HR: a board, grouped by year, each
// card carrying the full STAR skeleton. The two lanes render different components
// (`ProjectList` vs `ProjectBoard`), so the difference is grouping axis, card
// markup and the teaser depth — not a `variant` flag.
describe('hiring page — project section shape', () => {
  const rows = (source: string) => (source.match(/class="project-row"/g) ?? []).length;
  const cards = (source: string) => (source.match(/class="project reveal compact"/g) ?? []).length;

  it('colleague reads a flat list: rows, descriptions, no board', () => {
    for (const page of PAGES) {
      const source = panel(page.file, 'colleague');
      expect(source).not.toContain('project-list"');
      expect(rows(source)).toBe(31);
      expect(source).toContain('class="project-row-description"');
      // A curated order owns the sequence, so no year headings are printed.
      expect(source).not.toContain('class="project-year-heading"');
      // The four-row skeleton belongs to the HR lane.
      expect(source).not.toMatch(/data-star="situation"/);
    }
  });

  // HR became a board on 2026-11-15: the recruiter's question ("does the reasoning
  // hold up?") is answered by the same four STAR rows, but on cards under year
  // headings, with the cover, the track badge and the filter bar the board owns.
  // Before that the lane was a chronological list: the year grouping now says
  // "what shipped when" once per group, and `ROLE_CURATION.hr` is membership only —
  // the year groups own the order, so the strength sequence is no longer visible.
  it('HR reads a board grouped by year, with the whole skeleton on every card', () => {
    for (const page of PAGES) {
      const source = panel(page.file, 'hr');
      const years = source.match(/class="project-group-heading">\s*(\d{4})/g) ?? [];
      expect(years.length).toBeGreaterThan(0);
      // Newest year first — `groupByYear` sorts the groups, not just the cards.
      const first = source.match(/class="project-group-heading">\s*(\d{4})/)?.[1];
      expect(Number(first)).toBeGreaterThanOrEqual(2024);
      // A board, not the list.
      expect(source).toContain('data-board-grid');
      expect(source).not.toContain('data-project-list');
      expect(cards(source)).toBe(31);
      // All four rows, every card.
      expect((source.match(/data-star="situation"/g) ?? [])).toHaveLength(31);
      expect((source.match(/data-star="result"/g) ?? [])).toHaveLength(31);
    }
  });

  it('manager keeps the board, not the list', () => {
    for (const page of PAGES) {
      const source = panel(page.file, 'manager');
      expect(source).toContain('id="manager-project-list"');
      expect(source).not.toContain('class="project-row-description"');
    }
  });

  // Both filtered lanes carry five category tabs (all + four tracks) and six tool
  // chips (all + five tools), with every item tagged for both matchers. The board
  // reports through `data-filter-status`, the list through `data-list-status` —
  // two controllers, one vocabulary.
  it('the colleague list and the HR board both carry the two filters', () => {
    for (const page of PAGES) {
      for (const [role, statusAttr] of [
        ['hr', 'data-filter-status'],
        ['colleague', 'data-list-status'],
      ] as const) {
        const source = panel(page.file, role);
        const tracks = source.match(/data-track-filter="[a-z]+"/g) ?? [];
        const tools = source.match(/data-tool-filter="[a-z]+"/g) ?? [];
        expect(tracks, `${page.file} ${role} lost its category tabs`).toHaveLength(5);
        expect(tools, `${page.file} ${role} lost its tool chips`).toHaveLength(6);
        expect(tracks[0]).toContain('all');
        expect(tools[0]).toContain('all');
        // Every card and every row must be matchable by both filters.
        expect(source.match(/data-track="[a-z]+"/g) ?? []).toHaveLength(31);
        expect(source.match(/data-tools="/g) ?? []).toHaveLength(31);
        expect(source).toContain(statusAttr);
      }
    }
  });

  it('manager keeps the board, with its own filter bar', () => {
    for (const page of PAGES) {
      const source = panel(page.file, 'manager');
      expect(source).toContain('id="manager-project-list"');
      expect(source).toContain('data-board-grid');
      expect(source).not.toContain('data-project-list');
    }
  });
});
