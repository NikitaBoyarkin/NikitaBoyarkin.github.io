// Per-section OG banner generator.
// Renders one 1200x630 cream banner per entry in src/lib/sections.ts, in each
// locale, and writes it to the exact path sectionOgPath() returns, so the
// registry and the files on disk cannot drift apart. Only the label is painted
// as text; it comes from the registry, locale-resolved (`-en` suffix on the EN
// files). The `description` field is deliberately unused — see below.
//
// Design: graphic-first, not a text block. The hero is the section's OWN icon —
// `ICON[section.icon]` from src/lib/icons.ts, a 24x24 stroke glyph — scaled 8x
// to a 192px mark and set left, with the site's honeycomb lattice and a few
// faint outlined hexes as the field around it. Text shrinks to the uppercase
// label and the URL footer with its coral rule. No description sentence.
// Palette comes from src/lib/brand.ts only, so no brand hex lives here.
//
// Composition is crop-safe: /navigation/ shows the banner in an aspect-ratio
// 2/1 box with object-fit: cover, which trims the top and bottom of the 630-high
// canvas. The glyph (y 152–344) and the label (baseline 406) sit inside the
// central band, so neither can be clipped by the card.
//
// The stroke-width below is pre-scale: the transform multiplies it. 0.45 x 8
// lands at ~3.6px, inside the 3–4px band the 192px glyph needs to read as a
// drawing rather than as a thick outline.
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

// Hero glyph: a 24x24 icon scaled to a 192px mark, box at (80,152)-(272,344).
const GLYPH = { size: 192, x: MARGIN, y: 152, stroke: 0.45 };

// Two text pieces only: the uppercase label under the glyph, the URL footer.
const LABEL = { size: 26, weight: 700, tracking: 6, y: 406 };
const FOOTER = { size: 24, weight: 500, ruleY: 500, textY: 548, ruleW: 120 };

// Faint outlined hexes in the right-hand field — the same language as
// generate-og.mjs, placed clear of the glyph box (x <= 272).
const HEXES = [
  { cx: 1000, cy: 176, r: 64 },
  { cx: 866, cy: 300, r: 30 },
  { cx: 1054, cy: 442, r: 44 },
];

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
    ${honeycombPattern({ color: INK, opacity: 0.1 })}
  </defs>

  <rect width="1200" height="630" fill="${SURFACE}"/>
  ${honeycombLayer()}

  <!-- decorative hexagons, same language as the other banners -->
  <g fill="none" stroke="${INK}" stroke-width="2" opacity="0.14">
    ${HEXES.map((h) => `<polygon points="${hexPoints(h.cx, h.cy, h.r)}"/>`).join('\n    ')}
  </g>

  <!-- hero glyph: the section's own icon, scaled into a 192px mark -->
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
