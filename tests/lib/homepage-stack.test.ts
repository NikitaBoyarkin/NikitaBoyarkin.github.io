// Stack card vs /about#stack.
//
// The card mirrors the about page's stack section: the same groups, the same
// skills, in both locales. Nothing in the build ties the two together — edit
// one and the other silently drifts — so this file binds the relation. The
// chip check stays a *subset*: /about may list more than the card shows.
//
// Drift it catches: a chip on the card that names a skill the about page never
// declares, or a RU/EN card that stops matching its counterpart.
//
// The card moved from `pages/index.astro` into the shared `StackCard.astro`
// (the three role landings and the gate's colleague branch all render it), so the
// claim is retargeted, not dropped: the two locale chip lists are now the two
// branches of one file, split on its `stack:ru|en` markers.
import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const STACK_CARD = 'src/components/StackCard.astro';
const ABOUT = { ru: 'src/content/about/ru.mdx', en: 'src/content/about/en.mdx' } as const;
const LANGS = ['ru', 'en'] as const;
type Lang = (typeof LANGS)[number];

/** One locale's branch of the card, between its `stack:<lang>:start|end` markers. */
function branch(lang: Lang): string {
  const src = read(STACK_CARD);
  const from = src.indexOf(`stack:${lang}:start`);
  const to = src.indexOf(`stack:${lang}:end`);
  if (from === -1 || to === -1 || to < from) return '';
  return src.slice(from, to);
}

/**
 * The card renders the chip list as literal spans. The `[^<{]+` body match takes
 * the literals and skips interpolated ones, so no scoping to a parent element is
 * needed.
 */
function chipsIn(lang: Lang): string[] {
  return [...branch(lang).matchAll(/class="bento-chip">([^<{]+)<\/span>/g)].map((m) =>
    m[1].trim()
  );
}

function badgesIn(rel: string): string[] {
  return [...read(rel).matchAll(/class="skill-badge">([^<{]+)<\/span>/g)].map((m) =>
    m[1].trim()
  );
}

/**
 * One locale's group headings — the structural half of the parity claim. The
 * card renders each category as its own cell, so the heading is the card's
 * `bento-cell-title`; it used to be a `stack-group-name` span inside one cell.
 */
function groupsIn(lang: Lang): string[] {
  return [...branch(lang).matchAll(/class="bento-cell-title">([^<{]+)<\/h3>/g)].map((m) =>
    m[1].trim()
  );
}

/**
 * The chip labels /about#stack translates. The card mirrors /about label for
 * label, so the two branches differ by exactly these; comparing raw strings
 * would report them as drift.
 */
const LOCALISED: Record<string, string> = {
  визуализация: 'visualization',
  'когортный анализ': 'cohort analysis',
  'retention-кривые': 'retention curves',
};

describe('Stack card vs /about#stack', () => {
  it('extracts both lists — a parser that returned [] would make the rest vacuous', () => {
    for (const lang of LANGS) {
      expect(chipsIn(lang).length, `${lang}: card chips`).toBeGreaterThan(0);
      // The group parser is the one that fails silently: its only other use is
      // the count equality below, and [] === [] passes.
      expect(groupsIn(lang).length, `${lang}: card groups`).toBeGreaterThan(0);
      expect(badgesIn(ABOUT[lang]).length, `${lang}: about badges`).toBeGreaterThan(0);
    }
  });

  it('declares every card chip somewhere on /about#stack', () => {
    for (const lang of LANGS) {
      const badges = badgesIn(ABOUT[lang]);
      for (const chip of chipsIn(lang)) {
        expect(badges, `${lang}: chip "${chip}" is on the card but not on /about#stack`).toContain(
          chip
        );
      }
    }
  });

  it('keeps the two locale branches in step, allowing for the translated labels', () => {
    const ru = chipsIn('ru');
    const en = chipsIn('en');
    // Pin the map to the branches first: a renamed chip would otherwise leave
    // the comparison below passing while the pair quietly covered nothing.
    for (const [ruLabel, enLabel] of Object.entries(LOCALISED)) {
      expect(ru, `ru branch lost "${ruLabel}"`).toContain(ruLabel);
      expect(en, `en branch lost "${enLabel}"`).toContain(enLabel);
    }
    const normalise = (chips: string[]) =>
      [...new Set(chips.map((chip) => LOCALISED[chip] ?? chip))].sort();
    expect(normalise(ru)).toEqual(normalise(en));
    expect(groupsIn('ru').length, 'group count').toBe(groupsIn('en').length);
  });
});
