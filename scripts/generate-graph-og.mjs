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

import {
  buildGraph,
  GRAPH_EDGE_STYLE,
  LINK_THICKNESS,
  NODE_SIZE,
} from '../src/lib/graph.ts';
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
const CONTENT = join(ROOT, 'src/content');
const OUT = join(ROOT, 'public/images/og/portfolio-graph-v2.png');
const PORTRAIT = join(ROOT, 'public/images/00_profile.jpg');

// --- Palette — brand tokens only; the node tints are alphas of those tokens. ---
const SURFACE = CREAM_SURFACE; // cream picture surface
const INK = BANNER_INK; // titles, body, labels
const MUTED = BANNER_MUTED; // legend labels
const ACCENT = BANNER_ACCENT; // rings, rules, hub halos

// Categorical node paints — the site's own section palette
// (GRAPH_SECTION_COLORS in src/lib/graph.ts), so the banner reads as the same
// graph the page renders. Two adaptations are required and deliberate:
//   • the site's `articles`/`root` are CSS tokens that a standalone SVG cannot
//     resolve, so their light-theme hexes are used here;
//   • cyan/magenta/orange are darkened until they clear the 3:1 graphics floor
//     on the cream sheet (site values sit at 2.2–3.0:1 there).
// Keys are `section`, not `group`: the site paints every volta part as
// «Проекты» too, and a taxonomy hue would break that one-section-per-hue rule.
const SECTION_PAINT = {
  projects: { color: ACCENT, alpha: 1 }, // #b8431f — site #ff4e02, darkened (4.84:1)
  articles: { color: INK, alpha: 1 }, // #1400c3 — the light-theme token itself (10.28:1)
  topic: { color: '#1f7f8e', alpha: 1 }, // site #38b2c4 darkened (4.17:1)
  glossary: { color: '#a63d70', alpha: 1 }, // site #e0609b darkened (5.30:1)
  root: { color: '#0a5f63', alpha: 1 }, // site light #0d7377 darkened (6.60:1)
};
const NODE_FALLBACK = { color: INK, alpha: 1 };

// Edge color + alpha per type. The site styles edges with CSS color-mix();
// a standalone SVG can't, so the same intent is expressed as hex + opacity.
// Explicit `related`/`children` links stay legible; thematic/`shared`/`core`
// edges fade back so the preview reads as structure, not a hairball.
const EDGE_PAINT = {
  related: [ACCENT, 0.38],
  children: [INK, 0.28],
  topic: [INK, 0.07],
  shared: [INK, 0.06],
  core: [ACCENT, 0.08],
};

// Legend entries — the node categories a reader actually sees in the preview,
// resolved against SECTION_PAINT so the swatches match the plotted nodes.
const LEGEND = [
  ['Проекты', SECTION_PAINT.projects],
  ['Статьи', SECTION_PAINT.articles],
  ['Темы', SECTION_PAINT.topic],
  ['Словарь', SECTION_PAINT.glossary],
  ['Ядро', SECTION_PAINT.root],
];

// Anchor labels (REQ-06): tried at 12px, but in the ~500px social preview they
// shrink to ~5px, collide with each other and read as noise over the node
// field. Excluded from the shipped banner — flip to true only for a
// large-format (1200px+) render. Decision recorded in the PRD execution log.
const ANCHOR_LABELS = false;
const ANCHOR_COUNT = 5;

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
const STRETCH_X = 1.45;
const cwx = WORLD.w / 2;
const laid = {
  ...radial,
  nodes: radial.nodes.map((n) => ({ ...n, x: cwx + (n.x - cwx) * STRETCH_X })),
};
const nodeById = new Map(laid.nodes.map((n) => [n.id, n]));

const visible = laid.nodes;
const links = laid.links;

const sectionPaint = (s) => SECTION_PAINT[s] ?? NODE_FALLBACK;
/** `fill` / `fill-opacity` attributes for a node paint, shared by nodes and swatches. */
const paintAttrs = ({ color, alpha }) =>
  `fill="${color}"${alpha < 1 ? ` fill-opacity="${alpha}"` : ''}`;
const edgeEndpoints = (l) => {
  const a = nodeById.get(l.source);
  const b = nodeById.get(l.target);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const r = (b.size || 6) + 2;
  return { x1: a.x, y1: a.y, x2: b.x - (dx / d) * r, y2: b.y - (dy / d) * r };
};
// The rings pack ~88 nodes into a 344px-tall panel, so radii are pulled in
// slightly: at 1.0 the high-degree hubs on the inner ring touch their neighbours.
const RADIUS_BOOST = 0.95;
// Clamp the degree-driven sizes. Uncapped, the collection hubs run ~2.5x a leaf
// and swallow the inner ring they sit on; the floor keeps leaves from vanishing
// in the ~500px social preview.
const MIN_R = 4;
const MAX_R = 12;
const radius = (n) =>
  n.section === 'root'
    ? MAX_R + 2.5 // the centre stays the largest mark on the image
    : Math.min(MAX_R, Math.max(MIN_R, (n.size || 6) * NODE_SIZE * RADIUS_BOOST));

// --- Fit the laid-out world to the panel. Full extents, not percentiles: the
// outermost ring has to stay whole, and cropping it would cut nodes off the
// circle. The length fade dissolves the few long cross-ring links. ---
const PANEL = { x: 56, y: 208, w: 692, h: 344 };
const PAD = 10; // world units around the graph
// Screen-space length (px) past which an edge starts to dissolve (see edgeSvg).
const EDGE_FADE_START = 0.3 * Math.hypot(PANEL.w, PANEL.h);
// How much of its alpha even the longest edge keeps.
const FADE_FLOOR = 0.15;
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

const edgeSvg = links
  .map((l) => {
    const e = edgeEndpoints(l);
    if (!e) return '';
    const [color, alpha] = EDGE_PAINT[l.type] || EDGE_PAINT.related;
    const width = LINK_THICKNESS * (0.6 + 1.6 * (l.weight || 1)) + 0.4;
    const dash = GRAPH_EDGE_STYLE[l.type];
    // Length fade: an edge spanning most of the panel reads as a stray line
    // rather than structure, so long ones dissolve instead of crossing the field.
    // It bottoms out at FADE_FLOOR rather than zero — a node whose every edge
    // vanished (the sparse outer rings) reads as a detached dot, not as a leaf.
    const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) * scale;
    const fade =
      len <= EDGE_FADE_START
        ? 1
        : Math.max(0, 1 - (len - EDGE_FADE_START) / (EDGE_FADE_START * 1.1)) || FADE_FLOOR;
    const effAlpha = alpha * fade;
    if (effAlpha < 0.01) return '';
    return `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="${color}" stroke-opacity="${effAlpha.toFixed(3)}" stroke-width="${width.toFixed(2)}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  })
  .filter(Boolean)
  .join('\n      ');

// Hubs (top nodes by degree) get an accent halo so the eye lands on structure
// instead of counting dots. Every node keeps a surface-coloured hairline: on a
// cream sheet the fills already clear 3:1 on their own, so the stroke's job is
// only to keep overlapping nodes separable from each other.
const hubIds = new Set(
  visible
    .slice()
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, 6)
    .map((n) => n.id),
);

const nodeMark = (n) => {
  const r = radius(n);
  const isRoot = n.section === 'root';
  // The root is the one centre: it always carries the halo (whatever its rank)
  // and a wider surface gap, so it reads as the anchor rather than as one more
  // teal topic dot at the middle.
  const halo = isRoot || hubIds.has(n.id)
    ? `<circle cx="${n.x}" cy="${n.y}" r="${(r + (isRoot ? 5 : 3.5)).toFixed(2)}" fill="none" stroke="${ACCENT}" stroke-opacity="${isRoot ? 0.85 : 0.5}" stroke-width="${isRoot ? 2.2 : 1.6}"/>`
    : '';
  const gap = isRoot ? 2.4 : 1.6;
  return `${halo}<circle cx="${n.x}" cy="${n.y}" r="${r.toFixed(2)}" ${paintAttrs(sectionPaint(n.section))} stroke="${SURFACE}" stroke-width="${gap}"/>`;
};

// Root is painted last so the ring-1 hubs can never sit on top of the centre.
const nodeSvg = [...visible.filter((n) => n.section !== 'root'), ...visible.filter((n) => n.section === 'root')]
  .map(nodeMark)
  .join('\n      ');

// Screen-space anchor labels for the biggest hubs (panel coords, outside the
// world transform, so the type size stays constant).
const anchorSvg = ANCHOR_LABELS
  ? visible
      .slice()
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
      .slice(0, ANCHOR_COUNT)
      .map((n) => {
        const sx = tx + n.x * scale + radius(n) * scale + 5;
        const sy = ty + n.y * scale + 4;
        return `<text x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" font-family="${FONT_SANS}" font-size="12" font-weight="500" fill="${INK}">${esc(n.label)}</text>`;
      })
      .join('\n      ')
  : '';

// Legend as a horizontal row under the graph, each swatch matching a node group.
const LEGEND_Y = 584;
const legendSvg = LEGEND.map(([label, paint], i) => {
  const x = 56 + i * 135;
  return `<circle cx="${x}" cy="${LEGEND_Y - 5}" r="6" ${paintAttrs(paint)}/>
  <text x="${x + 16}" y="${LEGEND_Y}" font-family="${FONT_SANS}" font-size="15" font-weight="500" fill="${MUTED}">${esc(label)}</text>`;
}).join('\n  ');

// Portrait on the right: the same pointy-top hexagon as the fallback banner
// (portfolio-banner-v2.png) so the two read as one series — one geometry from
// brand.ts. Plate R=232, photo clip R=225, orange ring R=228.5 (stroke 7).
const PORTRAIT_C = { cx: 975, cy: 305 };
const TILE_R = 232;
const HEX_HALO = hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, TILE_R);
const HEX_PHOTO = hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, TILE_R - 7);
const HEX_RING = hexPoints(PORTRAIT_C.cx, PORTRAIT_C.cy, TILE_R - 3.5);
// NB brand mark — flat-top hexagon reproducing the former 1.15x lockup.
const LOGO = { cx: 113.5, cy: 101.5, r: 52.9, dy: 12.65 };
// Oversized portrait box so the source photo's hard shoulder cut stays hidden.
const PORTRAIT_BOX = { x: 830, y: 20, w: 390, h: 600 };
// Inlined as a data URI so rsvg-convert resolves it from any cwd.
const portraitData = `data:image/jpeg;base64,${readFileSync(PORTRAIT).toString('base64')}`;

// AA gate (REQ-03): every text token must clear 4.5:1 (3:1 for large text).
// The accent is decorative here — rings, rules, halos, the top bar.
assertContrast(
  SURFACE,
  [
    { name: 'name', color: INK, size: 52, weight: 600 },
    { name: 'role', color: INK, size: 22, weight: 600 },
    { name: 'logo', color: INK, size: 34, weight: 700 },
    { name: 'caption', color: INK, size: 14, weight: 700 },
    { name: 'legend', color: MUTED, size: 15, weight: 500 },
    { name: 'url', color: INK, size: 20, weight: 500 },
    { name: 'graphic: accent ring / rule / halo', color: ACCENT, decorative: true },
  ],
  'graph OG banner',
);

// sRGB composite of `color` at `alpha` over `bg` — the colour the rasteriser
// actually paints for a tinted node or swatch.
const over = (color, alpha, bg) => {
  const fg = hexToRgb(color);
  const base = hexToRgb(bg);
  const mix = fg.map((c, i) => Math.round(c * alpha + base[i] * (1 - alpha)));
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

// The text gate above cannot speak for the node field: a node is a mark, not a
// glyph, so its floor is 3:1 (WCAG 1.4.11) rather than 4.5:1. Assert that floor
// explicitly — a tint that drifts too pale would otherwise fade into the cream
// surface silently, which is exactly the failure this palette flip risks.
//
// Two backgrounds matter: the bare sheet, and the panel's darkest point (the
// vignette's 0.06 stop at the panel edge, which is where the two trimmed margin
// nodes actually sit). A tint is only legible if it clears both.
const PANEL_EDGE = over(INK, 0.06, SURFACE);
const tintWidth = Math.max(...Object.keys(SECTION_PAINT).map((g) => g.length));
for (const [group, paint] of Object.entries(SECTION_PAINT)) {
  for (const [where, bg] of [
    ['surface', SURFACE],
    ['vignette', PANEL_EDGE],
  ]) {
    const flat = over(paint.color, paint.alpha, bg);
    const ratio = contrastRatio(flat, bg);
    const pass = ratio >= 3;
    console.log(
      `[contrast] node:${group.padEnd(tintWidth)}  ${flat}  ${ratio.toFixed(2).padStart(5)}:1  graphic on ${where.padEnd(8)}  ${pass ? 'PASS' : 'FAIL'}`,
    );
    if (!pass) {
      throw new Error(
        `WCAG graphics contrast failed (node:${group} on ${where}): ${ratio.toFixed(2)}:1 < 3:1`,
      );
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630" text-rendering="geometricPrecision">
  <defs>
    <clipPath id="graphPanel">
      <rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="18"/>
    </clipPath>
    <clipPath id="hexPhoto">
      <polygon points="${HEX_PHOTO}"/>
    </clipPath>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0.55" stop-color="${INK}" stop-opacity="0"/>
      <stop offset="1" stop-color="${INK}" stop-opacity="0.06"/>
    </radialGradient>
    ${honeycombPattern({ color: INK, opacity: 0.1 })}
  </defs>

  <rect width="1200" height="630" fill="${SURFACE}"/>
  ${honeycombLayer()}
  <rect x="0" y="0" width="1200" height="6" fill="${ACCENT}"/>

  <!-- graph surface: accent glow + faint ink vignette so the panel reads as a
       recess in the sheet without turning into a shadow on a light surface -->
  <ellipse cx="${PANEL.x + PANEL.w / 2}" cy="${PANEL.y + PANEL.h / 2}" rx="${PANEL.w / 2}" ry="${PANEL.h / 2}" fill="url(#glow)"/>
  <rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="18" fill="url(#vignette)"/>

  <!-- knowledge graph: real build-time positions, presentation-only degree filter -->
  <g clip-path="url(#graphPanel)">
    <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(4)})">
      <g class="edges">
      ${edgeSvg}
      </g>
      <g class="nodes">
      ${nodeSvg}
      </g>
    </g>
    ${anchorSvg}
  </g>
  <rect x="${PANEL.x + 0.5}" y="${PANEL.y + 0.5}" width="${PANEL.w - 1}" height="${PANEL.h - 1}" rx="18" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="1"/>

  <!-- compact identity header, top-left -->
  <polygon points="${hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r)}" fill="none" stroke="${ACCENT}" stroke-width="4.6"/>
  <text x="${LOGO.cx}" y="${LOGO.cy + LOGO.dy}" font-family="${FONT_SANS}" font-size="34.5" font-weight="700" fill="${INK}" text-anchor="middle">NB</text>
  <text x="186" y="104" font-family="${FONT_SERIF}" font-size="52" font-weight="600" letter-spacing="-0.5" fill="${INK}">Nikita Boyarkin</text>
  <text x="186" y="142" font-family="${FONT_SANS}" font-size="22" font-weight="600" fill="${INK}">Product / Data Analyst</text>
  <rect x="186" y="158" width="110" height="3" fill="${ACCENT}"/>

  <text x="56" y="192" font-family="${FONT_SANS}" font-size="14" font-weight="700" letter-spacing="3" fill="${INK}">ГРАФ КОНТЕНТА</text>

  ${legendSvg}

  <text x="56" y="616" font-family="${FONT_SANS}" font-size="20" font-weight="500" fill="${INK}">nikitaboyarkin.github.io</text>

  <!-- portrait: accent halo + clipped photo + accent ring (no plate) -->
  <polygon points="${HEX_HALO}" fill="none" stroke="${ACCENT}" stroke-width="8" opacity="0.14"/>
  <image x="${PORTRAIT_BOX.x}" y="${PORTRAIT_BOX.y}" width="${PORTRAIT_BOX.w}" height="${PORTRAIT_BOX.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#hexPhoto)" xlink:href="${portraitData}" href="${portraitData}"/>
  <polygon points="${HEX_RING}" fill="none" stroke="${ACCENT}" stroke-width="7"/>
</svg>`;

renderSvgToPng(svg, OUT, { tmpName: 'og-graph' });
console.log(`OK ${OUT} (${visible.length}/${laid.nodes.length} nodes, ${links.length} links)`);
