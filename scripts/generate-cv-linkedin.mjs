// LinkedIn feed variant of the CV banner (cv-linkedin.png, 1200x627).
//
// Same identity as generate-cv-og.mjs, retuned for LinkedIn's feed:
//  - 1200x630 (the standard landscape link-preview canvas, no auto-crop);
//  - larger type and a wider scorecard, because the feed renders the image
//    at roughly half width;
//  - a slightly smaller portrait so the left column gets the room.
//
// Palette: cream picture surface · royal-blue ink · burnt-coral accent — all
// from src/lib/brand.ts, so this script holds no brand hex of its own.
// See design-plans/cream-image-regime.md, "Banner palette".
//
// Run: bun run og:cv:li
// Not wired into the build — run manually; commit the PNG.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BANNER_ACCENT,
  BANNER_INK,
  BANNER_MUTED,
  CREAM,
  CREAM_SURFACE,
  hexPoints,
  hexPointsFlat,
} from '../src/lib/brand.ts';
import {
  FONT_SANS,
  FONT_SERIF,
  assertContrast,
  esc,
  renderSvgToPng,
} from './lib/og-render.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public/images/og/cv-linkedin.png');
const PORTRAIT = join(ROOT, 'public/images/00_profile.jpg');

// Palette — every value is the brand module's. On cream the surface is the
// page, the ink is royal blue, and the panel is a 7% ink wash.
const SURFACE = CREAM_SURFACE;
const INK = BANNER_INK;
const MUTED = BANNER_MUTED;
const ACCENT = BANNER_ACCENT;

// Three headline outcomes lifted from the CV. Values are accent, labels ink —
// the pair reads as an analytics scorecard, not a bio.
const STATS = [
  { value: '+5.72 п.п.', label: 'A/B-тест KYC-конверсии' },
  { value: '€656K', label: 'доп. дохода в год' },
  { value: '+9.2 п.п.', label: 'retention к 3-му месяцу' },
];

// --- Grid: one edge, one unit, every offset EDGE + n * UNIT. ---
const W = 1200;
const H = 630;
const EDGE = 80;
const UNIT = 10;

const PANEL = { x: EDGE, y: 356, w: 640 };
const ROW_H = 60; // one constant drives every row step
const PANEL_PAD = 22;
const PANEL_H = STATS.length * ROW_H + 2 * PANEL_PAD;
const rowBandTop = (i) => PANEL.y + PANEL_PAD + i * ROW_H;
const rowBaseline = (i) => rowBandTop(i) + ROW_H / 2 + 14;
const rowSeparator = (i) => rowBaseline(i) + ROW_H / 2;
const LABEL_X = PANEL.x + 28 * UNIT; // label column, aligned across rows

// Portrait — pointy-top hexagon, one geometry from brand.ts.
const PORTRAIT_C = { cx: 1000, cy: 305 };
const TILE_R = 200;
const PHOTO_R = TILE_R - 7;
const RING_R = TILE_R - 3.5;
const GLOW_R = TILE_R; // warm halo hugs the ring

// NB brand mark — flat-top hexagon, left vertex flush with the text edge.
const LOGO_R = 56;
const LOGO = { cx: EDGE + LOGO_R, cy: 88 };

// AA gate: every text token clears 4.5:1 (3:1 for large text) on the cream
// surface. The scorecard labels sit on a 7% ink wash, which is darker than the
// surface, so asserting them against CREAM_SURFACE is the conservative case.
assertContrast(
  SURFACE,
  [
    { name: 'name', color: INK, size: 70, weight: 600 },
    { name: 'role', color: MUTED, size: 36, weight: 600 },
    { name: 'chip', color: INK, size: 20, weight: 700 },
    { name: 'url', color: INK, size: 22, weight: 500 },
    { name: 'logo', color: INK, size: 30, weight: 700 },
    { name: 'graphic: ring/halo (accent)', color: ACCENT, decorative: true },
    { name: 'graphic: frame (ink 0.18)', color: INK, decorative: true },
  ],
  'CV LinkedIn banner',
);
assertContrast(
  SURFACE,
  [
    { name: 'stat value (panel)', color: ACCENT, size: 40, weight: 700 },
    { name: 'stat label (panel)', color: INK, size: 20, weight: 500 },
  ],
  'CV LinkedIn scorecard',
);

// Portrait inlined as a data URI so rsvg-convert resolves it from any cwd.
const portraitData = `data:image/jpeg;base64,${readFileSync(PORTRAIT).toString('base64')}`;

const rows = STATS.map((s, i) => {
  const y = rowBaseline(i);
  const sep =
    i < STATS.length - 1
      ? `<line x1="${PANEL.x + PANEL_PAD}" y1="${rowSeparator(i)}" x2="${PANEL.x + PANEL.w - PANEL_PAD}" y2="${rowSeparator(i)}" stroke="${INK}" stroke-width="1" opacity="0.18"/>`
      : '';
  return `<text x="${PANEL.x + PANEL_PAD}" y="${y.toFixed(1)}" font-family="${FONT_SANS}" font-size="40" font-weight="700" letter-spacing="-0.5" fill="${ACCENT}">${esc(s.value)}</text>
    <text x="${LABEL_X}" y="${(y + 8).toFixed(1)}" font-family="${FONT_SANS}" font-size="20" font-weight="500" fill="${INK}">${esc(s.label)}</text>
    ${sep}`;
}).join('\n    ');

// Decorative hexagons on the gutter between the scorecard and the portrait,
// mirrored about the portrait's centre line. Geometry from brand.ts; a 14% ink
// tint reads as texture on cream.
const DECOR_R = 30;
const decor = [
  [762, PORTRAIT_C.cy - 155],
  [762, PORTRAIT_C.cy + 155],
]
  .map(
    ([cx, cy]) =>
      `<polygon points="${hexPoints(cx, cy, DECOR_R)}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.14"/>`,
  )
  .join('\n    ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" text-rendering="geometricPrecision">
  <defs>
    <clipPath id="hexPhoto">
      <polygon points="${hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, PHOTO_R)}"/>
    </clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="${SURFACE}"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${ACCENT}"/>

  <!-- decorative hexagons on the gutter -->
  <g>
    ${decor}
  </g>

  <!-- scorecard well: 7% ink wash + 18% ink frame -->
  <rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL_H}" rx="18" fill="${INK}" fill-opacity="0.07"/>
  <g>
    ${rows}
  </g>
  <rect x="${PANEL.x + 0.5}" y="${PANEL.y + 0.5}" width="${PANEL.w - 1}" height="${PANEL_H - 1}" rx="18" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="1"/>

  <!-- NB brand mark (nav-logo geometry, left vertex flush with the text edge) -->
  <polygon points="${hexPointsFlat(LOGO.cx, LOGO.cy, LOGO_R)}" fill="none" stroke="${ACCENT}" stroke-width="4"/>
  <text x="${LOGO.cx}" y="${LOGO.cy + 11}" font-family="${FONT_SANS}" font-size="30" font-weight="700" fill="${INK}" text-anchor="middle">NB</text>

  <text x="${EDGE}" y="240" font-family="${FONT_SERIF}" font-size="70" font-weight="600" letter-spacing="-1" fill="${INK}">${esc('Nikita Boyarkin')}</text>
  <text x="${EDGE}" y="294" font-family="${FONT_SANS}" font-size="36" font-weight="600" fill="${MUTED}">${esc('Product / Data Analyst')}</text>

  <!-- CV · PDF chip -->
  <rect x="${EDGE}" y="312" width="150" height="36" rx="18" fill="none" stroke="${ACCENT}" stroke-width="2"/>
  <text x="${EDGE + 75}" y="336" font-family="${FONT_SANS}" font-size="20" font-weight="700" letter-spacing="2" fill="${INK}" text-anchor="middle">CV · PDF</text>

  <!-- portrait: accent halo + clipped photo + accent ring (no plate) -->
  <polygon points="${hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, GLOW_R)}" fill="none" stroke="${ACCENT}" stroke-width="7" opacity="0.10"/>
  <!-- The plate is CREAM (#f4efca), the portrait's own backdrop: the photo is
       shot on #f4eeca, so an unpainted hexagon showed a hard vertical seam
       where its edge met the #f8f2d8 surface. -->
  <polygon points="${hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, PHOTO_R)}" fill="${CREAM}"/>
  <image x="830" y="20" width="390" height="600" preserveAspectRatio="xMidYMid slice" clip-path="url(#hexPhoto)" xlink:href="${portraitData}" href="${portraitData}"/>
  <polygon points="${hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, RING_R)}" fill="none" stroke="${ACCENT}" stroke-width="7"/>

  <text x="${EDGE}" y="608" font-family="${FONT_SANS}" font-size="22" font-weight="500" fill="${INK}">nikitaboyarkin.github.io</text>
</svg>`;

renderSvgToPng(svg, OUT, { tmpName: 'og-cv-linkedin' });
console.log(`OK ${OUT}`);
