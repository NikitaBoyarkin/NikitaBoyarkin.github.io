// Per-content branded OG image generator.
// Reads src/content/posts/*.md and src/content/projects/*.md frontmatter,
// renders a 1200x630 branded SVG per entry, and converts it to PNG into
// public/images/og/.
// Run: bun run og
// Not wired into the build — run manually when content changes; commit the PNGs.
//
// Two escape hatches, both opt-in:
//
//   1. FORCE (`bun run og --force`). A project that declares `ogImage` owns its
//      card and is skipped, so a routine re-run never clobbers a hand-made
//      banner. Every project declares one, though, which meant the palette flip
//      would have left all 22 project cards on the retired blue surface. With
//      --force the skip is inverted: declared cards are re-rendered too.
//   2. OUTPUT_NAME. The override map below renames the written file for a slug
//      whose frontmatter points somewhere other than `<slug>.png` — today only
//      `volta` (→ volta-neobank-case-study.png). Adding an entry here is the
//      only supported way to break the `<slug>.png` convention; otherwise the
//      frontmatter and the generator drift and the preview 404s.
//
// Palette: the cream picture surface (`CREAM_SURFACE`) with royal-blue ink and
// a burnt-coral accent — the same regime as portfolio-banner-v2 and
// portfolio-graph-v2, so all OG previews read as one series. Every hex comes
// from src/lib/brand.ts; this file holds no brand hex of its own.
//
// Fonts: Cormorant 600 for the post title, Inter for all service text — the
// families the site ships, vendored as static TTF in scripts/og-fonts/ and
// resolved through FONTCONFIG_FILE + PANGOCAIRO_BACKEND=fc (see
// scripts/lib/og-render.mjs for why the second var is required on macOS).
// Requires `rsvg-convert` (librsvg) on PATH.
//
// AA gate: like the other banners, this script throws if any text token falls
// below its WCAG contrast threshold on the cream surface.

import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
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
import {
  FONT_SANS,
  FONT_SERIF,
  assertContrast,
  esc,
  hexToRgb,
  honeycombLayer,
  honeycombPattern,
  renderSvgToPng,
} from './lib/og-render.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POSTS_DIR = join(ROOT, 'src/content/posts');
const PROJECTS_DIR = join(ROOT, 'src/content/projects');
const OUT_DIR = join(ROOT, 'public/images/og');

// Project `track` values are taxonomy keys, not display strings — spell them
// out for the card pill the same way the board's category tabs do.
const TRACK_LABELS = {
  experiments: 'Experiments',
  analytics: 'Analytics',
  product: 'Product',
  engineering: 'Engineering',
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Palette — the cream regime. Aliases only: every value is imported from
// src/lib/brand.ts, so the banner cannot become the only place a hex lives.
const SURFACE = CREAM_SURFACE;
const INK = BANNER_INK; // titles, body, name, URL
const MUTED = BANNER_MUTED; // secondary text (role line)
const ACCENT = BANNER_ACCENT; // rules, rings, hexes, top bar

// Re-render cards that declare their own `ogImage` instead of skipping them.
const FORCE = process.argv.includes('--force');

// Slug → output filename, for the one project whose frontmatter points at a
// name the `<slug>.png` convention would not produce. Keep in sync with
// src/content/projects/*.md (tests/lib/og-images.test.ts binds the target).
const OUTPUT_NAME = {
  volta: 'volta-neobank-case-study.png',
};

// Type sizes. The title steps DOWN as it needs more lines; each step carries
// its own character budget so the block always clears the right margin.
const TITLE_STEPS = [
  { size: 76, chars: 22 },
  { size: 64, chars: 27 },
  { size: 54, chars: 33 },
  { size: 46, chars: 40 },
];

// Naive frontmatter parse — only needs title / category / track / ogImage / draft.
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = m[1];
  const get = (key) => {
    const line = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!line) return undefined;
    return line[1].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  };
  return {
    title: get('title'),
    category: get('category'),
    track: get('track'),
    ogImage: get('ogImage'),
    draft: get('draft'),
  };
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
        `<text x="80" y="${Math.round(startY + i * lineHeight)}" font-family="${FONT_SERIF}" font-size="${size}" font-weight="600" letter-spacing="-1" fill="${INK}">${esc(ln)}</text>`,
    )
    .join('\n  ');

  const cat = category || 'article';
  const pillW = Math.max(120, Math.round(cat.length * 12.8) + 48);

  // Logo lockup — geometry mirrors generate-graph-og.mjs / generate-home-og.mjs.
  const LOGO = { cx: 126, cy: 106, r: 46, dy: 11, size: 30 };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" text-rendering="geometricPrecision">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    ${honeycombPattern({ color: INK, opacity: 0.1 })}
  </defs>

  <rect width="1200" height="630" fill="${SURFACE}"/>
  ${honeycombLayer()}
  <ellipse cx="420" cy="330" rx="460" ry="215" fill="url(#glow)"/>
  <rect x="0" y="0" width="1200" height="6" fill="${ACCENT}"/>

  <!-- decorative hexagons, same language as the other banners -->
  <g fill="none" stroke="${INK}" stroke-width="2" opacity="0.14">
    <polygon points="${hexPoints(1082, 138, 58)}"/>
    <polygon points="${hexPoints(946, 226, 26)}"/>
  </g>

  <!-- logo lockup -->
  <polygon points="${hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r)}" fill="none" stroke="${ACCENT}" stroke-width="4.2"/>
  <text x="${LOGO.cx}" y="${LOGO.cy + LOGO.dy}" font-family="${FONT_SANS}" font-size="${LOGO.size}" font-weight="700" fill="${INK}" text-anchor="middle">NB</text>

  <!-- category pill, inset well: ink at 7% over the surface, ink text on top -->
  <rect x="196" y="84" width="${pillW}" height="44" rx="22" fill="${INK}" fill-opacity="0.07"/>
  <rect x="196.5" y="84.5" width="${pillW - 1}" height="43" rx="22" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="1"/>
  <text x="220" y="113" font-family="${FONT_SANS}" font-size="22" font-weight="600" fill="${INK}">${esc(cat)}</text>

  ${tspans}

  <!-- identity footer -->
  <rect x="80" y="486" width="110" height="3" fill="${ACCENT}"/>
  <text x="80" y="528" font-family="${FONT_SANS}" font-size="28" font-weight="600" fill="${INK}">Nikita Boyarkin</text>
  <text x="80" y="558" font-family="${FONT_SANS}" font-size="20" font-weight="500" fill="${MUTED}">Data / Product Analyst</text>
  <text x="1120" y="558" font-family="${FONT_SANS}" font-size="20" font-weight="500" fill="${INK}" text-anchor="end">nikitaboyarkin.github.io</text>
</svg>`;
}

// The AA gate (REQ-03 pattern). Runs once — the token set is static, only the
// title text varies, and Cormorant at every step is large text.
//
// The category pill is the exception the surface gate cannot speak for: its text
// sits on the 7%-ink well, not on the bare sheet, and that well is *darker* than
// the surface, so it is the stricter background. Both are measured.
const over = (color, alpha, bg) => {
  const fg = hexToRgb(color);
  const base = hexToRgb(bg);
  const mix = fg.map((c, i) => Math.round(c * alpha + base[i] * (1 - alpha)));
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};
const PILL_BG = over(INK, 0.07, SURFACE);

const rows = [
  { name: 'title', color: INK, size: TITLE_STEPS.at(-1).size, weight: 600 },
  { name: 'category pill', color: INK, size: 22, weight: 600, bg: PILL_BG },
  { name: 'logo', color: INK, size: 30, weight: 700 },
  { name: 'name', color: INK, size: 28, weight: 600 },
  { name: 'role', color: MUTED, size: 20, weight: 500 },
  { name: 'url', color: INK, size: 20, weight: 500 },
  { name: 'graphic: accent rule / ring / hexes', color: ACCENT, decorative: true },
];

assertContrast(SURFACE, rows.filter((r) => !r.bg), 'post OG');
assertContrast(
  PILL_BG,
  rows.filter((r) => r.bg).map(({ bg: _bg, ...r }) => r),
  'post OG · category pill',
);

/**
 * Render one card per content file in `dir`. `pill` picks the label for the
 * category badge; `skip` lets a file opt out because it declares its own image.
 *
 * No `cwebp` sibling any more (2026-10-14). The `.webp` next to each `.png`
 * existed for the `<picture>` preview on the blog cards; those previews are gone
 * (see BlogCard.astro), which left 45 files / 2.1 MB in `public/` that no page
 * referenced while `astro build` still copied every one into `dist/`. The `.png`
 * is the `og:image` and stays.
 */
function generate({ dir, pill, skip = () => false }) {
  let made = 0;
  const errors = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const slug = file.replace(/\.md$/, '');
    const fm = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
    if (fm.draft === 'true') continue;
    if (!fm.title) {
      errors.push(`${slug}: no title`);
      continue;
    }
    if (skip(fm)) {
      console.log(`  --  ${slug} (declares its own ogImage)`);
      continue;
    }
    const pngPath = join(OUT_DIR, OUTPUT_NAME[slug] ?? `${slug}.png`);
    renderSvgToPng(buildSvg(fm.title, pill(fm)), pngPath, { tmpName: `og-${slug}` });
    made++;
    console.log(`  OK  ${OUTPUT_NAME[slug] ?? `${slug}.png`}`);
  }
  return { made, errors };
}

// Posts and projects share the og/ namespace; slugs are disjoint today (asserted
// by tests/lib/og-images.test.ts), so a collision cannot silently overwrite.
const postRun = generate({ dir: POSTS_DIR, pill: (fm) => fm.category });
const projectRun = generate({
  dir: PROJECTS_DIR,
  pill: (fm) => TRACK_LABELS[fm.track] ?? 'Project',
  // Every project declares `ogImage` today, so without --force this collection
  // renders nothing at all.
  skip: (fm) => Boolean(fm.ogImage) && !FORCE,
});

const made = postRun.made + projectRun.made;
const errors = [...postRun.errors, ...projectRun.errors];

console.log(`\nGenerated ${made} OG image(s) → public/images/og/`);
if (errors.length) {
  console.error('Errors:\n' + errors.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
