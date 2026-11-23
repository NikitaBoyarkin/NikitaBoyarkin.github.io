// Community banner for https://t.me/nbxplay — same pixel-art series as the
// portfolio OG banners (portfolio-banner-v2.png, section-*.png).
//
// The SVG is authored directly on the 240x126 cell grid (5px cells) and handed
// to renderPixelBanner, which supersamples at 4x, box-downsamples to one value
// per cell, quantises to the eight-step brand ramp and nearest-upscales back to
// 1200x630. No live text element, no font stack: typography is the 5x7 bitmap
// font, so nothing here depends on fontconfig or a vendored TTF.
//
// Composition (px on the 1200x630 canvas, snapped to cells):
//   • coral accent bar, one cell tall;
//   • NB hexagon + COMMUNITY label, the family's identity slot;
//   • NBxPlay headline at 3x, the x in coral (NB × Play);
//   • coral rule + EST. 2026 · LET'S PLAY tagline;
//   • the play button: accent hexagon with a cream triangle inside, ringed by a
//     muted halo hexagon;
//   • URL footer T.ME/NBXPLAY, CTA JOIN THE CHAT (right-aligned).
//
// Palette: brand tokens only (src/lib/brand.ts) — every paint is a RAMP step, so
// the quantiser snaps it byte-for-byte and flat areas stay free of speckle.
//
// Run: bun run og:community

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BANNER_ACCENT,
  BANNER_INK,
  BANNER_MUTED,
  CREAM_SURFACE,
  hexPoints,
  hexPointsFlat,
} from '../src/lib/brand.ts';
import { assertCovered, glyphRects, measure } from './lib/pixel-font.mjs';
import { RAMP, SS, gridOf, renderPixelBanner } from './lib/pixel-og.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public/images/og/community-nbxplay.png');

// Ramp steps only, aliased by role.
const SURFACE = CREAM_SURFACE; // RAMP[7] paper
const INK = BANNER_INK; // RAMP[1] headline, body, footer
const MUTED = BANNER_MUTED; // RAMP[3] halo, secondary label
const ACCENT = BANNER_ACCENT; // RAMP[5] bar, rule, x, play hex, CTA

const GRID = gridOf(5);
const { b, w, h } = GRID;

/** px on the 1200x630 canvas -> supersampled user units */
const S = (v) => Math.round((v / b) * SS);
/** px -> whole cell, in supersampled user units */
const C = (v) => Math.round(v / b) * SS;
const R = (x, y, rw, rh, fill) =>
  `<rect x="${C(x)}" y="${C(y)}" width="${C(rw)}" height="${C(rh)}" fill="${fill}"/>`;
const T = (text, x, y, size, fill, gap = 0) =>
  glyphRects(text, C(x), C(y), { scale: size * SS, fill, advanceGap: gap }).join('');
const scalePoints = (points, factor) =>
  points
    .split(' ')
    .map((p) => p.split(',').map((v) => Math.round(Number(v) * factor)).join(','))
    .join(' ');

// --- layout -----------------------------------------------------------------
const LOGO = { cx: 113.5, cy: 101.5, r: 52.9 };
const LABEL = 'COMMUNITY';
const TITLE = { x: 56, y: 185, size: 3 };
const RULE = { x: 56, y: 325, w: 150 };
const TAGLINE = 'EST. 2026 · LET\'S PLAY';
const TAGLINE_Y = 352;
const SITE_URL = 'T.ME/NBXPLAY';
const CTA = 'JOIN THE CHAT';
const FOOTER_Y = 550;
const RIGHT_EDGE = 1144;
const PLAY = { cx: 952, cy: 352, haloR: 178, hexR: 118 };

// --- gates: every fixed string must paint and fit its column -----------------
for (const text of ['NB', LABEL, 'NBxPlay', TAGLINE, SITE_URL, CTA]) assertCovered(text);

const textWidth = (text, size, gap = 0) => {
  let cells = 0;
  let glyphs = 0;
  for (const ch of text) {
    cells += measure(ch);
    if (ch !== ' ') glyphs += 1;
  }
  return (cells + gap * Math.max(0, glyphs - 1)) * size * b;
};

const fits = (text, x, maxX, size, gap = 0) => {
  const end = x + textWidth(text, size, gap);
  if (end > maxX) throw new Error(`"${text}" ends at ${end}px, over the ${maxX}px column`);
};

fits(LABEL, 186, PLAY.cx - PLAY.haloR, 1, 1);
fits('NBxPlay', TITLE.x, PLAY.cx - PLAY.haloR - 10, TITLE.size, 1);
fits(TAGLINE, 56, PLAY.cx - PLAY.haloR, 1, 1);
fits(SITE_URL, 56, RIGHT_EDGE, 1, 1);

// --- headline: NBxPlay with the x in coral ----------------------------------
// Sequential parts so the multiplication glyph can carry the accent without a
// second text engine. Advance is the bitmap font's own: glyph width x scale plus
// the same one-cell gap glyphRects applies, with no gap after a space.
const drawParts = (parts, x, y, size, gap = 1) => {
  const scale = size * SS;
  let pen = C(x);
  const out = [];
  for (const { text, fill } of parts) {
    out.push(glyphRects(text, pen, C(y), { scale, fill, advanceGap: gap }));
    for (const ch of text) pen += (measure(ch) + (ch === ' ' ? 0 : gap)) * scale;
  }
  return out.flat().join('');
};

const title = drawParts(
  [
    { text: 'NB', fill: INK },
    { text: 'x', fill: ACCENT },
    { text: 'Play', fill: INK },
  ],
  TITLE.x,
  TITLE.y,
  TITLE.size,
  1,
);

// --- CTA: right-aligned on a cell boundary ----------------------------------
const ctaWidth = textWidth(CTA, 1, 1);
const ctaX = RIGHT_EDGE - ctaWidth;

// --- play button: coral hexagon + cream triangle, muted halo ----------------
const halo = hexPoints(PLAY.cx, PLAY.cy, PLAY.haloR);
const hex = hexPoints(PLAY.cx, PLAY.cy, PLAY.hexR);
const TRIANGLE = `${PLAY.cx - 37},${PLAY.cy - 52} ${PLAY.cx - 37},${PLAY.cy + 52} ${PLAY.cx + 46},${PLAY.cy}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * SS}" height="${h * SS}" viewBox="0 0 ${w * SS} ${h * SS}">
  <rect width="${w * SS}" height="${h * SS}" fill="${SURFACE}"/>

  <!-- ambient hexagons, the family's honeycomb decor -->
  <polygon points="${scalePoints(hexPoints(1124, 78, 26), SS / b)}" fill="none" stroke="${RAMP[4]}" stroke-width="${S(b)}"/>

  ${R(0, 0, 1200, b, ACCENT)}

  <!-- play button -->
  <polygon points="${scalePoints(halo, SS / b)}" fill="none" stroke="${MUTED}" stroke-width="${S(b)}"/>
  <polygon points="${scalePoints(hex, SS / b)}" fill="${ACCENT}"/>
  <polygon points="${scalePoints(TRIANGLE, SS / b)}" fill="${SURFACE}"/>

  <!-- identity -->
  <polygon points="${scalePoints(hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r), SS / b)}" fill="${ACCENT}"/>
  <polygon points="${scalePoints(hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r - b * 1.6), SS / b)}" fill="${SURFACE}"/>
  ${glyphRects('NB', C(LOGO.cx - b * 5), C(LOGO.cy - b * 3.5), { scale: SS, fill: INK }).join('')}
  ${T(LABEL, 186, 84, 1, INK, 1)}

  ${title}
  ${R(RULE.x, RULE.y, RULE.w, b, ACCENT)}
  ${T(TAGLINE, 56, TAGLINE_Y, 1, MUTED, 1)}

  ${T(SITE_URL, 56, FOOTER_Y, 1, INK, 1)}
  ${T(CTA, ctaX, FOOTER_Y, 1, ACCENT, 1)}
</svg>`;

const { bytes } = renderPixelBanner(svg, GRID, OUT);
console.log(`OK ${OUT}`);
console.log(`  ${GRID.w}x${GRID.h} cells, ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  headline ${textWidth('NBxPlay', TITLE.size)}px, CTA starts at ${ctaX}px`);
