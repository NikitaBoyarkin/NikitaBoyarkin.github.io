import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOW } from '../../src/lib/now';

// «Сейчас» is one list, rendered in two places: the /about/ tab and the same
// card inside the colleague landing's grid. (The homepage cell was removed on
// 2026-11-04 — `/` is the new-tab surface now.)
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

describe('«Сейчас» — one list, two surfaces', () => {
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

  it('lives on /about only — not on the hiring lanes, not on either homepage', () => {
    // The card's one surface is `/about`, mounted from the MDX (asserted above).
    // It came off `/` and `/en/` on 2026-11-04 (the homepage is the new-tab
    // surface) and off the colleague lane on 2026-11-16, when that lane dropped
    // its library/now cell along with the graph and the featured case — the
    // guard is here so neither removal can quietly revert.
    for (const file of [
      'src/components/RoleLanding.astro',
      'src/pages/index.astro',
      'src/pages/en/index.astro',
    ]) {
      expect(read(file), `${file} carries the now cell again`).not.toContain('<NowCard');
    }
  });
});
