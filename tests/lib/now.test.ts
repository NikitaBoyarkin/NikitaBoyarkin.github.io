import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOW } from '../../src/lib/now';

// «Сейчас» is one list, rendered in three places: the /about/ tab, the homepage
// bento card, and the same card inside the colleague landing's grid.
//
// Why this file exists: the five lines used to live as bullets in
// `src/content/about/{ru,en}.mdx`. The moment a card repeats them, the site has
// two "what is in progress" lists with nothing stopping them from diverging —
// and a stale "now" is worse than no "now", because it makes a currency claim
// the reader trusts. The rule: the array in `src/lib/now.ts` is the only copy,
// and every surface renders it.
//
// What fails when the claim stops being true:
//   - someone re-adds the bullets to the MDX beside the component (drift)
//   - `NowCard` grows an `items` prop, so a caller can pass its own list
//   - a mount point drops the card, and one surface silently loses "now"
//   - one locale loses an item, and the RU and EN cards disagree

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('«Сейчас» — one list, three surfaces', () => {
  it('carries both locales with the same number of items', () => {
    expect(NOW.ru.items.length).toBeGreaterThanOrEqual(3);
    expect(NOW.en.items.length).toBe(NOW.ru.items.length);
    for (const lang of ['ru', 'en'] as const) {
      expect(NOW[lang].updated).toMatch(/\d{4}$/);
      expect(NOW[lang].title.length).toBeGreaterThan(0);
      expect(NOW[lang].more.length).toBeGreaterThan(0);
      for (const item of NOW[lang].items) {
        expect(item.trim().length, `${lang}: empty item`).toBeGreaterThan(20);
      }
    }
  });

  it('is not re-listed in the about MDX beside the component', () => {
    // A distinctive fragment from each locale's list. If the bullets return to
    // the MDX, the card and the prose are two sources again.
    const fingerprints: Record<string, string> = {
      'src/content/about/ru.mdx': 'Развиваю этот сайт',
      'src/content/about/en.mdx': 'Building out this site',
    };
    for (const [file, needle] of Object.entries(fingerprints)) {
      const body = read(file);
      expect(body, `${file} renders the card`).toContain('<NowCard');
      expect(body, `${file} still hardcodes the list`).not.toContain(needle);
    }
  });

  it('takes the list from the module, not from a caller', () => {
    const card = read('src/components/NowCard.astro');
    // No `items` prop: the only inputs are the locale and the variant.
    expect(card).not.toMatch(/items\??:/);
    expect(card).toMatch(/from '\.\.\/lib\/now'/);
  });

  it('is mounted on the homepage, its EN twin, and the colleague landing', () => {
    for (const [file, lang] of [
      ['src/pages/index.astro', 'ru'],
      ['src/pages/en/index.astro', 'en'],
    ] as const) {
      const body = read(file);
      expect(body, `${file} lost the now card`).toContain('<NowCard');
      expect(body, `${file} passes the wrong locale`).toContain(`lang="${lang}"`);
    }
    // The colleague grid only — the HR and manager boards are catalogues, and a
    // "what I am working on" cell there would compete with the screening path.
    const landing = read('src/components/RoleLanding.astro');
    expect(landing).toContain('<NowCard lang={lang} variant="cell" />');
  });
});
