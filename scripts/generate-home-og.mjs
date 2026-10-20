// Homepage branded OG banner generator (portfolio-banner-v2.png).
// Renders a 1200x630 branded SVG (hexagon-clipped portrait + retention
// step curve) and converts it to PNG via rsvg-convert into
// public/images/og/portfolio-banner-v2.png.
// Palette: the cream picture surface (CREAM_SURFACE) with royal-blue ink and a
// burnt-coral accent — all from src/lib/brand.ts, so this script holds no brand
// hex of its own. Every mark that was cream-on-blue is re-pointed here; a
// light-on-light banner is unreadable, not merely off-brand.
//
// Fonts: the identity name is Cormorant, all service text is Inter — the same
// families the site ships. They are vendored as static TTF in scripts/og-fonts/
// and resolved through FONTCONFIG_FILE + PANGOCAIRO_BACKEND=fc (see
// scripts/lib/og-render.mjs for why the second var is required on macOS).
// Requires `rsvg-convert` (librsvg 2.62.3) on PATH.
//
// Run: bun run og:home
// Not wired into the build — run manually; commit the PNG.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BANNER_ACCENT,
  BANNER_INK,
  CREAM,
  CREAM_SURFACE,
  hexPoints,
  hexPointsFlat,
} from '../src/lib/brand.ts';
import {
  FONT_SANS,
  FONT_SERIF,
  assertContrast,
  contrastRatio,
  esc,
  hexToRgb,
  honeycombLayer,
  honeycombPattern,
  renderSvgToPng,
} from './lib/og-render.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public/images/og/portfolio-banner-v2.png');
const PORTRAIT = join(ROOT, 'public/images/00_profile.jpg');

// Palette — the cream regime; aliases of the brand tokens only.
const SURFACE = CREAM_SURFACE;
const INK = BANNER_INK;
const ACCENT = BANNER_ACCENT;

// AA gate (REQ-03 / REQ-08): every text token clears 4.5:1 (3:1 for large).
assertContrast(
  SURFACE,
  [
    { name: 'name', color: INK, size: 74, weight: 600 },
    { name: 'role', color: INK, size: 38, weight: 600 },
    { name: 'tagline', color: INK, size: 27, weight: 500 },
    { name: 'logo', color: INK, size: 30, weight: 700 },
    { name: 'chart axes', color: INK, size: 19, weight: 500 },
    { name: 'url', color: INK, size: 24, weight: 500 },
    { name: 'graphic: accent ring / rule', color: ACCENT, decorative: true },
  ],
  'home OG banner',
);

// The retention curve is the one mark here that carries information, so it is
// NOT exempt: 3:1 is its floor (WCAG 1.4.11), not the 4.5:1 the text gate would
// demand of a 4px stroke. It has to clear that floor twice — on the bare sheet
// and on top of its own area fill, which is the harder background.
const over = (color, alpha, bg) => {
  const fg = hexToRgb(color);
  const base = hexToRgb(bg);
  const mix = fg.map((c, i) => Math.round(c * alpha + base[i] * (1 - alpha)));
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};
for (const [where, bg] of [
  ['surface', SURFACE],
  ['area fill', over(ACCENT, 0.14, SURFACE)],
]) {
  const ratio = contrastRatio(ACCENT, bg);
  const pass = ratio >= 3;
  console.log(
    `[contrast] retention curve on ${where.padEnd(8)}  ${bg}  ${ratio.toFixed(2).padStart(5)}:1  graphic  ${pass ? 'PASS' : 'FAIL'}`,
  );
  if (!pass) {
    throw new Error(`WCAG graphics contrast failed (retention curve on ${where}): ${ratio.toFixed(2)}:1 < 3:1`);
  }
}

// Portrait inlined as a data URI so rsvg-convert resolves it from any cwd.
const portraitData = `data:image/jpeg;base64,${readFileSync(PORTRAIT).toString('base64')}`;

// Cohort retention step curve with axis labels — reads as a real retention
// chart on larger previews. Every label is drawn in the banner ink.
const STEP = (() => {
  const x0 = 150;
  const x1 = 600;
  const yTop = 408;
  const yBottom = 518;
  const values = [100, 68, 52, 43, 38, 35, 33];
  const seg = (x1 - x0) / (values.length - 1);
  const y = (v) => yBottom - (v / 100) * (yBottom - yTop);

  let d = `M${x0},${y(values[0]).toFixed(1)}`;
  for (let i = 1; i < values.length; i++) {
    d += ` H${(x0 + i * seg).toFixed(1)} V${y(values[i]).toFixed(1)}`;
  }
  d += ` H${x1}`;

  const grid = [100, 75, 50, 25, 0]
    .map((v) => {
      const gy = y(v);
      return `<line x1="${x0}" y1="${gy.toFixed(1)}" x2="${x1}" y2="${gy.toFixed(1)}" stroke="${INK}" stroke-width="1" opacity="0.14"/>
  <text x="138" y="${(gy + 6).toFixed(1)}" font-family="${FONT_SANS}" font-size="19" font-weight="500" fill="${INK}" text-anchor="end">${v}%</text>`;
    })
    .join('\n  ');

  const xLabels = values
    .map(
      (_, i) =>
        `<text x="${(x0 + i * seg).toFixed(1)}" y="549" font-family="${FONT_SANS}" font-size="19" font-weight="500" fill="${INK}" text-anchor="middle">W${i}</text>`,
    )
    .join('\n  ');

  const nodes = values
    .slice(1)
    .map(
      (v, i) =>
        `<circle cx="${(x0 + (i + 1) * seg).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5.5" fill="${INK}"/>`,
    )
    .join('\n  ');

  return `${grid}
  <path d="${d} V${yBottom} H${x0} Z" fill="${ACCENT}" opacity="0.14"/>
  <path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="4" stroke-linejoin="round"/>
  ${nodes}
  ${xLabels}`;
})();

// Pointy-top hexagons centred at (975,305): plate R=232, photo clip R=225,
// orange ring R=228.5 (stroke 7 — exactly covers the 225..232 band). All
// geometry comes from brand.ts so the four banners share one hexagon.
const PORTRAIT_C = { cx: 975, cy: 305 };
const TILE_R = 232;
const HEX_PHOTO = hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, TILE_R - 7);
const HEX_RING = hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, TILE_R - 3.5);
const HEX_HALO = hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, TILE_R);

// NB brand mark — flat-top hexagon, geometry matches the nav logo. The centre
// and radius reproduce the previous translate(80,40) scale(1.4) lockup exactly.
const LOGO = { cx: 150, cy: 110, r: 64.4, dy: 15.4 };

// The portrait box is deliberately oversized (390x600) so the source photo's
// hard-cut shoulder edge is pushed below the hexagon and never shows.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630" text-rendering="geometricPrecision">
  <defs>
    <clipPath id="hexPhoto">
      <polygon points="${HEX_PHOTO}"/>
    </clipPath>
    <!-- same surface language as the graph banner: rounded clipped panel,
         ink frame at 0.18, inner ink vignette at 0.06, accent glow <= 0.08 -->
    <clipPath id="chartPanel">
      <rect x="88" y="396" width="540" height="170" rx="18"/>
    </clipPath>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.6" stop-color="${INK}" stop-opacity="0"/>
      <stop offset="1" stop-color="${INK}" stop-opacity="0.06"/>
    </radialGradient>
    ${honeycombPattern({ color: INK, opacity: 0.1 })}
  </defs>

  <rect width="1200" height="630" fill="${SURFACE}"/>
  ${honeycombLayer()}
  <rect x="0" y="0" width="1200" height="6" fill="${ACCENT}"/>

  <!-- decorative hexagons (subtle) -->
  <g fill="none" stroke="${INK}" stroke-width="2" opacity="0.14">
    <polygon points="${hexPoints(620, 160, 50)}"/>
    <polygon points="${hexPoints(700, 520, 50)}"/>
  </g>

  <!-- retention chart surface: glow + vignette + frame, matching the graph banner -->
  <ellipse cx="358" cy="481" rx="270" ry="85" fill="url(#glow)"/>
  <rect x="88" y="396" width="540" height="170" rx="18" fill="url(#vignette)"/>

  <!-- cohort retention step curve with axis labels -->
  <g clip-path="url(#chartPanel)">
    ${STEP}
  </g>
  <rect x="88.5" y="396.5" width="539" height="169" rx="18" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="1"/>

  <!-- portrait: warm halo + clipped photo + accent ring (no plate) -->
  <polygon points="${HEX_HALO}" fill="none" stroke="${ACCENT}" stroke-width="8" opacity="0.14"/>
  <!-- The plate is CREAM (#f4efca), the portrait's own backdrop: the photo is
       shot on #f4eeca, so an unpainted hexagon showed a hard vertical seam
       where its edge met the #f8f2d8 surface. -->
  <polygon points="${HEX_PHOTO}" fill="${CREAM}"/>
  <image x="830" y="20" width="390" height="600" preserveAspectRatio="xMidYMid slice" clip-path="url(#hexPhoto)" xlink:href="${portraitData}" href="${portraitData}"/>
  <polygon points="${HEX_RING}" fill="none" stroke="${ACCENT}" stroke-width="7"/>

  <!-- NB brand mark (nav-logo geometry; 42px/5.6 reproduce the former 1.4x lockup) -->
  <polygon points="${hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r)}" fill="none" stroke="${ACCENT}" stroke-width="5.6"/>
  <text x="${LOGO.cx}" y="${LOGO.cy + LOGO.dy}" font-family="${FONT_SANS}" font-size="42" font-weight="700" fill="${INK}" text-anchor="middle">NB</text>

  <text x="80" y="264" font-family="${FONT_SERIF}" font-size="74" font-weight="600" letter-spacing="-1" fill="${INK}">${esc('Nikita Boyarkin')}</text>
  <text x="80" y="328" font-family="${FONT_SANS}" font-size="38" font-weight="600" fill="${INK}">${esc('Product / Data Analyst')}</text>
  <text x="80" y="384" font-family="${FONT_SANS}" font-size="27" font-weight="500" fill="${INK}">${esc('Данные → решения. От гипотезы до ship-gate.')}</text>

  <rect x="80" y="578" width="120" height="3" fill="${ACCENT}"/>
  <text x="80" y="610" font-family="${FONT_SANS}" font-size="24" font-weight="500" fill="${INK}">nikitaboyarkin.github.io</text>
</svg>`;

renderSvgToPng(svg, OUT, { tmpName: 'og-home' });
console.log(`OK ${OUT}`);
