// Per-section OG banner generator.
// Renders one 1200x630 cream banner per entry in src/lib/sections.ts, in each
// locale, and writes it to the exact path sectionOgPath() returns, so the
// registry and the files on disk cannot drift apart. Only the label is painted
// as text; it comes from the registry, locale-resolved (`-en` suffix on the EN
// files). The `description` field is deliberately unused — see below.
//
// Design: graphic-first, not a text block. The hero is the section's OWN icon —
// `ICON[section.icon]` from src/lib/icons.ts, a 24x24 stroke glyph — scaled
// 8.33x to a 200px mark and set left, with the site's honeycomb lattice and a
// right-hand cell (halo hexagon, accent ring, three satellites) as the field
// that balances it. Text shrinks to the uppercase label and the URL footer with
// its coral rule. No description sentence.
// Palette comes from src/lib/brand.ts only, so no brand hex lives here.
//
// Composition is crop-safe by arithmetic, not by eye. /navigation/ shows the
// banner in an aspect-ratio 2/1 box under `object-fit: cover`: the box is
// *wider* than the 1200x630 canvas (1.905), so cover scales to the box width
// and the canvas gives up (630 - 600) / 2 = 15px at the top and 15px at the
// bottom. The visible band is y 15..615 at full width — no horizontal trim.
// CROP below pins that band and the gate under it throws if any mark leaves it.
//
// Balance: the left column is the mark plus three baselines (label, rule, URL).
// The right field repeats the home banner's portrait framing — a faint halo
// hexagon with an accent ring inside it — plus three faint satellites, so the
// empty half reads as a cell of the lattice rather than as dead space. The ring
// spans 132px against the glyph's 200px, so the mark still leads the frame.
//
// The stroke-width below is pre-scale: the transform multiplies it. 0.45 x
// 8.333 lands at ~3.75px, inside the 3–4px band the 200px glyph needs to read
// as a drawing rather than as a thick outline.
//
// Fonts: the label and footer are Inter — vendored as static TTF in
// scripts/og-fonts/ and resolved through FONTCONFIG_FILE +
// PANGOCAIRO_BACKEND=fc (see scripts/lib/og-render.mjs for why the second var
// is required on macOS). Requires `rsvg-convert` (librsvg) on PATH.
//
// Iteration follows the SECTIONS order, so a re-run is deterministic and the
// only diff after a label edit is the banner it affected.
//
// Run: bun run og:sections
// Not wired into the build — run manually when the registry changes; commit the PNGs.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SECTIONS, sectionOgPath } from '../src/lib/sections.ts';
import { ICON } from '../src/lib/icons.ts';
import { BANNER_ACCENT, BANNER_INK, CREAM_SURFACE, hexPoints } from '../src/lib/brand.ts';
import {
  FONT_SANS,
  assertContrast,
  esc,
  honeycombLayer,
  honeycombPattern,
  renderSvgToPng,
} from './lib/og-render.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const SURFACE = CREAM_SURFACE;
const INK = BANNER_INK;
const ACCENT = BANNER_ACCENT;

const MARGIN = 80;

// The rows the /navigation/ card keeps (see the header note). No mark may
// leave this band, and the gate below enforces it.
const CROP = { top: 15, bottom: 615 };

// Hero glyph: a 24x24 icon scaled to a 200px mark, box at (80,132)-(280,332).
const GLYPH = { size: 200, x: MARGIN, y: 132, stroke: 0.45 };

// Two text pieces only: the uppercase label under the glyph, the URL footer.
const LABEL = { size: 26, weight: 700, tracking: 6, y: 392, maxRight: 620 };
const FOOTER = { size: 24, weight: 500, ruleY: 448, textY: 496, ruleW: 120 };

// Right field: a lattice cell — the home banner's halo + accent ring framing,
// plus three faint satellites. Sits right of the label's widest case and above
// the card crop at every point.
const DECOR = {
  cx: 962,
  cy: 336,
  haloR: 150,
  ringR: 66,
  ringStroke: 3.5,
  satellites: [
    { cx: 1120, cy: 176, r: 32 },
    { cx: 1124, cy: 502, r: 28 },
    { cx: 748, cy: 168, r: 24 },
  ],
};

// Crop gate: every mark, in canvas coordinates, against the visible band.
const hexBox = (cx, cy, r) => {
  const dx = (r * Math.sqrt(3)) / 2;
  return { x0: cx - dx, x1: cx + dx, y0: cy - r, y1: cy + r };
};
const MARKS = [
  ['glyph', { x0: GLYPH.x, x1: GLYPH.x + GLYPH.size, y0: GLYPH.y, y1: GLYPH.y + GLYPH.size }],
  ['label', { x0: MARGIN, x1: LABEL.maxRight, y0: LABEL.y - LABEL.size, y1: LABEL.y }],
  ['footer rule', { x0: MARGIN, x1: MARGIN + FOOTER.ruleW, y0: FOOTER.ruleY, y1: FOOTER.ruleY + 3 }],
  ['footer url', { x0: MARGIN, x1: LABEL.maxRight, y0: FOOTER.textY - FOOTER.size, y1: FOOTER.textY }],
  ['decor halo', hexBox(DECOR.cx, DECOR.cy, DECOR.haloR)],
  ['decor ring', hexBox(DECOR.cx, DECOR.cy, DECOR.ringR)],
  ...DECOR.satellites.map((s, i) => [`decor satellite ${i + 1}`, hexBox(s.cx, s.cy, s.r)]),
];
for (const [name, b] of MARKS) {
  if (b.x0 < 0 || b.x1 > 1200 || b.y0 < CROP.top || b.y1 > CROP.bottom)
    throw new Error(`${name} leaves the 2:1 card crop (y ${CROP.top}..${CROP.bottom}): ${JSON.stringify(b)}`);
  if (name.startsWith('decor') && b.x0 <= LABEL.maxRight)
    throw new Error(`${name} collides with the label column: x0=${b.x0} <= ${LABEL.maxRight}`);
}

assertContrast(
  SURFACE,
  [
    { name: 'label', color: INK, size: LABEL.size, weight: LABEL.weight },
    { name: 'url', color: INK, size: FOOTER.size, weight: FOOTER.weight },
    { name: 'graphic: accent rule', color: ACCENT, decorative: true },
  ],
  'section OG banner',
);

function buildSvg(section, locale) {
  const label = section.label[locale].toUpperCase();
  const glyph = ICON[section.icon];
  if (!glyph) throw new Error(`section "${section.key}": unknown icon "${section.icon}"`);

  const scale = GLYPH.size / 24;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" text-rendering="geometricPrecision">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.07"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    ${honeycombPattern({ color: INK, opacity: 0.1 })}
  </defs>

  <rect width="1200" height="630" fill="${SURFACE}"/>
  ${honeycombLayer()}
  <ellipse cx="${DECOR.cx}" cy="${DECOR.cy}" rx="250" ry="200" fill="url(#glow)"/>

  <!-- right field: a lattice cell, halo hexes then the accent ring inside it -->
  <g fill="none" stroke="${INK}" stroke-width="2" opacity="0.15">
    <polygon points="${hexPoints(DECOR.cx, DECOR.cy, DECOR.haloR)}"/>
    ${DECOR.satellites.map((s) => `<polygon points="${hexPoints(s.cx, s.cy, s.r)}"/>`).join('\n    ')}
  </g>
  <polygon points="${hexPoints(DECOR.cx, DECOR.cy, DECOR.ringR)}" fill="none" stroke="${ACCENT}" stroke-width="${DECOR.ringStroke}" opacity="0.78"/>

  <!-- hero glyph: the section's own icon, scaled into a 200px mark -->
  <g transform="translate(${GLYPH.x} ${GLYPH.y}) scale(${scale})" fill="none" stroke="${INK}" color="${INK}" stroke-width="${GLYPH.stroke}" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>

  <text x="${MARGIN}" y="${LABEL.y}" font-family="${FONT_SANS}" font-size="${LABEL.size}" font-weight="${LABEL.weight}" letter-spacing="${LABEL.tracking}" fill="${INK}">${esc(label)}</text>

  <rect x="${MARGIN}" y="${FOOTER.ruleY}" width="${FOOTER.ruleW}" height="3" fill="${ACCENT}"/>
  <text x="${MARGIN}" y="${FOOTER.textY}" font-family="${FONT_SANS}" font-size="${FOOTER.size}" font-weight="${FOOTER.weight}" fill="${INK}">nikitaboyarkin.github.io</text>
</svg>`;

  return { svg };
}

let made = 0;
for (const locale of ['ru', 'en']) {
  for (const section of SECTIONS) {
    const { svg } = buildSvg(section, locale);
    const rel = sectionOgPath(section.key, locale);
    renderSvgToPng(svg, join(ROOT, 'public', rel), { tmpName: `og-section-${section.key}-${locale}` });
    made++;
    console.log(`  OK  ${rel.split('/').pop()}`);
  }
}

console.log(`\nGenerated ${made} section OG image(s) → public/images/og/`);
