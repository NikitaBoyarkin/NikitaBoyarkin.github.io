// The homepage after the new-tab rework (2026-10-24).
//
// History: the canvas hero was retired on 2026-10-18 for `HeroGate` (three
// persona cards), and the gate was retired on 2026-10-24 in favour of a
// new-tab surface — a clock, a search field and shortcut chips. Each time this
// file moved with the surface rather than being deleted, because the homepage's
// real contract survived every rework: an `<h1>`, the persona landings still
// reachable, no one-screen lock, every internal link resolving. Deleting the
// file would have left all four unguarded.
//
// The bug the original file guarded still applies: the canvas fitted its world
// with a synchronous pre-paint `el.clientHeight` read, which returned 0 on this
// page and pushed the primary route above the fold. Built-HTML assertions cannot
// see computed layout, so this file guards the structural property instead — the
// hero is plain in-flow markup, not a canvas, and no dashboard band needs a
// measured fit.
//
// Requires `bun run build` first (reads dist/*.html).
import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

const PAGES = [
  { file: 'index.html', lang: 'ru', h1: 'Продуктовый аналитик' },
  { file: 'en/index.html', lang: 'en', h1: 'Product Analyst' },
] as const;

const html = new Map<string, string>();

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const p of PAGES) {
    const path = resolve(DIST, p.file);
    if (!existsSync(path)) throw new Error(`built page missing: ${p.file}`);
    html.set(p.file, readFileSync(path, 'utf8'));
  }
});

/**
 * The header contract for `/` and `/en/`: the one inline link, and the drawer's
 * full row set. Pinned literally because "the links go to the right pages" is
 * only checkable against an authority, and the nav array in `Base.astro` is
 * that authority — this is its built-output reflection.
 *
 * `/topics/` and `/repo-audit/` are RU-only route pairs: no `/en/` twin exists,
 * so both locales point at the one page rather than at a 404.
 */
const NAV = {
  ru: {
    inline: { href: '/', label: 'Главная' },
    drawer: [
      { href: '/', label: 'Главная' },
      { href: '/projects/', label: 'Проекты' },
      { href: '/about/', label: 'Обо мне' },
      { href: '/glossary/', label: 'Словарь' },
      { href: '/graph/', label: 'Граф' },
      { href: '/library/', label: 'Библиотека' },
      { href: '/writing/', label: 'Статьи' },
      { href: '/explorer/', label: 'Обозреватель' },
      { href: '/topics/', label: 'Темы' },
      { href: '/repo-audit/', label: 'Аудит репозиториев' },
    ],
  },
  en: {
    inline: { href: '/en/', label: 'Home' },
    drawer: [
      { href: '/en/', label: 'Home' },
      { href: '/en/projects/', label: 'Projects' },
      { href: '/en/about/', label: 'About' },
      { href: '/en/glossary/', label: 'Glossary' },
      { href: '/en/graph/', label: 'Graph' },
      { href: '/en/library/', label: 'Library' },
      { href: '/en/writing/', label: 'Writing' },
      { href: '/en/explorer/', label: 'Explorer' },
      { href: '/topics/', label: 'Topics' },
      { href: '/repo-audit/', label: 'Repo audit' },
    ],
  },
} as const;

/** The `<a>` rows of the list opened by `marker`, in document order. */
function rowsIn(source: string, marker: string) {
  const from = source.indexOf(marker);
  if (from < 0) return [];
  const block = source.slice(from, source.indexOf('</ul>', from));
  return [...block.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: m[1],
    label: m[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
    icon: /<svg/.test(m[2]),
  }));
}

/**
 * Internal hrefs on the page that do not resolve to a file in `dist/`.
 *
 * External (`https:`, `mailto:`) and same-page (`#…`) links are out of scope:
 * the first needs a network, the second is the browser's job. `/` resolves to
 * the page itself, so it is skipped rather than looked up.
 */
function unresolved(source: string): string[] {
  const out: string[] = [];
  for (const href of new Set([...source.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))) {
    if (/^(https?:|mailto:|tel:|data:|#)/.test(href)) continue;
    const rel = href.split('#')[0].split('?')[0].replace(/^\//, '');
    if (!rel) continue;
    const candidates = rel.endsWith('/')
      ? [join(DIST, rel, 'index.html')]
      : [join(DIST, rel), join(DIST, rel, 'index.html'), join(DIST, `${rel}.html`)];
    if (!candidates.some((p) => existsSync(p) && statSync(p).isFile())) out.push(href);
  }
  return out;
}

describe('homepage new tab (built HTML)', () => {
  for (const { file, lang, h1 } of PAGES) {
    const doc = () => html.get(file)!;

    it(`${file}: is not a canvas any more`, () => {
      const d = doc();
      expect(d, `${lang}: the canvas stage is back on the homepage`).not.toContain(
        'canvas-viewport',
      );
      expect(d, `${lang}: canvas layout nodes are back`).not.toContain('data-node="');
      // The 100dvh lock the canvas hero needed. Without the prop it cannot
      // apply, so the page scrolls and the dashboard is reachable.
      expect(d, `${lang}: the one-screen canvas lock is back`).not.toContain('canvas-fullbleed');
      // The fit artefacts: the inline transform vars and the zoom controls.
      expect(d, `${lang}: the canvas transform vars are back`).not.toContain('--vp-k');
      expect(d, `${lang}: the canvas zoom controls are back`).not.toContain('data-canvas-zoom');
    });

    it(`${file}: renders the new-tab surface, not the retired gate`, () => {
      const d = doc();
      expect(d, `${lang}: the new-tab section is missing`).toContain('class="newtab"');
      expect(d, `${lang}: the clock is missing`).toContain('id="nt-clock"');
      expect(d, `${lang}: the hero search field is missing`).toContain('id="nt-input"');
      expect(d, `${lang}: the gate section is back`).not.toContain('class="hero-gate"');
      expect(d, `${lang}: the gate cards are back`).not.toContain('data-source="gate"');
      expect(d, `${lang}: still rendering persona-gate`).not.toContain('class="persona-gate"');
    });

    it(`${file}: carries the heading as real text`, () => {
      const match = doc().match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      expect(match, `${file}: no <h1>`).not.toBeNull();
      expect(match![1]).toContain(h1);
    });

    it(`${file}: carries all three routes in the markup, not injected by script`, () => {
      const d = doc();
      for (const suffix of ['hr/', 'manager/', 'colleague/']) {
        expect(d, `${lang}: ${suffix}`).toContain(suffix);
      }
      expect(d, `${lang}: the retired booking button is back on the homepage`).not.toContain(
        'data-analytics="booking_click"',
      );
    });

    it(`${file}: the clock and the search sit above the shortcuts, and the h1 stays real text`, () => {
      const d = doc();
      const h1At = d.indexOf('<h1');
      expect(h1At, `${lang}: no <h1>`).toBeGreaterThan(-1);

      const clockAt = d.indexOf('id="nt-clock"');
      const searchAt = d.indexOf('id="nt-input"');
      const shortcutsAt = d.indexOf('class="nt-shortcuts"');
      expect(clockAt, `${lang}: no clock`).toBeGreaterThan(-1);
      expect(searchAt, `${lang}: no search field`).toBeGreaterThan(clockAt);
      expect(shortcutsAt, `${lang}: no shortcuts`).toBeGreaterThan(searchAt);

      // The site-wide tab strip is mounted by the layout on every page, the
      // homepage included; it renders empty and hidden until a second tab exists.
      expect(d, `${lang}: the tab strip is missing`).toContain('id="site-tabs"');
    });

    it(`${file}: the inline bar is the single «Главная»/«Home» link, with an icon`, () => {
      expect(rowsIn(doc(), 'class="nav-inline"')).toEqual([
        { ...NAV[lang].inline, icon: true },
      ]);
    });

    it(`${file}: the drawer carries every destination, each with an icon`, () => {
      const rows = rowsIn(doc(), 'id="nav-links"');
      expect(rows.map(({ href, label }) => ({ href, label }))).toEqual([...NAV[lang].drawer]);
      expect(rows.filter((row) => !row.icon), `${lang}: drawer rows without an icon`).toEqual([]);
    });

    it(`${file}: every internal link on the page resolves to a page in dist/`, () => {
      expect(unresolved(doc()), `${lang}: links pointing nowhere`).toEqual([]);
    });

    it(`${file}: carries no dashboard band any more`, () => {
      const d = doc();
      // The dashboard summary moved off `/` with the gate on 2026-10-24; the
      // Explorer surface is the browsable replacement. Guard the removal so the
      // band cannot quietly return without a scroll cue and its own contract.
      expect(d, `${lang}: the dashboard band is back`).not.toContain('id="dash"');
      expect(d, `${lang}: the scroll cue is back`).not.toContain('class="dash-cue"');
    });
  }
});

// Same Astro pitfall the retired canvas file guarded, and unrelated to the
// canvas itself: `:global()` is meaningful only inside a scoped component's
// <style>. In a directly-imported stylesheet the emitted selector is the literal
// `:global(…)`, which browsers drop as unparseable — so a theme override written
// that way never applies and no HTML assertion can see it. This reads the
// emitted CSS from disk and fails on the literal, naming the offending file.
it('emits no :global( left in any built stylesheet', () => {
  const astro = resolve(DIST, '_astro');
  expect(existsSync(astro), `${astro} missing — run \`bun run build\` first`).toBe(true);
  const cssFiles = readdirSync(astro).filter((f) => f.endsWith('.css'));
  expect(cssFiles.length, 'no CSS emitted under dist/_astro').toBeGreaterThan(0);
  const offenders = cssFiles.filter((f) => readFileSync(resolve(astro, f), 'utf8').includes(':global('));
  expect(
    offenders,
    `:global( survives into built CSS in: ${offenders.join(', ') || '(none)'}`,
  ).toEqual([]);
});
