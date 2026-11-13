// Every catalog page and every role landing must end on a contact ask inside
// `<main>` — not only the footer, which a reader of a 22-card board never
// reaches. `NextStep` is the one component that carries that ask; this test
// pins the placements to the built HTML, so unmounting it on one lane (or
// losing the analytics surface) turns red here instead of going unnoticed.
//
// The homepage used to be asserted the same way: a tertiary «Оставить запрос»
// link under the hero CTAs, written in `HomeNewTab` rather than `NextStep`. It
// left on 2026-11-08 with the hero's proof card on the owner's call, so the
// homepage is deliberately absent here — its one primary ask is the Telegram
// button (`telegram_hero`, guarded by `tests/lib/persona.test.ts`), and the
// contact page stays reachable from the drawer and the footer on every page.
//
// Each assertion is scoped twice — to the `<main>` element and to the single
// anchor carrying the surface — because `data-analytics="contact_page_click"`
// and `href="/contact/"` are also emitted by the nav and footer on every page.
// A page-wide substring check would pass with the block deleted.
//
// Requires `bun run build` first.

import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

const PAGES = [
  { file: 'projects/index.html', surface: 'projects_index', contact: '/contact/' },
  { file: 'en/projects/index.html', surface: 'projects_index', contact: '/en/contact/' },
  { file: 'writing/index.html', surface: 'writing_index', contact: '/contact/' },
  { file: 'en/writing/index.html', surface: 'writing_index', contact: '/en/contact/' },
  { file: 'hire/hr/index.html', surface: 'role_hr_contact', contact: '/contact/' },
  { file: 'en/hire/hr/index.html', surface: 'role_hr_contact', contact: '/en/contact/' },
  { file: 'hire/manager/index.html', surface: 'role_manager_contact', contact: '/contact/' },
  { file: 'en/hire/manager/index.html', surface: 'role_manager_contact', contact: '/en/contact/' },
  { file: 'hire/colleague/index.html', surface: 'role_colleague_contact', contact: '/contact/' },
  { file: 'en/hire/colleague/index.html', surface: 'role_colleague_contact', contact: '/en/contact/' },
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

/** The main content of a built page, footer and nav excluded. */
function mainOf(source: string): string {
  const start = source.indexOf('<main');
  const end = source.indexOf('</main>');
  if (start === -1 || end === -1) throw new Error('page has no <main>');
  return source.slice(start, end);
}

/** The one `<a …>` carrying this placement, so the surface cannot be satisfied
    by one element and the href by another. */
function anchorWith(source: string, surface: string): string | undefined {
  return source
    .split('<a ')
    .find((chunk) => chunk.slice(0, chunk.indexOf('>')).includes(`data-analytics-surface="${surface}"`));
}

describe('contact ask inside <main> on catalog pages and role landings', () => {
  for (const page of PAGES) {
    it(`${page.file} carries the ${page.surface} contact ask`, () => {
      const anchor = anchorWith(mainOf(html.get(page.file)!), page.surface);
      expect(anchor).toBeDefined();
      expect(anchor).toContain(`href="${page.contact}"`);
      expect(anchor).toContain('data-analytics="contact_page_click"');
    });
  }
});
