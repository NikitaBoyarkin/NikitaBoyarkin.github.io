// `/projects/` — the catalogue board, as built.
//
// Requires `bun run build` first (reads dist/*.html).
import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');
const PAGES = ['projects/index.html', 'en/projects/index.html'] as const;
const html = new Map<string, string>();

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

describe('/projects/ board — built pages', () => {
  for (const page of PAGES) {
    it(`${page} renders a cover per card and no STAR rows`, () => {
      const source = html.get(page)!;
      expect(source).toContain('project-board-cover');
      expect(source.match(/class="project reveal compact"/g) ?? []).toHaveLength(24);
      // One cover image per card — the preview the catalogue is for.
      expect(source.match(/<img src="[^"]*images\/[^"]*"/g) ?? []).toHaveLength(24);
      // No Result / Task rows on this board; the case owns them.
      expect(source).not.toMatch(/data-star=/);
      expect(source).not.toContain('class="star star-compact"');
      // The body falls back to the description.
      expect(source).toContain('class="project-track-badge"');
    });
  }

  it('both catalogues carry the sphere facet and tag every card for it', () => {
    for (const page of PAGES) {
      const source = html.get(page)!;
      // `all` + six spheres; keys contain hyphens (`saas-product`).
      const chips = source.match(/data-sphere-filter="[a-z-]+"/g) ?? [];
      expect(chips).toHaveLength(7);
      expect(chips[0]).toContain('all');
      expect(source.match(/data-sphere="[a-z-]+"/g) ?? []).toHaveLength(24);
    }
  });

  it('offers newest-first on the catalogue only, keyed by the card date', () => {
    for (const page of PAGES) {
      const source = html.get(page)!;
      expect(source).toContain('id="board-sort"');
      expect(source).toMatch(/<option value="curated"/);
      expect(source).toMatch(/<option value="new"/);
      // The sort key is the rendered date, one per card.
      expect(source.match(/data-date="\d{4}-\d{2}-\d{2}"/g) ?? []).toHaveLength(24);
    }
    // A role landing is a curated reading sequence — it must not offer a sort.
    const manager = readFileSync(resolve(DIST, 'manager/index.html'), 'utf8');
    expect(manager).not.toContain('id="board-sort"');
  });

  it('keeps the sphere facet off the role landings', () => {
    // `/manager/` renders the same board; the facet is catalogue-only, and this
    // is what stops it leaking there on the next copy of the props.
    const source = readFileSync(resolve(DIST, 'manager/index.html'), 'utf8');
    expect(source).not.toContain('data-sphere-filter=');
  });

  it('the manager board keeps its Task → Result cards and buys their width', () => {
    const source = readFileSync(resolve(DIST, 'manager/index.html'), 'utf8');
    expect(source).not.toContain('project-board-cover');
    expect(source.match(/data-star="result"/g) ?? []).toHaveLength(24);
    expect(source.match(/data-star="task"/g) ?? []).toHaveLength(24);
  });
});
