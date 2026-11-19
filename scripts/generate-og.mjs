// Per-content pixel-art OG card generator.
// Reads src/content/posts/*.md and src/content/projects/*.md frontmatter,
// composes one 1200x630 card per entry and writes the PNG into
// public/images/og/.
// Run: bun run og   (add --force to re-render project cards, see below)
// Not wired into the build — run manually when content changes; commit the PNGs.
//
// Pipeline: the card is drawn directly on the 240x126 cell grid (gridOf(5), one
// cell = 5px) and handed to renderPixelBanner, which rasterises at SS=4,
// box-downsamples to one value per cell, quantises to the eight-step brand RAMP
// and nearest-upscales back to 1200x630. The SVG carries no live text element
// and no font stack: typography is the 5x7 bitmap font from
// scripts/lib/pixel-font.mjs, so neither fontconfig nor a vendored TTF takes any
// part in these cards.
//
// Composition is the graph banner's, one for one (generate-graph-og.mjs): top
// accent bar, NB hexagon, the section label on the hexagon's centre line, the
// URL footer at y=550 and the MUTED panel at {56,196,692,302}. The panel's
// content is this card's own — the title.
//
// Title rules (the thing this generator exists for):
//   • wrapped by words into at most two lines, each measured in CELLS and gated
//     against the panel's inner width before anything is drawn;
//   • too long for two lines → cut on a WORD boundary and append `...` (three
//     periods: `…` is not in the bitmap font);
//   • a single word wider than a whole line is cut per glyph — the only
//     character-level cut, and today's collection never reaches it;
//   • the title never leaves the panel and never touches the frame.
//
// Glyph coverage: `assertPaintable` runs on every real title and label before
// the first <rect>. It accepts Й/Ё/й/ё through composition — the font ships the
// OVER row but no base glyph for them (same trick generate-section-og.mjs uses)
// — and throws on anything else, so a missing glyph fails loudly here instead of
// shipping a hole. `assertCovered` still guards the fixed identity strings,
// which use none of the composed letters. A short typographic map normalises
// characters that have an exact ASCII spelling in the font (×, en dash, curly
// quotes), and anything outside both tables throws.
//
// Two escape hatches, both opt-in:
//
//   1. FORCE (`bun run og --force`). A project that declares `ogImage` owns its
//      card and is skipped, so a routine re-run never clobbers a hand-made
//      banner. Every project declares one, though, which meant the palette flip
//      would have left all project cards on the retired blue surface. With
//      --force the skip is inverted: declared cards are re-rendered too.
//   2. OUTPUT_NAME. The override map below renames the written file for a slug
//      whose frontmatter points somewhere other than `<slug>.png` — today only
//      `volta` (→ volta-neobank-case-study.png). Adding an entry here is the
//      only supported way to break the `<slug>.png` convention; otherwise the
//      frontmatter and the generator drift and the preview 404s.
//
// Palette: the cream picture surface with royal-blue ink and a burnt-coral
// accent — the same regime as portfolio-banner-v2 and portfolio-graph-v2, so all
// OG previews read as one series. Every colour is a RAMP step; the generator
// holds no brand hex of its own.

import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hexPointsFlat } from '../src/lib/brand.ts';
import {
  GLYPHS,
  OVER_ROWS,
  assertCovered,
  glyphRects,
  measure,
} from './lib/pixel-font.mjs';
import { ACCENT, INK, MUTED, SURFACE, SS, gridOf, renderPixelBanner } from './lib/pixel-og.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POSTS_DIR = join(ROOT, 'src/content/posts');
const PROJECTS_DIR = join(ROOT, 'src/content/projects');
const OUT_DIR = join(ROOT, 'public/images/og');

// Project `track` values are taxonomy keys, not display strings — spell them
// out for the card label the same way the board's category tabs do.
const TRACK_LABELS = {
  experiments: 'Experiments',
  analytics: 'Analytics',
  product: 'Product',
  engineering: 'Engineering',
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Re-render cards that declare their own `ogImage` instead of skipping them.
const FORCE = process.argv.includes('--force');

// Slug → output filename, for the one project whose frontmatter points at a
// name the `<slug>.png` convention would not produce. Keep in sync with
// src/content/projects/*.md (tests/lib/og-images.test.ts binds the target).
const OUTPUT_NAME = {
  volta: 'volta-neobank-case-study.png',
};

// --- pixel composition: 240x126 cells, one cell per block --------------------
const GRID = gridOf(5);
const { b, w, h } = GRID;
/** px on the 1200x630 canvas -> supersampled user units */
const S = (v) => Math.round((v / b) * SS);
/** px -> whole cell, in supersampled user units */
const C = (v) => Math.round(v / b) * SS;
const R = (x, y, rw, rh, fill) =>
  `<rect x="${C(x)}" y="${C(y)}" width="${C(rw)}" height="${C(rh)}" fill="${fill}"/>`;
const fits = (text, x, maxX, size, gap = 0) => {
  const px = x + (measure(text) + gap * (text.length - 1)) * size * b;
  if (px > maxX) throw new Error(`"${text}" is ${Math.round(px)}px, only ${maxX - x} available`);
};
const scalePoints = (points, factor) =>
  points
    .split(' ')
    .map((p) => p.split(',').map((v) => Math.round(Number(v) * factor)).join(','))
    .join(' ');

// --- Glyph coverage: composition + a typographic map ------------------------
// The font ships OVER rows for Й/Ё/й/ё but no base glyph, so those four are
// painted as И/Е/и/е plus the OVER row. Anything not in either table throws.
const COMPOSED = { Й: 'И', Ё: 'Е', й: 'и', ё: 'е' };
// Characters with an exact ASCII spelling in the font. `…` maps to three
// periods because the font has no ellipsis glyph.
const TYPOGRAPHIC = {
  '×': 'x',
  '–': '-',
  '…': '...',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '«': '"',
  '»': '"',
};

const normalizeTitle = (text) =>
  [...String(text)].map((ch) => TYPOGRAPHIC[ch] ?? ch).join('').replace(/\s+/g, ' ').trim();

/** Throws on a character neither the font nor the composition can paint. */
function assertPaintable(text) {
  for (const ch of String(text)) {
    if (!(ch in GLYPHS) && !(ch in COMPOSED))
      throw new Error(
        `pixel font: no glyph for ${JSON.stringify(ch)} (U+${ch.codePointAt(0).toString(16).toUpperCase()})`,
      );
  }
}

/** One 5-cell row of the OVER table as merged <rect> runs. */
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

// --- Layout, copied from generate-graph-og.mjs ------------------------------
const PANEL = { x: 56, y: 196, w: 692, h: 302 };
const LOGO = { cx: 113.5, cy: 101.5, r: 52.9 };
const SITE_URL = 'NIKITABOYARKIN.GITHUB.IO';

// Title box: 130 cells of the panel's 138, leaving ~3.5 cells of clearance to
// the frame on each side and centred on the panel's optical middle.
const TITLE = { x: 75, maxX: 725, size: 1, gap: 1 };
const TITLE_CELLS = Math.floor((TITLE.maxX - TITLE.x) / b); // 130
const GLYPH_LINE = 7; // cells, capital height of the 5x7 font
const LINE_LEAD = 10; // cells between line tops (7 of glyph + 3 of air)
const TRUNC = '...';

/** Exact width of a line in cells: glyph advances plus one gap per non-space. */
const cellWidth = (text, gap = TITLE.gap) =>
  measure(text) + gap * [...String(text)].filter((ch) => ch !== ' ').length;

const fitsLine = (text, maxCells = TITLE_CELLS) => cellWidth(text) <= maxCells;

/** Longest prefix of `text` that fits `maxCells` — the pathological-word cut. */
function cutToCells(text, maxCells) {
  let out = '';
  for (const ch of [...String(text)]) {
    if (!fitsLine(out + ch, maxCells)) break;
    out += ch;
  }
  return out;
}

/**
 * Wrap `title` into at most two lines that each fit the panel's inner width.
 *
 * The break is chosen by least raggedness (sum of squared slack), not greedily:
 * `Продакт × аналитик: три кейса коллаборации` fits two lines only when the
 * break lands after `три`, which a greedy fill never tries. When no split fits,
 * the break that keeps the most words wins and the second line takes the marker.
 */
function wrapTitle(raw) {
  const text = normalizeTitle(raw);
  assertPaintable(text);
  const words = text.split(' ').filter(Boolean);
  if (!words.length) throw new Error('empty title');

  const span = (from, to) => words.slice(from, to).join(' ');
  const marker = cellWidth(TRUNC);

  if (fitsLine(text)) return { lines: [text], truncated: false };

  // A single word wider than the box: cut it per glyph, drop the rest.
  if (!fitsLine(words[0]))
    return { lines: [`${cutToCells(words[0], TITLE_CELLS - marker)}${TRUNC}`], truncated: true };

  let best = null;
  for (let k = 1; k < words.length; k++) {
    const head = span(0, k);
    if (!fitsLine(head)) continue;
    const tail = span(k, words.length);
    if (!fitsLine(tail)) continue;
    const score = (TITLE_CELLS - cellWidth(head)) ** 2 + (TITLE_CELLS - cellWidth(tail)) ** 2;
    if (!best || score < best.score) best = { score, lines: [head, tail] };
  }
  if (best) return { lines: best.lines, truncated: false };

  // No clean split: keep as many words as possible, marker on line two.
  const room = TITLE_CELLS - marker;
  let pick = null;
  let head = null; // longest prefix that fits, for the last-resort glyph cut
  for (let k = 1; k < words.length; k++) {
    const candidate = span(0, k);
    if (!fitsLine(candidate)) break;
    head = candidate;
    let m = k;
    while (m < words.length && cellWidth(span(k, m + 1)) <= room) m++;
    if (m > k && (!pick || m > pick.m)) pick = { k, m };
  }
  if (pick) {
    // A dangling comma/colon before the marker reads as a typo, not a cut.
    const body = span(pick.k, pick.m).replace(/[,;:]+$/, '');
    return { lines: [span(0, pick.k), `${body}${TRUNC}`], truncated: true };
  }
  // Even the next word alone overflows the marker budget: cut it per glyph.
  const body = cutToCells(words[head.split(' ').length], room);
  return { lines: [head, `${body}${TRUNC}`], truncated: true };
}

/** The title block, vertically centred in the panel's cell interior. */
function titleRects(lines) {
  const panelTop = Math.ceil(PANEL.y / b);
  const panelBottom = Math.floor((PANEL.y + PANEL.h) / b);
  const block = lines.length * GLYPH_LINE + (lines.length - 1) * (LINE_LEAD - GLYPH_LINE);
  const firstTop = panelTop + Math.floor((panelBottom - panelTop + 1 - block) / 2);
  return lines
    .map((line, k) => T(line, TITLE.x, (firstTop + k * LINE_LEAD) * b, TITLE.size, INK, TITLE.gap))
    .join('\n  ');
}

// --- Fixed identity strings: coverage + width gates --------------------------
for (const text of [SITE_URL, 'NB']) assertCovered(text);
fits(SITE_URL, PANEL.x, 1150, 1, 1);

function buildSvg(title, label) {
  const upper = String(label).toUpperCase();
  assertPaintable(upper);
  // The label is gated against the panel it sits on, not the canvas edge.
  fits(upper, 186, PANEL.x + PANEL.w, 1, 1);

  const { lines, truncated } = wrapTitle(title);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * SS}" height="${h * SS}" viewBox="0 0 ${w * SS} ${h * SS}">
  <rect width="${w * SS}" height="${h * SS}" fill="${SURFACE}"/>
  ${R(0, 0, 1200, b, ACCENT)}
  <rect x="${S(PANEL.x)}" y="${S(PANEL.y)}" width="${S(PANEL.w)}" height="${S(PANEL.h)}" fill="none" stroke="${MUTED}" stroke-width="${S(b)}"/>
  ${titleRects(lines)}
  <polygon points="${scalePoints(hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r), SS / b)}" fill="${ACCENT}"/>
  <polygon points="${scalePoints(hexPointsFlat(LOGO.cx, LOGO.cy, LOGO.r - b * 1.6), SS / b)}" fill="${SURFACE}"/>
  ${glyphRects('NB', C(LOGO.cx - b * 5), C(LOGO.cy - b * 3.5), { scale: SS, fill: INK }).join('')}
  ${T(upper, 186, 84, 1, INK, 1)}
  ${T(SITE_URL, PANEL.x, 550, 1, INK, 1)}
</svg>`;
  return { svg, truncated };
}

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

/**
 * Render one card per content file in `dir`. `pill` picks the label for the
 * card's category/track line; `skip` lets a file opt out because it declares
 * its own image.
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
    const { svg, truncated } = buildSvg(fm.title, pill(fm));
    const { bytes } = renderPixelBanner(svg, GRID, pngPath);
    made++;
    console.log(
      `  OK  ${OUTPUT_NAME[slug] ?? `${slug}.png`} — ${(bytes / 1024).toFixed(0)} KB${truncated ? ' · title cut with ...' : ''}`,
    );
  }
  return { made, errors };
}

// Posts and projects share the og/ namespace; slugs are disjoint today (asserted
// by tests/lib/og-images.test.ts), so a collision cannot silently overwrite.
const postRun = generate({ dir: POSTS_DIR, pill: (fm) => fm.category || 'article' });
const projectRun = generate({
  dir: PROJECTS_DIR,
  pill: (fm) => TRACK_LABELS[fm.track] ?? 'Project',
  // Every project declares `ogImage` today, so without --force this collection
  // renders nothing at all.
  skip: (fm) => Boolean(fm.ogImage) && !FORCE,
});

const made = postRun.made + projectRun.made;
const errors = [...postRun.errors, ...projectRun.errors];

console.log(`\nGenerated ${made} pixel OG card(s) → public/images/og/`);
if (errors.length) {
  console.error('Errors:\n' + errors.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
