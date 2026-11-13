// `/projects/` — the four-lens catalogue, as built.
//
// The page used to be one board. It now carries the owner's Bases file
// (`00 portfolio site.base`) as four lenses: cards by track (the board), cards
// on real data, the freshest twelve, and a table. Every lens is server-rendered
// and the three non-default ones ship `hidden`, so this file pins two things at
// once: the board still renders exactly as it did, and each extra lens renders
// its own content instead of being an empty shell filled by JS.
//
// Requires `bun run build` first (reads dist/*.html).
import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');
const PAGES = ['projects/index.html', 'en/projects/index.html'] as const;
const html = new Map<string, string>();

/** The markup of one lens: from its `data-panel` to the next panel's. */
function panel(source: string, key: string): string {
  const start = source.indexOf(`data-panel="${key}"`);
  if (start === -1) return '';
  const next = source.indexOf('data-panel="', start + 'data-panel="'.length);
  return source.slice(start, next === -1 ? undefined : next);
}

const count = (source: string, re: RegExp): number => source.match(re)?.length ?? 0;

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const page of PAGES) {
    const path = resolve(DIST, page);
    if (!existsSync(path)) throw new Error(`built page missing: ${page}`);
    html.set(page, readFileSync(path, 'utf8'));
  }
});

describe('/projects/ — four lenses', () => {
  for (const page of PAGES) {
    const en = page.startsWith('en/');

    it(`${page} renders four lens tabs and opens on the board`, () => {
      const source = html.get(page)!;
      const tabs = [...source.matchAll(/role="tab"[^>]*data-view="([a-z]+)"/g)].map((m) => m[1]);
      expect(tabs).toEqual(['tracks', 'real', 'fresh', 'table']);
      // The default lens is selected server-side, and the other three panels
      // are `hidden` in the markup — with JS off the page is the old board.
      expect(source).toMatch(/data-view="tracks" aria-controls="pview-panel-tracks" aria-selected="true"/);
      for (const key of ['real', 'fresh', 'table']) {
        expect(source).toContain(`data-panel="${key}" hidden`);
      }
      expect(source).not.toContain('data-panel="tracks" hidden');

      // The tablist ↔ panel wiring, both directions. Without this a renamed
      // panel id leaves the switch green while every tab points at nothing.
      for (const key of ['tracks', 'real', 'fresh', 'table']) {
        expect(source).toContain(`aria-controls="pview-panel-${key}"`);
        expect(source).toContain(`id="pview-panel-${key}"`);
        expect(source).toContain(`role="tabpanel" aria-labelledby="pview-tab-${key}"`);
        expect(source).toContain(`id="pview-tab-${key}"`);
      }

      // No dead controls without JS: the <noscript> block is what hides the
      // tablist, so the assertion is on the <noscript> wrapper, not on a string
      // that could equally live in the JS bundle.
      expect(source).toMatch(/<noscript><style>\.pview-bar\{display:none !important\}<\/style><\/noscript>/);
    });

    it(`${page} groups the board by track, cover on every card`, () => {
      const tracks = panel(html.get(page)!, 'tracks');
      // Four non-empty tracks, each a section with a visible heading — the
      // Bases `groupBy` made a page. An empty track must not render a heading.
      const groups = [...tracks.matchAll(/data-group="([a-z]+)"/g)].map((m) => m[1]);
      expect(groups).toEqual(['experiments', 'analytics', 'product', 'engineering']);
      expect(count(tracks, /class="project-group-heading"/g)).toBe(4);
      // The group heading is the h2 level: card titles are h3, so an h3 heading
      // would make every card a sibling of its own section. The board's extra
      // "Все проекты" h2 is dropped in grouped mode for the same reason.
      expect(count(tracks, /<h2[^>]*class="project-group-heading"/g)).toBe(4);
      expect(tracks).not.toContain('id="projects-heading"');
      // 6 + 15 + 3 + 7 — the taxonomy's bucket sizes, recomputed per build.
      const perGroup = groups.map((key) => {
        const from = tracks.indexOf(`data-group="${key}"`);
        const nextKeys = groups.slice(groups.indexOf(key) + 1);
        const to = nextKeys.length
          ? tracks.indexOf(`data-group="${nextKeys[0]}"`, from)
          : tracks.length;
        return count(tracks.slice(from, to), /class="project reveal compact"/g);
      });
      expect(perGroup).toEqual([6, 15, 3, 7]);
      expect(perGroup.reduce((a, b) => a + b, 0)).toBe(31);
      // One cover per card: the catalogue is a preview of the work.
      expect(count(tracks, /<img src="[^"]*images\/[^"]*"/g)).toBe(31);
      // No Result / Task rows on this board; the case owns them.
      expect(tracks).not.toMatch(/data-star=/);
      // The track is stated once per section, not on every card: the badge line
      // survives only where it carries something the heading cannot — the
      // provenance pill on the three real-data cases.
      expect(count(tracks, /class="project-track-badge"/g)).toBe(3);
      expect(count(tracks, /class="project-dataset-badge"/g)).toBe(3);
      expect(count(tracks, /data-track="[a-z]+"/g)).toBe(31);
      // The board's own controls moved with it, unchanged.
      expect(tracks).toContain('id="board-sort"');
      expect(tracks).toContain('data-track-filter=');
      // …and the carousel is gone: a grouped grid has no row to page through.
      expect(tracks).not.toContain('data-carousel="projects"');
      expect(tracks).not.toContain('carousel-nav');
    });

    it(`${page} renders exactly the real-data cases in the second lens`, () => {
      const real = panel(html.get(page)!, 'real');
      const slugs = [...real.matchAll(/data-slug="([a-z-]+)"/g)].map((m) => m[1]).sort();
      expect(slugs).toEqual(['gmv-drop-rca', 'oss-catalog', 'sql']);
      expect(count(real, /class="project reveal compact"/g)).toBe(3);

      // The badge claims "this number is not synthetic". If it ever rendered on
      // every card the claim dies silently, and if it rendered on none the two
      // strongest cases go back to being invisible — so the labels, not the
      // component source, are what this pins.
      const labels = [...real.matchAll(/class="project-dataset-badge">([^<]+)</g)].map((m) => m[1]);
      expect(labels).toHaveLength(3);
      expect(labels.filter((l) => l === (en ? 'Real data' : 'Реальные данные'))).toHaveLength(2);
      expect(labels).toContain(en ? 'Real + synthetic' : 'Реальные + синтетика');
    });

    it(`${page} renders the freshest twelve, newest first`, () => {
      const fresh = panel(html.get(page)!, 'fresh');
      const rows = [...fresh.matchAll(/data-slug="([a-z-]+)" data-updated="(\d{4}-\d{2}-\d{2})"/g)];
      expect(rows).toHaveLength(12);
      // Distinct cases: a project appears once in a "what changed lately" list.
      expect(new Set(rows.map((r) => r[1])).size).toBe(12);
      const dates = rows.map((r) => r[2]);
      const sorted = [...dates].sort().reverse();
      expect(dates).toEqual(sorted);
      // Each row links to its own case page.
      for (const [, slug] of rows) {
        expect(fresh).toContain(`${en ? 'en/' : ''}projects/${slug}/`);
      }
    });

    it(`${page} renders the catalogue as a table with the base's columns`, () => {
      const table = panel(html.get(page)!, 'table');
      const headers = [...table.matchAll(/<th scope="col"[^>]*>([^<]+)</g)].map((m) => m[1]);
      expect(headers).toEqual(
        en
          ? ['Case', 'Track', 'Data', 'Published', 'Updated', 'GitHub', 'Repository', 'Stack']
          : ['Кейс', 'Трек', 'Данные', 'Опубликован', 'Обновлён', 'GitHub', 'Репозиторий', 'Стек'],
      );
      // 31 cases → 31 body rows (the header row is the 32nd `<tr`).
      expect(count(table, /<tr[ >]/g)).toBe(32);
      // Every row's first cell is the case link, so the table is a second way
      // into the same pages rather than a dead export.
      expect(count(table, /data-analytics-surface="table"/g)).toBe(31);
      expect(count(table, /data-analytics-project="[a-z-]+"/g)).toBe(31);
      // Provenance and repository visibility survive as columns.
      expect(count(table, /class="project-dataset-badge"/g)).toBe(3);
      expect(count(table, new RegExp(en ? '>private<' : '>приватный<', 'g'))).toBe(4);
      // The overflow region is keyboard reachable.
      expect(table).toContain('role="region" tabindex="0"');
    });

    it(`${page} keeps the sphere facet on the board and tags every card`, () => {
      const source = html.get(page)!;
      const tracks = panel(source, 'tracks');
      // `all` + six spheres; keys contain hyphens (`saas-product`).
      const chips = tracks.match(/data-sphere-filter="[a-z-]+"/g) ?? [];
      expect(chips).toHaveLength(7);
      expect(chips[0]).toContain('all');
      // 31 on the board + the 3 duplicated real-data cards.
      expect(source.match(/data-sphere="[a-z-]+"/g) ?? []).toHaveLength(34);
      expect(source.match(/data-date="\d{4}-\d{2}-\d{2}"/g) ?? []).toHaveLength(34);
    });
  }
});

describe('/projects/ — role landings are not the catalogue', () => {
  it('the manager board keeps its Task → Result cards and buys their width', () => {
    const source = readFileSync(resolve(DIST, 'hire/manager/index.html'), 'utf8');
    // A role landing is one flat grid of a curated sequence — no track
    // headings, no catalogue sections.
    expect(source).toContain('project-track-grid');
    expect(source).not.toContain('project-group');
    // A role landing has no lens switch: it is a curated sequence, not a browse surface.
    expect(source).not.toContain('data-project-views');
    expect(source.match(/data-star="result"/g) ?? []).toHaveLength(31);
    expect(source.match(/data-star="task"/g) ?? []).toHaveLength(31);
    // …and no sort control, which the catalogue's board still carries.
    expect(source).not.toContain('id="board-sort"');
  });

  it('the sphere facet stays off the role landings', () => {
    const source = readFileSync(resolve(DIST, 'hire/manager/index.html'), 'utf8');
    expect(source).not.toContain('data-sphere-filter=');
  });
});
