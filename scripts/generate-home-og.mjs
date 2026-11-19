// Homepage pixel-art OG banner generator (portfolio-banner-v2.png).
//
// Same pixel pipeline as the graph banner (generate-graph-og.mjs): the SVG is
// authored directly in the 240x126 cell grid (5px cells), rasterised at 4x,
// box-downsampled to one value per cell, quantised to the eight-step brand ramp
// and nearest-upscaled back to 1200x630. Typography is the 5x7 bitmap font, not
// a TTF — nothing here needs fontconfig or a vendored font any more.
//
// Composition mirrors portfolio-graph-v2.png exactly (top accent bar, identity
// stack, MUTED panel, hexagon-clipped portrait, NB mark). The one substitution
// is the panel's content: the homepage carries the cohort retention step curve
// that used to sit under the tagline, re-derived in whole cells instead of a
// 4px stroke. The faint hexagon outlines are the old honeycomb decoration,
// also snapped to the grid. The old tagline line gives way to the composition's
// label slot (`ПОРТФОЛИО`), the same slot the graph banner fills with its own.
//
// Palette: brand tokens only (src/lib/brand.ts). Every paint is a ramp step, so
// the quantiser snaps it byte-for-byte and the flat areas stay free of speckle.
//
// Run: bun run og:home
// Not wired into the build — run manually after content changes; commit the PNG.

import { readFileSync } from 'node:fs';
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
import { glyphRects, measure } from './lib/pixel-font.mjs';
import { RAMP, SS, gridOf, renderPixelBanner } from './lib/pixel-og.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public/images/og/portfolio-banner-v2.png');
const PORTRAIT = join(ROOT, 'public/images/00_profile.jpg');

// Palette — aliases of the brand tokens; each is a ramp step, so nothing dithers.
const SURFACE = CREAM_SURFACE; // RAMP[7] paper
const INK = BANNER_INK; // RAMP[1] titles, body, labels
const MUTED = BANNER_MUTED; // RAMP[3] axes, frame
const ACCENT = BANNER_ACCENT; // RAMP[5] rings, rules, curve

// --- pixel composition: 240x126 cells, one cell per block --------------------
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
/** Bitmap text takes its origin at the TOP cell; the layout numbers are baselines. */
const top = (baseline, size = 1) => baseline - 7 * size * b;
/** Called BEFORE drawing: text is measured in cells, so an overlong string fails here. */
const fits = (text, x, maxX, size, gap = 0) => {
  const px = x + (measure(text) + gap * (text.length - 1)) * size * b;
  if (px > maxX) throw new Error(`"${text}" is ${Math.round(px)}px, only ${maxX - x} available`);
};
/** Scale a brand.ts `points` string from px to supersampled user units. */
const scalePoints = (points, factor) =>
  points
    .split(' ')
    .map((p) => p.split(',').map((v) => Math.round(Number(v) * factor)).join(','))
    .join(' ');

// --- panel: same rectangle and same primitive as the graph banner ------------
// One <rect> with a one-cell CENTRED stroke, not four snapped bars: the stroke
// straddles the cell boundary, so the quantiser alternates two ramp shades and
// the frame reads as the stitched two-tone seam every other banner carries.
const PANEL = { x: 56, y: 196, w: 692, h: 302 };
const PANEL_RECT = `<rect x="${S(PANEL.x)}" y="${S(PANEL.y)}" width="${S(PANEL.w)}" height="${S(PANEL.h)}" fill="none" stroke="${MUTED}" stroke-width="${S(b)}"/>`;

// --- retention step curve, re-derived in whole cells -------------------------
// The same cohort values the previous banner carried. Every edge lands on a
// cell boundary, so the stroke is exactly two cells wide with no half-cells.
const STEP_VALUES = [100, 68, 52, 43, 38, 35, 33];
// x0 sits 2 cells right of the old 150 so the gap-spaced "100" still clears the
// frame; x1 moves with it, keeping the six 90px steps whole cells.
const PLOT = { x0: 160, x1: 700, yTop: 220, yBottom: 415 };
const SEG = (PLOT.x1 - PLOT.x0) / (STEP_VALUES.length - 1);
const yOf = (v) => PLOT.yBottom - (v / 100) * (PLOT.yBottom - PLOT.yTop);
const xAt = (i) => C(PLOT.x0 + i * SEG);

const curve = (() => {
  let d = `M${xAt(0)},${C(yOf(STEP_VALUES[0]))}`;
  for (let i = 1; i < STEP_VALUES.length; i++) d += ` H${xAt(i)} V${C(yOf(STEP_VALUES[i]))}`;
  return d;
})();
const areaPath = `${curve} V${C(PLOT.yBottom)} H${xAt(0)} Z`;

// The area under the curve is a 25% dot screen, not a solid fill: one RAMP[6]
// cell per 2x2 tile keeps the tint at roughly the old 14%-opacity wash, so the
// chart reads as air rather than a salmon block. The tile is anchored to the
// canvas origin, so every screened cell is a whole cell — nothing dithers.
const AREA_SCREEN = `<pattern id="areaScreen" width="${2 * SS}" height="${2 * SS}" patternUnits="userSpaceOnUse"><rect width="${SS}" height="${SS}" fill="${RAMP[6]}"/></pattern>`;

// Grid lines 100/75/50/25/0, one cell high, drawn ABOVE the area screen so they
// stay visible across it; then the curve, then its INK vertex dots.
const gridLines = [100, 75, 50, 25, 0]
  .map((v) => R(PLOT.x0, yOf(v), PLOT.x1 - PLOT.x0, b, RAMP[4]))
  .join('');

// --- axis labels: gap-spaced, right-aligned, gated inside the panel ----------
// Ticks carry `advanceGap 1`, exactly like the role line, the label and the URL:
// at gap 0 the blank right column of each glyph disappears and "100" / "W0" read
// as one fused mark. A Y tick is anchored by its RIGHT edge, two cells left of
// the plot, so its width never decides where it starts: "100" grows leftwards,
// never into the frame. Every label — both axes — is measured with its gaps and
// snapped FIRST, then refused if its bounds leave the panel's inner box, touch
// the plot edge, or ask for a multi-glyph string with no inter-glyph gap.
const TICK_GAP = 2 * b;
const LABEL_GAP = 1;
const snapPx = (v) => Math.round(v / b) * b;
const labelWidth = (text, gap = LABEL_GAP) => (measure(text) + gap * (text.length - 1)) * b;
const INNER = {
  left: PANEL.x + b,
  right: PANEL.x + PANEL.w - b,
  top: PANEL.y + b,
  bottom: PANEL.y + PANEL.h - b,
};
const placeLabel = (text, x, y, axis, gap = LABEL_GAP) => {
  if (text.length > 1 && gap < 1)
    throw new Error(`${axis} label "${text}" is drawn with gap ${gap}: its glyphs would fuse`);
  const x0 = snapPx(x);
  const x1 = x0 + labelWidth(text, gap);
  const y0 = snapPx(y);
  const y1 = y0 + 7 * b;
  if (x0 < INNER.left || x1 > INNER.right)
    throw new Error(
      `${axis} label "${text}" spans x ${x0}..${x1}px, outside the panel's inner box ${INNER.left}..${INNER.right}`,
    );
  if (y0 < INNER.top || y1 > INNER.bottom)
    throw new Error(
      `${axis} label "${text}" spans y ${y0}..${y1}px, outside the panel's inner box ${INNER.top}..${INNER.bottom}`,
    );
  return { text, x: x0, y: y0, x1, gap };
};
const yTicks = [100, 75, 50, 25, 0].map((v) => {
  const label = String(v);
  const right = PLOT.x0 - TICK_GAP;
  const at = placeLabel(label, right - labelWidth(label), yOf(v) - b * 3, 'Y-axis');
  if (at.x1 > right)
    throw new Error(`Y-axis label "${label}" ends at ${at.x1}px, touching the plot at ${right}`);
  return at;
});
const gridLabels = yTicks.map((at) => T(at.text, at.x, at.y, 1, MUTED, at.gap)).join('');
const xTicks = STEP_VALUES.map((_, i) => {
  const label = `W${i}`;
  return placeLabel(label, PLOT.x0 + i * SEG - labelWidth(label) / 2, PLOT.yBottom + b * 5, 'X-axis');
});
const xLabels = xTicks.map((at) => T(at.text, at.x, at.y, 1, MUTED, at.gap)).join('');
const vertexDots = STEP_VALUES.slice(1)
  .map((v, i) => R(PLOT.x0 + (i + 1) * SEG - 5, yOf(v) - 5, 10, 10, INK))
  .join('');

// --- decorative hexagons: the old honeycomb motif, snapped to the grid -------
const DECOR = [
  [700, 522, 22],
  [480, 521, 12],
  [1090, 42, 15],
]
  .map(
    ([cx, cy, r]) =>
      `<polygon points="${scalePoints(hexPoints(cx, cy, r), SS / b)}" fill="none" stroke="${RAMP[4]}" stroke-width="${SS}"/>`,
  )
  .join('');

// --- identity type. Each string is gated against the column it owns. ---------
const NAME = 'Nikita Boyarkin';
const ROLE = 'PRODUCT / DATA ANALYST';
const LABEL = 'ПОРТФОЛИО';
const SITE_URL = 'NIKITABOYARKIN.GITHUB.IO';
fits(NAME, 186, 940, 2);
fits(ROLE, 186, 940, 1, 1);
fits(LABEL, 56, 860, 1, 1);
fits(SITE_URL, 56, 1150, 1, 1);

// --- portrait hexagon + NB mark: geometry identical to the graph banner ------
const PC = { cx: 975, cy: 305, r: 232 };
const HEX_RING = hexPoints(PC.cx, PC.cy, PC.r);
const HEX_PHOTO = hexPoints(PC.cx, PC.cy, PC.r - 7);
// The photo box has to reach the hexagon's left flank at x=743, otherwise the
// filled accent polygon shows through as a coral band inside the frame.
const PORTRAIT_BOX = { x: 735, y: 20, w: 490, h: 600 };
const LOGO = { cx: 113.5, cy: 101.5, r: 52.9 };
const portraitData = `data:image/jpeg;base64,${readFileSync(PORTRAIT).toString('base64')}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w * SS}" height="${h * SS}" viewBox="0 0 ${w * SS} ${h * SS}">
  <defs>
    <clipPath id="hexPhoto"><polygon points="${scalePoints(HEX_PHOTO, SS / b)}"/></clipPath>
    ${AREA_SCREEN}
  </defs>
  <rect width="${w * SS}" height="${h * SS}" fill="${SURFACE}"/>
  ${DECOR}
  ${R(0, 0, 1200, b, ACCENT)}
  ${PANEL_RECT}
  <path d="${areaPath}" fill="url(#areaScreen)"/>
  ${gridLines}
  <path d="${curve}" fill="none" stroke="${ACCENT}" stroke-width="${SS * 2}" stroke-linejoin="miter"/>
  ${vertexDots}
  ${gridLabels}
  ${xLabels}
  <polygon points="${scalePoints(hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r), SS / b)}" fill="${ACCENT}"/>
  <polygon points="${scalePoints(hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r - b * 1.6), SS / b)}" fill="${SURFACE}"/>
  ${glyphRects('NB', C(LOGO.cx - b * 5), C(LOGO.cy - b * 3.5), { scale: SS, fill: INK }).join('')}
  ${T(NAME, 186, top(82, 2), 2, INK)}
  ${T(ROLE, 186, 96, 1, INK, 1)}
  ${R(186, 140, 110, 3, ACCENT)}
  ${T(LABEL, 56, 150, 1, INK, 1)}
  ${T(SITE_URL, 56, 550, 1, INK, 1)}
  <polygon points="${scalePoints(HEX_RING, SS / b)}" fill="${ACCENT}"/>
  <image x="${S(PORTRAIT_BOX.x)}" y="${S(PORTRAIT_BOX.y)}" width="${S(PORTRAIT_BOX.w)}" height="${S(PORTRAIT_BOX.h)}" preserveAspectRatio="xMidYMid slice" image-rendering="pixelated" clip-path="url(#hexPhoto)" xlink:href="${portraitData}" href="${portraitData}"/>
</svg>`;

const { bytes } = renderPixelBanner(svg, GRID, OUT);
const yClear = Math.min(...yTicks.map((t) => t.x)) - INNER.left;
const xClear = INNER.right - Math.max(...xTicks.map((t) => t.x1));
console.log(`OK ${OUT} — ${GRID.w}x${GRID.h} cells, ${(bytes / 1024).toFixed(0)} KB, retention ${STEP_VALUES.length} slices`);
console.log(`labels: Y ticks ${yClear}px clear of the left frame, X ticks ${xClear}px clear of the right frame`);
