// Rasterise public/favicon.svg into the PNG icons the layout ships, and draw
// one tab icon per site section.
//
// Part 1 — apple-touch-icon.png. iOS ignores `rel="icon"` SVGs and falls back to
// a screenshot of the page, so `public/apple-touch-icon.png` (180×180, declared
// in Base.astro) has to be a real raster. It is flattened onto the mark's own
// fill: the hexagon then reads as a full square, which is the shape iOS rounds
// off itself.
//
// Part 2 — public/icons/favicon-<section>.svg. A browser tab shows ~16×16 px of
// the favicon, so the only thing that survives is the glyph. Each section gets
// the SAME hexagon silhouette (the brand, and what keeps the tabs a family) with
// that section's own nav glyph knocked out in cream — projects, writing, demos,
// boards and the rest stop looking identical in a tab strip. The glyph names are
// not copied here: they come from the `SECTIONS` registry and `ICON` map, so a
// section that changes its nav icon changes its tab icon with it.
//
// The home page keeps the plain `favicon.svg` with its NB lettermark on purpose:
// it is the one page where the brand, not the section, is the identity.
//
// Run after editing `src/lib/sections.ts`, `src/lib/icons.ts` or the base SVG:
// `bun run icons`. The layout versions every icon by content hash, so a
// regenerated file reaches the browser without a manual bump.

import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

import { ICON } from '../src/lib/icons.ts';
import { SECTIONS } from '../src/lib/sections.ts';

const ROOT = process.cwd();
const SVG = path.join(ROOT, 'public/favicon.svg');
const OUT = path.join(ROOT, 'public/apple-touch-icon.png');
const ICON_DIR = path.join(ROOT, 'public/icons');
const FILL = '#1400c3';
const INK = '#f8f2d8';

await sharp(SVG, { density: 720 })
  .resize(180, 180)
  .flatten({ background: FILL })
  .png()
  .toFile(OUT);

console.log('wrote public/apple-touch-icon.png (180x180)');

/** The base mark's silhouette. Same path as `public/favicon.svg`. */
const HEX = 'M96 50 73 89.8 27 89.8 4 50 27 10.2 73 10.2Z';

/**
 * Route groups that are not in `SECTIONS` but still own a tab: they are pages,
 * not sections of the drawer, so they cannot hold a registry entry.
 */
const EXTRA = {
  contact: 'contact',
  search: 'search',
  feedback: 'message',
  games: 'gamepad',
  board: 'chart',
  diagram: 'layers',
};

/**
 * One 100×100 icon: the hexagon, then the glyph in a 46-unit box.
 *
 * `stroke-width` is declared in the glyph's own 24-unit space and scaled up with
 * it (3.4 × 1.9167 ≈ 6.5 of 100 ≈ 1.04 px at 16 px). `color` feeds the few
 * glyphs that paint `currentColor` (the `topics` tag's dot) so they stay cream
 * instead of falling back to black.
 */
const draw = (glyph) =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    `  <path fill="${FILL}" d="${HEX}"/>`,
    `  <g fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" color="${INK}" transform="translate(27 27) scale(1.9167)">${glyph}</g>`,
    '</svg>',
    '',
  ].join('\n');

mkdirSync(ICON_DIR, { recursive: true });

const written = [];
for (const section of SECTIONS) {
  // `home` stays the NB lettermark; see the header comment.
  if (section.key === 'home') continue;
  const glyph = ICON[section.icon];
  if (!glyph) throw new Error(`section ${section.key}: ICON.${section.icon} is missing`);
  const file = path.join(ICON_DIR, `favicon-${section.key}.svg`);
  writeFileSync(file, draw(glyph));
  written.push(section.key);
}
for (const [key, glyphName] of Object.entries(EXTRA)) {
  const glyph = ICON[glyphName];
  if (!glyph) throw new Error(`favicon ${key}: ICON.${glyphName} is missing`);
  writeFileSync(path.join(ICON_DIR, `favicon-${key}.svg`), draw(glyph));
  written.push(key);
}

console.log(`wrote ${written.length} section favicons in public/icons/`);
