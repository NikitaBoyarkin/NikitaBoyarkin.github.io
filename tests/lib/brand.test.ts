import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ACCENT_ON_BLUE,
  ACCENT_ON_TEAL,
  ACCENT_ON_TEAL_LIGHT,
  CREAM,
  type BrandHex,
} from '../../src/lib/brand';
import { HONEYCOMB } from '../../scripts/lib/og-render.mjs';

// Drift gate (PRD REQ-02 / D13). global.css stays hand-written; the guarantee
// that it still agrees with the brand module is this test. If someone edits a
// token and forgets brand.ts (or the other way round), it goes red here rather
// than silently shipping two brand palettes.
//
// The gate also proves it bites: a mutated copy of the stylesheet must produce
// a mismatch, so a green run means the parser really compared the values.

const here = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(here, '..', '..', 'src', 'styles', 'global.css'), 'utf8');

type Expected = Record<string, Record<string, BrandHex>>;

const EXPECTED: Expected = {
  ':root': {
    // The CTA fill is ACCENT_ON_BLUE, not BRAND_BLUE: the signal blue is the
    // *marketing surface* colour, and a blue button on the teal canvas cleared
    // only 1.31:1 against it. Same constant, correct role.
    'button-bg': ACCENT_ON_BLUE,
    'text-accent': ACCENT_ON_TEAL,
  },
  '[data-theme="light"]': {
    'background-primary': CREAM,
    'button-bg': ACCENT_ON_BLUE,
    'text-accent': ACCENT_ON_TEAL_LIGHT,
  },
  '[data-theme="cyberpunk"]': {
    'text-accent': ACCENT_ON_TEAL,
  },
};

/** Hex values declared inside the first block matching `selector`. */
function blockVars(source: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(source);
  if (!block) throw new Error(`no CSS block for selector ${selector}`);
  const vars: Record<string, string> = {};
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1])) !== null) vars[m[1]] = m[2].toLowerCase();
  return vars;
}

/** Every expected token that is absent or different, as readable strings. */
function drift(source: string): string[] {
  const problems: string[] = [];
  for (const [selector, expected] of Object.entries(EXPECTED)) {
    const vars = blockVars(source, selector);
    for (const [token, value] of Object.entries(expected)) {
      const actual = vars[token];
      if (actual === undefined) problems.push(`${selector} --${token}: missing`);
      else if (actual !== value) {
        problems.push(`${selector} --${token}: ${actual} != ${value}`);
      }
    }
  }
  return problems;
}

describe('brand drift gate (global.css ↔ brand.ts)', () => {
  it('global.css declares exactly the brand tokens brand.ts exports', () => {
    expect(drift(CSS)).toEqual([]);
  });

  it('bites when a token is changed', () => {
    // Flip the dark accent to the blue accent: a plausible "simplification"
    // that would collapse the intentional two-accent system.
    const mutated = CSS.replace(
      /(--text-accent\s*:\s*)#[0-9a-fA-F]{3,8}/,
      '$1#000000',
    );
    expect(mutated).not.toBe(CSS);
    expect(drift(mutated)).toContain(':root --text-accent: #000000 != #ff8569');
  });

  it('bites when a token is renamed away', () => {
    const mutated = CSS.replace('--background-primary: #f4efca;', '--page-bg: #f4efca;');
    expect(mutated).not.toBe(CSS);
    expect(drift(mutated)).toContain(
      '[data-theme="light"] --background-primary: missing',
    );
  });
});

// --- Wallpaper lattice: global.css --wallpaper-tile ↔ the OG banners --------
//
// The banners paint the same honeycomb the site paints behind every page, and
// HONEYCOMB in scripts/lib/og-render.mjs is a transcription of that tile. Same
// contract as the palette gate above: edit either side alone and this goes red,
// instead of shipping two lattices that almost match.

const TILE = /--wallpaper-tile:\s*url\("data:image\/svg\+xml,([^"]+)"\)/;

/** The tile's geometry, read out of the CSS data URI. */
function wallpaperTile(source: string): typeof HONEYCOMB {
  const m = TILE.exec(source);
  if (!m) throw new Error('no --wallpaper-tile data URI in global.css');
  const svg = decodeURIComponent(m[1]);
  const size = /width='(\d+)' height='(\d+)'/.exec(svg);
  const viewBox = /viewBox='([^']+)'/.exec(svg);
  const paths = [...svg.matchAll(/d='([^']+)'/g)].map((p) => p[1]);
  if (!size || !viewBox || paths.length !== 2) {
    throw new Error('--wallpaper-tile is not the two-path tile this gate parses');
  }
  return {
    width: Number(size[1]),
    height: Number(size[2]),
    viewBox: viewBox[1],
    hex: paths[0],
    links: paths[1],
  };
}

describe('wallpaper lattice drift gate (global.css ↔ og-render.mjs)', () => {
  it('the OG honeycomb is the tile the site paints', () => {
    expect(wallpaperTile(CSS)).toEqual(HONEYCOMB);
  });

  it('bites when the tile geometry is changed', () => {
    // Move one vertex of the hexagon: a plausible hand-tweak that would
    // otherwise leave every banner drawing the old cell forever.
    const mutated = CSS.replace(
      'M35 12 28 24 14 24 7 12 14 0 28 0Z',
      'M35 12 28 24 14 24 7 12 14 0 30 0Z',
    );
    expect(mutated).not.toBe(CSS);
    expect(wallpaperTile(mutated)).not.toEqual(HONEYCOMB);
  });
});
