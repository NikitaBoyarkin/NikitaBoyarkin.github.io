import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { CREAM_SURFACE } from '../../src/lib/brand';

// Cream-regime ratchet for the hand-authored hero illustrations
// (design-plans/cream-image-regime.md).
//
// Why this exists: the 22 covers are the one image set no generator owns and no
// contrast gate covered — `DESIGN.md` explicitly leaves their hexes alone as
// "illustration tint". That is still true for *which* hue they use; it is not
// true for legibility. The old set was light-on-dark, so a surface flip alone
// would have produced 1.0–2.6:1 text. This test pins the measured palette:
//
//   - the picture surface is CREAM_SURFACE (#f8f2d8);
//   - every <text> carries an explicit ink from the allowlist;
//   - no label is smaller than 22 units (≈7px at board-card width — already the
//     floor of readable);
//   - none of the retired dark-set hexes survives anywhere in the file.
//
// It bites: mutating any one fill to a retired ink turns the suite red.

const here = dirname(fileURLToPath(import.meta.url));
const IMAGES = join(here, '..', '..', 'public', 'images');

/** The only inks allowed on the cream picture surface. Ratios in the design plan. */
const ALLOWED_TEXT_INK = new Set([
  '#0f2a2b', // primary ink — 13.48:1
  '#4a6b69', // muted ink — 5.19:1
  '#a8331a', // accent ink — 5.92:1
  '#8c2c15', // accent ink, strong — 7.51:1
]);

/** Retired dark-regime hexes: light-on-dark inks that vanish on cream. */
const BANNED = [
  '#e4e4e7',
  '#a1a1aa',
  '#c9d6d5',
  '#8aa3a2',
  '#5f7a79',
  '#e4c9c9',
  '#ffffff',
  '#ff4b4b',
];

const FLOOR = 22;

const svgs = readdirSync(IMAGES).filter((f) => f.endsWith('.svg'));

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? m[1].toLowerCase() : null;
};

describe('hero illustrations hold the cream regime', () => {
  it('covers every hero SVG in public/images', () => {
    expect(svgs.length).toBe(23);
  });

  for (const file of svgs) {
    const src = readFileSync(join(IMAGES, file), 'utf8');

    it(`${file}: paints the cream surface`, () => {
      const fullBleed = [...src.matchAll(/<rect\b[^>]*>/g)]
        .map((m) => m[0])
        .filter((t) => attr(t, 'width') === '1200' && attr(t, 'height') === '600');
      expect(fullBleed.length).toBeGreaterThan(0);
      expect(attr(fullBleed[0], 'fill')).toBe(CREAM_SURFACE);
    });

    it(`${file}: every text node declares an allowed ink`, () => {
      const texts = [...src.matchAll(/<text\b[^>]*>/g)].map((m) => m[0]);
      expect(texts.length).toBeGreaterThan(0);
      const bad = texts
        .map((t) => ({ tag: t, fill: attr(t, 'fill') }))
        .filter(({ fill }) => !fill || !ALLOWED_TEXT_INK.has(fill));
      expect(bad.map((b) => b.fill ?? 'none')).toEqual([]);
    });

    it(`${file}: no label below the ${FLOOR} unit floor`, () => {
      const sizes = [...src.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(FLOOR);
    });

    it(`${file}: no retired dark-regime hex survives`, () => {
      const lower = src.toLowerCase();
      expect(BANNED.filter((hex) => lower.includes(hex))).toEqual([]);
    });
  }
});
