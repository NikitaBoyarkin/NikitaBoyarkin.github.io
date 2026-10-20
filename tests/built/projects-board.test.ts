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
      expect(source.match(/class="project reveal compact"/g) ?? []).toHaveLength(22);
      // One cover image per card — the preview the catalogue is for.
      expect(source.match(/<img src="[^"]*images\/[^"]*"/g) ?? []).toHaveLength(22);
      // No Result / Task rows on this board; the case owns them.
      expect(source).not.toMatch(/data-star=/);
      expect(source).not.toContain('class="star star-compact"');
      // The body falls back to the description.
      expect(source).toContain('class="project-track-badge"');
    });
  }

  it('the manager board keeps its Task → Result cards and buys their width', () => {
    const source = readFileSync(resolve(DIST, 'manager/index.html'), 'utf8');
    expect(source).not.toContain('project-board-cover');
    expect(source.match(/data-star="result"/g) ?? []).toHaveLength(22);
    expect(source.match(/data-star="task"/g) ?? []).toHaveLength(22);
  });
});
