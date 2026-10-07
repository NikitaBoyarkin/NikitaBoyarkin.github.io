// Homepage «Стек» / «Stack» card vs /about#stack.
//
// The card is a condensed view of the about page's stack section: the card
// carries a subset of the same skills, grouped the same way, in both locales.
// Nothing in the build ties the two together — edit one and the other silently
// drifts — so this file binds the relation. It is deliberately a *subset*, not
// equality: /about may list more (AA-tests, pandas, RFM) than the card shows.
//
// Drift it catches: a chip on the homepage that names a skill the about page
// never declares, or a RU/EN card that stops matching its counterpart.
import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const PAGES = { ru: 'src/pages/index.astro', en: 'src/pages/en/index.astro' } as const;
const ABOUT = { ru: 'src/content/about/ru.mdx', en: 'src/content/about/en.mdx' } as const;
const LANGS = ['ru', 'en'] as const;
type Lang = (typeof LANGS)[number];

/**
 * The homepage renders two chip lists: the Stack card's literal chips and the
 * featured project's `tools`, which arrive as `{tool}` interpolation. The
 * `[^<{]+` body match takes the literal ones and skips the interpolated ones,
 * so no scoping to a parent element is needed.
 */
function chipsIn(rel: string): string[] {
  return [...read(rel).matchAll(/class="bento-chip">([^<{]+)<\/span>/g)].map((m) =>
    m[1].trim()
  );
}

function badgesIn(rel: string): string[] {
  return [...read(rel).matchAll(/class="skill-badge">([^<{]+)<\/span>/g)].map((m) =>
    m[1].trim()
  );
}

describe('homepage Stack card vs /about#stack', () => {
  it('extracts both lists — a parser that returned [] would make the rest vacuous', () => {
    for (const lang of LANGS) {
      expect(chipsIn(PAGES[lang]).length, `${lang}: homepage chips`).toBeGreaterThan(0);
      expect(badgesIn(ABOUT[lang]).length, `${lang}: about badges`).toBeGreaterThan(0);
    }
  });

  it('declares every homepage chip somewhere on /about#stack', () => {
    for (const lang of LANGS) {
      const badges = badgesIn(ABOUT[lang]);
      for (const chip of chipsIn(PAGES[lang])) {
        expect(badges, `${lang}: chip "${chip}" is on the homepage but not on /about#stack`).toContain(
          chip
        );
      }
    }
  });

  it('keeps the two locale cards on the same chip set', () => {
    const set = (lang: Lang) => [...new Set(chipsIn(PAGES[lang]))].sort();
    expect(set('ru')).toEqual(set('en'));
  });
});
