// The homepage after the canvas hero was retired (2026-10-18).
//
// Why this file replaces `tests/built/canvas.test.ts`: that file asserted the
// canvas MARKUP on `/index.html` *and* PersonaCanvas's EMITTED scoped CSS. The
// canvas is no longer mounted on `/`, so Astro no longer emits that component's
// stylesheet and every one of those assertions lost its subject. Deleting them
// without a replacement would leave the homepage's real contract — an `<h1>`,
// three reachable routes, the dashboard below, no one-screen lock — unguarded.
//
// The bug this guards against: the canvas fitted its world with a synchronous
// pre-paint `el.clientHeight` read. On the dashboard homepage the hero band had
// no resolved block-size at that moment, so the read returned 0, zoom collapsed
// to `MIN_ZOOM` and the vertical offset resolved to `-270px` — the identity and
// the HR card rendered ABOVE the visible hero. Built-HTML string assertions
// cannot see computed layout, which is exactly why the old file stayed green
// while the page shipped broken. So this file does not try to assert a fit; it
// guards the structural property that makes the failure impossible — the gate
// is plain in-flow markup, not a canvas.
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

describe('homepage gate (built HTML)', () => {
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

    it(`${file}: renders the static gate, not the retired component`, () => {
      const d = doc();
      expect(d, `${lang}: the gate section is missing`).toContain('class="hero-gate"');
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

    it(`${file}: renders exactly three gate cards, each after the h1 and carrying an icon`, () => {
      const d = doc();
      // `data-source="gate"` is unique to the gate cards: the header persona
      // group writes `header` / `menu`, so the drawer copies cannot inflate it.
      const cards = d.split('data-source="gate"').length - 1;
      expect(cards, `${lang}: gate cards`).toBe(3);

      const h1At = d.indexOf('<h1');
      expect(h1At, `${lang}: no <h1>`).toBeGreaterThan(-1);
      for (const at of [...d.matchAll(/data-source="gate"/g)].map((m) => m.index!)) {
        expect(at, `${lang}: a gate card precedes the h1`).toBeGreaterThan(h1At);
      }

      // Every card carries a purpose icon and a trailing arrow ("all buttons
      // have icons"): three of each, from the frozen contract. Counted by the
      // attribute form — the bare class name also appears once in the page's
      // inlined scoped `<style>`, which is not a rendered icon.
      expect(d.split('class="gate-card-icon"').length - 1, `${lang}: card icons`).toBe(3);
      expect(d.split('class="gate-card-arrow"').length - 1, `${lang}: card arrows`).toBe(3);
    });

    it(`${file}: each gate card points at its own persona route, in this locale`, () => {
      const cards = [...doc().matchAll(/<a[^>]*class="gate-card"[^>]*>/g)].map((m) => ({
        persona: /data-persona="([^"]+)"/.exec(m[0])?.[1],
        href: /href="([^"]+)"/.exec(m[0])?.[1],
      }));
      const prefix = lang === 'en' ? '/en/' : '/';
      expect(cards).toEqual([
        { persona: 'hr', href: `${prefix}hr/` },
        { persona: 'manager', href: `${prefix}manager/` },
        { persona: 'colleague', href: `${prefix}colleague/` },
      ]);
    });

    it(`${file}: the inline bar is the single «Главная»/«Home» link, with an icon`, () => {
      expect(rowsIn(doc(), 'class="nav-inline"')).toEqual([
        { ...NAV[lang].inline, icon: true },
      ]);
    });

    it(`${file}: the drawer carries every destination, each with an icon`, () => {
      const rows = rowsIn(doc(), 'id="nav-links"');
      expect(rows.map(({ href, label }) => ({ href, label }))).toEqual(NAV[lang].drawer);
      expect(rows.filter((row) => !row.icon), `${lang}: drawer rows without an icon`).toEqual([]);
    });

    it(`${file}: every internal link on the page resolves to a page in dist/`, () => {
      expect(unresolved(doc()), `${lang}: links pointing nowhere`).toEqual([]);
    });

    it(`${file}: keeps the dashboard below the gate, and the cue pointing at it`, () => {
      const d = doc();
      expect(d, `${lang}: the dashboard section is missing`).toContain('id="dash"');
      expect(d, `${lang}: the scroll cue is missing`).toContain('class="dash-cue"');
      expect(d, `${lang}: the cue no longer targets the dashboard`).toContain('href="#dash"');
      const cueAt = d.indexOf('class="dash-cue"');
      const dashAt = d.indexOf('id="dash"');
      expect(cueAt, `${lang}: the cue sits after the gate`).toBeGreaterThan(
        d.indexOf('class="hero-gate"'),
      );
      expect(dashAt, `${lang}: the cue precedes the dashboard`).toBeGreaterThan(cueAt);
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
