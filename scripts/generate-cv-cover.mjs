// A4 cover page for the CV PDF (cv-cover.pdf).
//
// The CV download (nikitaboyarkin.github.io/CV-Nikita-Boyarkin.pdf) is a plain
// one-page A4 resume, so link previews render a dense wall of text. This cover
// is prepended as page 1 by scripts/sync-cv-pdf.mjs, giving LinkedIn /
// Telegram / Slack a branded first page to show.
//
// Same identity as generate-cv-og.mjs / generate-cv-linkedin.mjs, laid out for
// A4 portrait (595.276 x 841.89 pt — SVG user units map 1:1 to pt here).
//
// The portrait is downscaled with sharp before embedding: cairo stores the
// bitmap Flate-compressed, so shipping the raw 1229x1469 source would inflate
// the PDF past 1 MB. The hexagon shows ~264 pt of height, so the default
// 700 px lands near 190 dpi — COVER_PHOTO_H tunes the trade-off.
//
// Palette: cream picture surface · royal-blue ink · burnt-coral accent — all
// from src/lib/brand.ts, so this script holds no brand hex of its own and the
// cover can never drift from the CV banner it accompanies. Stat values use
// BANNER_ACCENT (4.84:1 on cream); the retired ACCENT_ON_BLUE would land at
// 2.96:1, under the 3:1 graphics floor.
//
// Run: bun run og:cv:cover
// Not wired into the build — run manually; commit the PDF.

import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import sharp from 'sharp';

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
  renderSvgToPdf,
} from './lib/og-render.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public/images/og/cv-cover.pdf');
const PORTRAIT = join(ROOT, 'public/images/00_profile.jpg');

// A4 in points.
const W = 595.276;
const H = 841.89;
const CX = W / 2;

// Palette — every value is the brand module's.
const SURFACE = CREAM_SURFACE;
const INK = BANNER_INK;
const MUTED = BANNER_MUTED;
const ACCENT = BANNER_ACCENT;

// AA gate: every text token clears 4.5:1 (3:1 for large text) on the cream
// surface. Stat values are the tightest pair on the page at 4.84:1.
assertContrast(
  SURFACE,
  [
    { name: 'name', color: INK, size: 56, weight: 600 },
    { name: 'role', color: MUTED, size: 23, weight: 600 },
    { name: 'chip', color: INK, size: 15, weight: 700 },
    { name: 'stat value', color: ACCENT, size: 26, weight: 700 },
    { name: 'stat middot', color: ACCENT, size: 18, weight: 400 },
    { name: 'stat label', color: INK, size: 14, weight: 500 },
    { name: 'caption', color: MUTED, size: 13, weight: 500 },
    { name: 'url', color: INK, size: 13, weight: 500 },
    { name: 'logo', color: INK, size: 27, weight: 700 },
    { name: 'graphic: accent rules/ring', color: ACCENT, decorative: true },
  ],
  'CV cover',
);

// Portrait — pointy-top hexagon, one geometry from brand.ts.
// Plate R=132, photo clip R=125, orange ring R=128.5.
const PC = { cx: CX, cy: 415, r: 132 };
const HEX_HALO = hexPoints(PC.cx, PC.cy, PC.r);
const HEX_PHOTO = hexPoints(PC.cx, PC.cy, PC.r - 7);
const HEX_RING = hexPoints(PC.cx, PC.cy, PC.r - 3.5);

// Decorative hexagons, mirrored about the portrait's centre line.
const DECOR_R = 37;
const DECOR_Y = 337;

// NB brand mark — flat-top hexagon reproducing the former 0.9x lockup.
const LOGO = { cx: 71, cy: 69, r: 41.4, dy: 9.9 };

// Image box is oversized vs the clip so the photo's hard shoulder edge never
// reaches the hexagon border (same trick as generate-home-og.mjs).
const IMG_X = PC.cx - 135;
const IMG_Y = PC.cy - 195;
const IMG_W = 270;
const IMG_H = 400;

// Three headline outcomes lifted from the CV, as centred mixed-colour lines.
// Spacing around the separator is set with dx, not literal spaces: SVG
// collapses whitespace, which would jam the middot against the adjacent spans.
const STATS = [
  { value: '+5.72 п.п.', label: 'A/B-тест KYC-конверсии' },
  { value: '€656K', label: 'доп. дохода в год' },
  { value: '+9.2 п.п.', label: 'retention к 3-му месяцу' },
];

const stats = STATS.map(
  (s, i) =>
    `<text x="${CX.toFixed(1)}" y="${(628 + i * 38).toFixed(1)}" font-family="${FONT_SANS}" text-anchor="middle"><tspan font-size="26" font-weight="700" letter-spacing="-0.5" fill="${ACCENT}">${esc(s.value)}</tspan><tspan font-size="18" fill="${ACCENT}" dx="7">·</tspan><tspan font-size="14" font-weight="500" fill="${INK}" dx="7">${esc(s.label)}</tspan></text>`,
).join('\n  ');

function buildSvg(portraitData) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}pt" height="${H}pt" viewBox="0 0 ${W} ${H}" text-rendering="geometricPrecision">
  <defs>
    <clipPath id="hexPhoto">
      <polygon points="${HEX_PHOTO}"/>
    </clipPath>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${SURFACE}"/>
  <rect x="0" y="0" width="${W}" height="5" fill="${ACCENT}"/>

  <!-- decorative hexagons (subtle) -->
  <g fill="none" stroke="${INK}" stroke-width="1.5" opacity="0.14">
    <polygon points="${hexPoints(120, DECOR_Y, DECOR_R)}"/>
    <polygon points="${hexPoints(476, DECOR_Y, DECOR_R)}"/>
  </g>

  <!-- warm glow behind the portrait -->
  <ellipse cx="${CX.toFixed(1)}" cy="${PC.cy}" rx="210" ry="200" fill="url(#glow)"/>

  <!-- NB brand mark (nav-logo geometry) -->
  <polygon points="${hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r)}" fill="none" stroke="${ACCENT}" stroke-width="3.6"/>
  <text x="${LOGO.cx}" y="${LOGO.cy + LOGO.dy}" font-family="${FONT_SANS}" font-size="27" font-weight="700" fill="${INK}" text-anchor="middle">NB</text>

  <text x="${CX.toFixed(1)}" y="150" font-family="${FONT_SERIF}" font-size="56" font-weight="600" letter-spacing="-1" fill="${INK}" text-anchor="middle">${esc('Nikita Boyarkin')}</text>
  <text x="${CX.toFixed(1)}" y="190" font-family="${FONT_SANS}" font-size="23" font-weight="600" fill="${MUTED}" text-anchor="middle">${esc('Product / Data Analyst')}</text>

  <!-- CV · PDF chip -->
  <rect x="${(CX - 58).toFixed(1)}" y="206" width="116" height="32" rx="16" fill="none" stroke="${ACCENT}" stroke-width="1.8"/>
  <text x="${CX.toFixed(1)}" y="228" font-family="${FONT_SANS}" font-size="15" font-weight="700" letter-spacing="2" fill="${INK}" text-anchor="middle">CV · PDF</text>

  <rect x="${(CX - 32).toFixed(1)}" y="258" width="64" height="2.5" fill="${ACCENT}"/>

  <!-- portrait: accent halo + clipped photo + accent ring (no plate) -->
  <polygon points="${HEX_HALO}" fill="none" stroke="${ACCENT}" stroke-width="6" opacity="0.10"/>
  <!-- The plate is CREAM (#f4efca), the portrait's own backdrop: the photo is
       shot on #f4eeca, so an unpainted hexagon showed a hard vertical seam
       where its edge met the #f8f2d8 surface. -->
  <polygon points="${HEX_PHOTO}" fill="${CREAM}"/>
  <image x="${IMG_X.toFixed(1)}" y="${IMG_Y}" width="${IMG_W}" height="${IMG_H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#hexPhoto)" xlink:href="${portraitData}" href="${portraitData}"/>
  <polygon points="${HEX_RING}" fill="none" stroke="${ACCENT}" stroke-width="5"/>

  <!-- headline scorecard -->
  <g>
  ${stats}
  </g>

  <text x="${CX.toFixed(1)}" y="760" font-family="${FONT_SANS}" font-size="13" font-weight="500" fill="${MUTED}" text-anchor="middle">${esc('Резюме · 2026')}</text>

  <rect x="${(CX - 30).toFixed(1)}" y="780" width="60" height="2.5" fill="${ACCENT}"/>
  <text x="${CX.toFixed(1)}" y="806" font-family="${FONT_SANS}" font-size="13" font-weight="500" fill="${INK}" text-anchor="middle">nikitaboyarkin.github.io</text>
</svg>`;
}

/** Downscaled portrait as a data URI — keeps the PDF lean (see header). */
async function portraitDataUri() {
  const height = Number(process.env.COVER_PHOTO_H ?? 700);
  const buf = await sharp(PORTRAIT)
    .resize({ height, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

/**
 * Render the A4 cover to `outPath` (defaults to public/images/og/cv-cover.pdf).
 * Exported so sync-cv-pdf.mjs can prepend a fresh cover in the same run.
 */
export async function renderCvCover(outPath = OUT) {
  renderSvgToPdf(buildSvg(await portraitDataUri()), outPath, { tmpName: 'cv-cover' });
  return outPath;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  console.log(`OK ${await renderCvCover()}`);
}
