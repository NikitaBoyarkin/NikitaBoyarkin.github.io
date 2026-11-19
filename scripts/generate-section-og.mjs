// Per-section OG banner generator — pixel-art edition.
//
// One 1200x630 banner per entry in src/lib/sections.ts, in each locale, written
// to the exact path sectionOgPath() returns so the registry and the files on
// disk cannot drift apart. The composition is the same one
// `portfolio-graph-v2.png` ships: the SVG is drawn directly on the 240x126 cell
// grid (gridOf(5), one cell = 5px) and handed to renderPixelBanner, which
// supersamples it at SS=4, box-downsamples to cells, quantises to the RAMP and
// nearest-upscales back to 1200x630. There is no live text element and no
// system font stack anywhere in the SVG: typography is the 5x7 bitmap font
// from lib/pixel-font.mjs and every shape is a whole number of cells.
//
// Composition (coordinates are 1200x630 px, snapped to cells by C()):
//   • top accent bar, one cell tall, in the section's ramp hue;
//   • NB logo hexagon top-left (hexPointsFlat), same box as the graph banner;
//   • identity: `Nikita Boyarkin` at 2x, `PRODUCT / DATA ANALYST` at 1x, the
//     accent rule under the role, the URL footer at the bottom;
//   • a muted one-cell panel frame at {56,196,692,302} — the graph banner's
//     stage, kept so the two banners read as one family;
//   • the section's OWN icon inside that stage (ICON[section.icon]), drawn with
//     shape-rendering="crispEdges" so the 1-cell stroke rasterises to hard
//     pixel edges instead of an anti-aliased halo;
//   • a lattice cell on the right: muted halo hexagon + the accent ring inside
//     it, the pixel form of the old banner's decor field;
//   • the section name in caps at y=150, directly above the frame.
//
// Accent hues come from SECTION_RAMP, whose values are RAMP steps only. The
// site's own teal/magenta tokens are not on the eight-step ramp, so the
// quantiser would snap them to whichever neighbour is nearest and two sections
// would come out the same colour. A section missing from the map falls back to
// the brand accent.
//
// Text is gated before it is drawn: `fits()` throws if a string would leave the
// column it owns, and every string is coverage-checked, so a label with a glyph
// the bitmap font lacks fails here instead of shipping a hole.
//
// Font gap, composed not patched: lib/pixel-font.mjs carries OVER rows for Й/Ё
// but no base glyph for either (the font is owned elsewhere and is not edited
// here). `drawText` therefore paints Й/Ё as И/Е plus the OVER row the font
// already ships. When the font gains the glyphs, the `ch in GLYPHS` branch
// takes over automatically.
//
// Run: bun run og:sections
// Not wired into the build — run manually when the registry changes; commit the PNGs.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SECTIONS, sectionOgPath } from '../src/lib/sections.ts';
import { ICON } from '../src/lib/icons.ts';
import { hexPoints, hexPointsFlat } from '../src/lib/brand.ts';
import {
  GLYPHS,
  OVER_ROWS,
  assertCovered,
  glyphRects,
  measure,
} from './lib/pixel-font.mjs';
import { ACCENT, INK, MUTED, RAMP, SS, SURFACE, gridOf, renderPixelBanner } from './lib/pixel-og.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const GRID = gridOf(5); // 240x126 cells, one cell = 5px
const { b, w, h } = GRID;

/** px on the 1200x630 canvas -> supersampled user units */
const S = (v) => Math.round((v / b) * SS);
/** px -> whole cell, in supersampled user units */
const C = (v) => Math.round(v / b) * SS;
const R = (x, y, rw, rh, fill) =>
  `<rect x="${C(x)}" y="${C(y)}" width="${C(rw)}" height="${C(rh)}" fill="${fill}"/>`;
/** Bitmap text takes its origin at the TOP cell; the layout numbers are baselines. */
const top = (baseline, size = 1) => baseline - 7 * size * b;
const fits = (text, x, maxX, size, gap = 0) => {
  const px = x + (measure(text) + gap * (text.length - 1)) * size * b;
  if (px > maxX) throw new Error(`"${text}" is ${Math.round(px)}px, only ${maxX - x} available`);
};
const scalePoints = (points, factor) =>
  points
    .split(' ')
    .map((p) => p.split(',').map((v) => Math.round(Number(v) * factor)).join(','))
    .join(' ');

// --- Layout, shared by both locales -----------------------------------------
const PANEL = { x: 56, y: 196, w: 692, h: 302 };
const NAME = 'Nikita Boyarkin';
const ROLE = 'PRODUCT / DATA ANALYST';
const SITE_URL = 'NIKITABOYARKIN.GITHUB.IO';
const LOGO = { cx: 113.5, cy: 101.5, r: 52.9 };
// The right-hand cell: the old banner's halo + accent ring, pixelated.
const DECOR = { cx: 962, cy: 336, haloR: 150, ringR: 66 };
// Section icon stage: a 240px box (48 cells) centred in the panel.
const ICON_BOX = 240;
const ICON_SCALE = ((ICON_BOX / b) * SS) / 24; // user units per icon unit
const ICON_STROKE = SS / ICON_SCALE; // one cell wide

// Sections map onto four legible ramp steps. RAMP[3] (MUTED) is deliberately
// excluded: it is the frame colour, so an accent on it would vanish into the
// panel it is meant to stand against; RAMP[4]/[6] are half-tones that a
// one-cell rule and a 5px caption cannot carry.
const SECTION_RAMP = {
  home: ACCENT,
  navigation: RAMP[0],
  projects: ACCENT,
  demos: RAMP[0],
  hire: RAMP[2],
  about: INK,
  glossary: RAMP[2],
  graph: RAMP[0],
  talks: INK,
  library: RAMP[2],
  writing: ACCENT,
  explorer: RAMP[0],
  topics: RAMP[2],
  'repo-audit': INK,
};

// --- Bitmap text with the Й/Ё composition described in the header -----------
const COMPOSED = { Й: 'И', Ё: 'Е' };

/** One 5-cell row of the OVER table as merged `<rect>` runs. */
function rowRects(bits, x, y, scale, fill) {
  const out = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '#') continue;
    let j = i;
    while (j < bits.length && bits[j] === '#') j++;
    out.push(`<rect x="${x + i * scale}" y="${y}" width="${(j - i) * scale}" height="${scale}" fill="${fill}"/>`);
    i = j - 1;
  }
  return out;
}

/** Throws on a character neither the font nor the composition can paint. */
function assertPaintable(text) {
  for (const ch of String(text)) {
    if (!(ch in GLYPHS) && !(ch in COMPOSED))
      throw new Error(
        `pixel font: no glyph for ${JSON.stringify(ch)} (U+${ch.codePointAt(0).toString(16).toUpperCase()})`,
      );
  }
}

/** Same advance rules as pixel-font's glyphRects, plus the Й/Ё composition. */
function drawText(text, x0, y0, { scale, fill, advanceGap = 0 } = {}) {
  const out = [];
  let pen = x0;
  for (const ch of String(text)) {
    if (ch in GLYPHS) {
      out.push(...glyphRects(ch, pen, y0, { scale, fill, advanceGap }));
    } else {
      out.push(...glyphRects(COMPOSED[ch], pen, y0, { scale, fill, advanceGap }));
      const over = OVER_ROWS[ch];
      if (over) out.push(...rowRects(over, pen, y0 - scale, scale, fill));
    }
    pen += (measure(ch) + (ch === ' ' ? 0 : advanceGap)) * scale;
  }
  return out.join('');
}

const T = (text, x, y, size, fill, gap = 0) =>
  drawText(text, C(x), C(y), { scale: size * SS, fill, advanceGap: gap });

// --- Gates: fixed strings first ---------------------------------------------
for (const text of [NAME, ROLE, SITE_URL, 'NB']) assertCovered(text);
fits(NAME, 186, 940, 2);
fits(ROLE, 186, 940, 1, 1);
fits(SITE_URL, 56, 1150, 1, 1);

function buildSvg(section, locale, accent) {
  const label = section.label[locale].toUpperCase();
  assertPaintable(label);
  // The caption is gated against the panel it sits on, not the canvas edge.
  fits(label, PANEL.x, PANEL.x + PANEL.w, 1, 1);

  const glyph = ICON[section.icon];
  if (!glyph) throw new Error(`section "${section.key}": unknown icon "${section.icon}"`);

  const iconX = PANEL.x + (PANEL.w - ICON_BOX) / 2;
  const iconY = PANEL.y + (PANEL.h - ICON_BOX) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * SS}" height="${h * SS}" viewBox="0 0 ${w * SS} ${h * SS}">
  <rect width="${w * SS}" height="${h * SS}" fill="${SURFACE}"/>
  ${R(0, 0, 1200, b, accent)}
  <rect x="${S(PANEL.x)}" y="${S(PANEL.y)}" width="${S(PANEL.w)}" height="${S(PANEL.h)}" fill="none" stroke="${MUTED}" stroke-width="${S(b)}"/>
  <g transform="translate(${C(iconX)} ${C(iconY)}) scale(${ICON_SCALE})" fill="none" stroke="${INK}" color="${INK}" stroke-width="${ICON_STROKE}" stroke-linecap="round" stroke-linejoin="round" shape-rendering="crispEdges">${glyph}</g>
  <polygon points="${scalePoints(hexPoints(DECOR.cx, DECOR.cy, DECOR.haloR), SS / b)}" fill="none" stroke="${MUTED}" stroke-width="${S(b)}"/>
  <polygon points="${scalePoints(hexPoints(DECOR.cx, DECOR.cy, DECOR.ringR), SS / b)}" fill="${accent}"/>
  <polygon points="${scalePoints(hexPoints(DECOR.cx, DECOR.cy, DECOR.ringR - b * 1.6), SS / b)}" fill="${SURFACE}"/>
  <polygon points="${scalePoints(hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r), SS / b)}" fill="${accent}"/>
  <polygon points="${scalePoints(hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r - b * 1.6), SS / b)}" fill="${SURFACE}"/>
  ${glyphRects('NB', C(LOGO.cx - b * 5), C(LOGO.cy - b * 3.5), { scale: SS, fill: INK }).join('')}
  ${T(NAME, 186, top(82, 2), 2, INK)}
  ${T(ROLE, 186, 96, 1, INK, 1)}
  ${R(186, 140, 110, 3, accent)}
  ${T(label, PANEL.x, 150, 1, INK, 1)}
  ${T(SITE_URL, PANEL.x, 550, 1, INK, 1)}
</svg>`;
}

let made = 0;
for (const locale of ['ru', 'en']) {
  for (const section of SECTIONS) {
    const accent = SECTION_RAMP[section.key] ?? ACCENT;
    const rel = sectionOgPath(section.key, locale);
    const { bytes } = renderPixelBanner(buildSvg(section, locale, accent), GRID, join(ROOT, 'public', rel));
    made++;
    console.log(`  OK  ${rel.split('/').pop()} — ${(bytes / 1024).toFixed(0)} KB`);
  }
}

console.log(`\nGenerated ${made} pixel section OG image(s) → public/images/og/`);
