// Per-post branded OG image generator.
// Reads src/content/posts/*.md frontmatter, renders a 1200x630 branded SVG
// per post, and converts it to PNG (+ a WebP sibling) into public/images/og/.
// Run: bun run og
// Not wired into the build — run manually when posts change; commit the PNGs.
//
// Palette: this is the BLUE marketing surface — BRAND_BLUE / ACCENT_ON_BLUE /
// CREAM, the same regime as portfolio-banner-v2 and portfolio-graph-v2, so all
// OG previews read as one series. Every hex comes from src/lib/brand.ts.
// MUTED is the one local tint (cream dimmed toward the blue) and mirrors
// generate-graph-og.mjs.
//
// Fonts: Cormorant 600 for the post title, Inter for all service text — the
// families the site ships, vendored as static TTF in scripts/og-fonts/ and
// resolved through FONTCONFIG_FILE + PANGOCAIRO_BACKEND=fc (see
// scripts/lib/og-render.mjs for why the second var is required on macOS).
// Requires `rsvg-convert` (librsvg) and `cwebp` on PATH.
//
// AA gate: like the other banners, this script throws if any text token falls
// below its WCAG contrast threshold on the blue surface.

import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ACCENT_ON_BLUE, BRAND_BLUE, CREAM, hexPoints, hexPointsFlat } from '../src/lib/brand.ts';
import { FONT_SANS, FONT_SERIF, assertContrast, esc, renderSvgToPng } from './lib/og-render.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POSTS_DIR = join(ROOT, 'src/content/posts');
const OUT_DIR = join(ROOT, 'public/images/og');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Palette — the blue regime only.
const BLUE = BRAND_BLUE;
const ORANGE = ACCENT_ON_BLUE;
const MUTED = '#bdb5ea'; // secondary text (cream dimmed toward the blue)
const WELL = '#0a0070'; // inset well behind the category pill

// Type sizes. The title steps DOWN as it needs more lines; each step carries
// its own character budget so the block always clears the right margin.
const TITLE_STEPS = [
  { size: 76, chars: 22 },
  { size: 64, chars: 27 },
  { size: 54, chars: 33 },
  { size: 46, chars: 40 },
];

// Naive frontmatter parse — only needs title / category / draft.
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = m[1];
  const get = (key) => {
    const line = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!line) return undefined;
    return line[1].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  };
  return { title: get('title'), category: get('category'), draft: get('draft') };
}

// Word-wrap a title into lines that fit the OG canvas at the given font size.
function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Largest step whose wrap fits in at most 3 lines. Falls back to the smallest
// step, hard-capped, so a pathological title can never overflow the canvas.
function fitTitle(title) {
  for (const step of TITLE_STEPS) {
    const lines = wrap(title, step.chars);
    if (lines.length <= 3) return { ...step, lines };
  }
  const last = TITLE_STEPS[TITLE_STEPS.length - 1];
  return { ...last, lines: wrap(title, last.chars).slice(0, 3) };
}

function buildSvg(title, category) {
  const { size, lines } = fitTitle(title);
  const lineHeight = Math.round(size * 1.08);
  const blockH = lines.length * lineHeight;
  // Optical centre of the free band between the header lockup and the footer.
  const CENTRE = 322;
  const startY = CENTRE - blockH / 2 + size * 0.78;
  const tspans = lines
    .map(
      (ln, i) =>
        `<text x="80" y="${Math.round(startY + i * lineHeight)}" font-family="${FONT_SERIF}" font-size="${size}" font-weight="600" letter-spacing="-1" fill="${CREAM}">${esc(ln)}</text>`,
    )
    .join('\n  ');

  const cat = category || 'article';
  const pillW = Math.max(120, Math.round(cat.length * 12.8) + 48);

  // Logo lockup — geometry mirrors generate-graph-og.mjs / generate-home-og.mjs.
  const LOGO = { cx: 126, cy: 106, r: 46, dy: 11, size: 30 };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" text-rendering="geometricPrecision">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ORANGE}" stop-opacity="0.07"/>
      <stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${CREAM}" stop-opacity="0.05"/>
      <stop offset="1" stop-color="${CREAM}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="${BLUE}"/>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <ellipse cx="420" cy="330" rx="460" ry="215" fill="url(#glow)"/>
  <rect x="0" y="0" width="1200" height="6" fill="${ORANGE}"/>

  <!-- decorative hexagons, same language as the other banners -->
  <g fill="none" stroke="${CREAM}" stroke-width="2" opacity="0.12">
    <polygon points="${hexPoints(1082, 138, 58)}"/>
    <polygon points="${hexPoints(946, 226, 26)}"/>
  </g>

  <!-- logo lockup -->
  <polygon points="${hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r)}" fill="none" stroke="${ORANGE}" stroke-width="4.2"/>
  <text x="${LOGO.cx}" y="${LOGO.cy + LOGO.dy}" font-family="${FONT_SANS}" font-size="${LOGO.size}" font-weight="700" fill="${CREAM}" text-anchor="middle">NB</text>

  <!-- category pill, inset well -->
  <rect x="196" y="84" width="${pillW}" height="44" rx="22" fill="${WELL}"/>
  <rect x="196.5" y="84.5" width="${pillW - 1}" height="43" rx="22" fill="none" stroke="${CREAM}" stroke-opacity="0.14" stroke-width="1"/>
  <text x="220" y="113" font-family="${FONT_SANS}" font-size="22" font-weight="600" fill="${CREAM}">${esc(cat)}</text>

  ${tspans}

  <!-- identity footer -->
  <rect x="80" y="486" width="110" height="3" fill="${ORANGE}"/>
  <text x="80" y="528" font-family="${FONT_SANS}" font-size="28" font-weight="600" fill="${CREAM}">Nikita Boyarkin</text>
  <text x="80" y="558" font-family="${FONT_SANS}" font-size="20" font-weight="500" fill="${MUTED}">Data / Product Analyst</text>
  <text x="1120" y="558" font-family="${FONT_SANS}" font-size="20" font-weight="500" fill="${CREAM}" text-anchor="end">nikitaboyarkin.github.io</text>
</svg>`;
}

// The AA gate (REQ-03 pattern). Runs once — the token set is static, only the
// title text varies, and Cormorant at every step is large text.
assertContrast(
  BLUE,
  [
    { name: 'title', color: CREAM, size: TITLE_STEPS.at(-1).size, weight: 600 },
    { name: 'category pill', color: CREAM, size: 22, weight: 600 },
    { name: 'logo', color: CREAM, size: 30, weight: 700 },
    { name: 'name', color: CREAM, size: 28, weight: 600 },
    { name: 'role', color: MUTED, size: 20, weight: 500 },
    { name: 'url', color: CREAM, size: 20, weight: 500 },
    { name: 'graphic: orange rule / ring / hexes', color: ORANGE, decorative: true },
  ],
  'post OG',
);

/** WebP sibling for the lazy <picture> previews — PNG stays for OG meta tags. */
function toWebp(pngPath) {
  const webpPath = pngPath.replace(/\.png$/, '.webp');
  const res = spawnSync('cwebp', ['-quiet', '-q', '82', pngPath, '-o', webpPath], { encoding: 'utf8' });
  if (res.status !== 0) return res.stderr || res.stdout || 'cwebp failed';
  return null;
}

const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
let made = 0;
const errors = [];

for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  const text = readFileSync(join(POSTS_DIR, file), 'utf8');
  const fm = parseFrontmatter(text);
  if (fm.draft === 'true') continue;
  if (!fm.title) {
    errors.push(`${slug}: no title`);
    continue;
  }
  const pngPath = join(OUT_DIR, `${slug}.png`);
  renderSvgToPng(buildSvg(fm.title, fm.category), pngPath, { tmpName: `og-${slug}` });
  const webpErr = toWebp(pngPath);
  if (webpErr) errors.push(`${slug}: ${webpErr}`);
  else {
    made++;
    console.log(`  OK  ${slug}.png + .webp`);
  }
}

console.log(`\nGenerated ${made} OG image(s) → public/images/og/`);
if (errors.length) {
  console.error('Errors:\n' + errors.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
