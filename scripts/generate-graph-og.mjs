// Homepage knowledge-graph OG banner generator (v2).
// Renders a 1200x630 branded SVG: the left side carries a compact identity
// header over the REAL content graph (same builder + build-time layout as
// /graph/ and /graph.json), the right side is the hexagon-clipped portrait.
// Converts it to PNG via rsvg-convert into public/images/og/portfolio-graph-v2.png.
//
// Single source of truth: imports buildGraph / layoutRadial / TOPICS and the
// shared visual tokens straight from src/lib, so the preview can never drift
// from the graph the site renders.
// Palette matches the homepage banner (portfolio-banner-v2.png): the cream
// picture surface, royal-blue ink and burnt-coral accent come from
// src/lib/brand.ts. Node colours are the site's own section palette
// (GRAPH_SECTION_COLORS), adapted only where a standalone SVG cannot resolve a
// CSS token or where the cream sheet needs a darker tint.
//
// Fonts: identity name is Cormorant, all service text is Inter — the same
// families the site ships. They are vendored as static TTF in scripts/og-fonts/
// and resolved through FONTCONFIG_FILE + PANGOCAIRO_BACKEND=fc (see
// scripts/lib/og-render.mjs for why the second var is required on macOS).
// Requires `rsvg-convert` (librsvg 2.62.3) on PATH.
//
// Readability pass below (degree filter, edge dimming, hub halos) is
// PRESENTATION-ONLY: it shapes the still image and never touches the graph
// data the site renders.
//
// Run: bun run og:graph
// Not wired into the build — run manually after content changes; commit the PNG.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { buildGraph } from '../src/lib/graph.ts';
import { layoutRadial } from '../src/lib/graph-layout.ts';
import { TOPICS } from '../src/lib/topics.ts';
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
const CONTENT = join(ROOT, 'src/content');
const OUT = join(ROOT, 'public/images/og/portfolio-graph-v2.png');
const PORTRAIT = join(ROOT, 'public/images/00_profile.jpg');

// --- Palette — brand tokens only; the node tints are alphas of those tokens. ---
const SURFACE = CREAM_SURFACE; // cream picture surface
const INK = BANNER_INK; // titles, body, labels
const MUTED = BANNER_MUTED; // legend labels
const ACCENT = BANNER_ACCENT; // rings, rules, hub halos

// --- Load the RU collections from disk (the same set graph-data.ts feeds
// buildGraph) by parsing frontmatter with the `yaml` package. ---
function loadCollection(name, { dropDrafts = true } = {}) {
  const dir = join(CONTENT, name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const data = m ? parseYaml(m[1]) || {} : {};
      return { id: f, data };
    })
    .filter((e) => !dropDrafts || !e.data.draft);
}

const graph = buildGraph({
  projects: loadCollection('projects'),
  posts: loadCollection('posts'),
  parts: loadCollection('volta-parts'),
  // Unfiltered, mirroring graph-data.ts: the site's graph is built from the
  // whole glossary collection, so a draft-flagged term still has a node.
  glossary: loadCollection('glossary', { dropDrafts: false }),
  topics: TOPICS,
  lang: 'ru',
});

// --- PRESENTATION-ONLY readability filter. ---
// Degree is computed from the untouched graph, then dangling leaves
// (degree <= 1: nodes with a single link) are dropped from the STILL IMAGE
// only. buildGraph / layoutRadial / TOPICS stay untouched — the site and
// /graph.json keep rendering the full set.
const degree = new Map();
for (const l of graph.links) {
  degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
  degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
}
const MIN_DEGREE = 2;
const kept = graph.nodes.filter((n) => (degree.get(n.id) ?? 0) >= MIN_DEGREE);
const keptIds = new Set(kept.map((n) => n.id));
// Filter BEFORE the layout: the radial packer assigns ring slots from the node
// list it is handed, so removing nodes afterwards would leave holes in the rings.
const filtered = {
  nodes: kept,
  links: graph.links.filter((l) => keptIds.has(l.source) && keptIds.has(l.target)),
};

// The site's own layout: root at the centre, everything else packed into rings
// by hop distance from it. Sized to the panel's 2:1 aspect so the rings fill it
// instead of letterboxing inside a square world.
const WORLD = { w: 760, h: 380 };
const radial = layoutRadial(filtered, {
  width: WORLD.w,
  height: WORLD.h,
  minArc: 26,
  ringStep: 46,
  startRadius: 78,
});
// The panel is 2:1 but the rings are circles, so a round graph leaves half the
// panel empty. Stretching x about the centre turns the rings into wide ellipses
// and spends that width — vertical spacing, which is the scarce axis, is untouched.
const STRETCH_X = 1.9;
const cwx = WORLD.w / 2;
const laid = {
  ...radial,
  nodes: radial.nodes.map((n) => ({ ...n, x: cwx + (n.x - cwx) * STRETCH_X })),
};
const visible = laid.nodes;

// --- Fit the laid-out world to the panel. Full extents, not percentiles: the
// outermost ring has to stay whole, and cropping it would cut nodes off the
// circle. ---
const PANEL = { x: 56, y: 196, w: 692, h: 302 };
const PAD = 10; // world units around the graph
const fxs = visible.map((n) => n.x);
const fys = visible.map((n) => n.y);
const minX = Math.min(...fxs) - PAD;
const maxX = Math.max(...fxs) + PAD;
const minY = Math.min(...fys) - PAD;
const maxY = Math.max(...fys) + PAD;
const bw = maxX - minX;
const bh = maxY - minY;
const scale = Math.min(PANEL.w / bw, PANEL.h / bh);
const tx = PANEL.x + (PANEL.w - bw * scale) / 2 - minX * scale;
const ty = PANEL.y + (PANEL.h - bh * scale) / 2 - minY * scale;

// --- pixel composition: 240x126 cells, one cell per node --------------------
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
const fits = (text, x, maxX, size, gap = 0) => {
  const px = x + (measure(text) + gap * (text.length - 1)) * size * b;
  if (px > maxX) throw new Error(`"${text}" is ${Math.round(px)}px, only ${maxX - x} available`);
};

// The site's teal and magenta are not on the eight-step ramp, so the quantiser
// would snap them to whichever neighbour is nearest and two sections would come
// out the same colour. An explicit map says which ramp step each section gets.
const SECTION_RAMP = {
  root: RAMP[0],
  projects: ACCENT,
  articles: INK,
  topic: MUTED,
  glossary: RAMP[6],
};

const nodeMarks = visible
  .map((n) => {
    const n0 = SECTION_RAMP[n.section] ?? RAMP[0];
    return R(tx + n.x * scale, ty + n.y * scale, b, b, n0);
  })
  .join('');

// --- portrait hexagon: a filled accent polygon with the photo clipped to a
// smaller one, so the ring is a hard band instead of a stroked edge
const PC = { cx: 975, cy: 305, r: 232 };
const HEX_RING = hexPoints(PC.cx, PC.cy, PC.r);
const HEX_PHOTO = hexPoints(PC.cx, PC.cy, PC.r - 7);
// The photo box has to reach the hexagon's left flank at x=743, otherwise the
// filled accent polygon shows through as a coral band inside the frame.
const PORTRAIT_BOX = { x: 735, y: 20, w: 490, h: 600 };
const LOGO = { cx: 113.5, cy: 101.5, r: 52.9 };
const portraitData = `data:image/jpeg;base64,${readFileSync(PORTRAIT).toString('base64')}`;

const scalePoints = (points, factor) =>
  points
    .split(' ')
    .map((p) => p.split(',').map((v) => Math.round(Number(v) * factor)).join(','))
    .join(' ');

// --- identity type. Each string is gated against the column it owns, so a
// string that does not fit fails here instead of overprinting the portrait.
const NAME = 'Nikita Boyarkin';
const ROLE = 'PRODUCT / DATA ANALYST';
const LABEL = 'ГРАФ КОНТЕНТА';
const SITE_URL = 'NIKITABOYARKIN.GITHUB.IO';
fits(NAME, 186, 940, 2);
fits(ROLE, 186, 940, 1, 1);
fits(LABEL, 56, 860, 1, 1);
fits(SITE_URL, 56, 1150, 1, 1);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w * SS}" height="${h * SS}" viewBox="0 0 ${w * SS} ${h * SS}">
  <defs>
    <clipPath id="hexPhoto"><polygon points="${scalePoints(HEX_PHOTO, SS / b)}"/></clipPath>
    <clipPath id="graphPanel"><rect x="${S(PANEL.x)}" y="${S(PANEL.y)}" width="${S(PANEL.w)}" height="${S(PANEL.h)}"/></clipPath>
  </defs>
  <rect width="${w * SS}" height="${h * SS}" fill="${SURFACE}"/>
  ${R(0, 0, 1200, b, ACCENT)}
  <rect x="${S(PANEL.x)}" y="${S(PANEL.y)}" width="${S(PANEL.w)}" height="${S(PANEL.h)}" fill="none" stroke="${MUTED}" stroke-width="${S(b)}"/>
  <g clip-path="url(#graphPanel)">${nodeMarks}</g>
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
console.log(`OK ${OUT} — ${GRID.w}x${GRID.h} cells, ${(bytes / 1024).toFixed(0)} KB, ${visible.length} nodes`);
