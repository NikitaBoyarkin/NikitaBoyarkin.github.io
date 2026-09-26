// Shared rendering + accessibility helpers for the OG banner generators
// (scripts/generate-graph-og.mjs, scripts/generate-home-og.mjs).
//
// Font pipeline
// -------------
// Banners are SVG templates rasterised by `rsvg-convert` (librsvg 2.62.3 ->
// pango -> fontconfig -> cairo). The site's Inter / Cormorant are shipped as
// variable .woff2, which fontconfig cannot read, so static TTF instances of the
// exact weights used here live in scripts/og-fonts/ next to a dedicated
// fonts.conf. Two env vars make rsvg resolve those files:
//
//   FONTCONFIG_FILE     = scripts/og-fonts/fonts.conf
//   PANGOCAIRO_BACKEND  = fc
//
// The second one is not optional on macOS: PangoCairo defaults to the CoreText
// backend there, which ignores fontconfig entirely and would silently render
// the banners in a system Helvetica regardless of FONTCONFIG_FILE.
//
// rsvg-convert must run with cwd = scripts/og-fonts, because fonts.conf points
// its <dir> at the cwd (fontconfig resolves relative <dir> entries against the
// process cwd, not the config file).
//
// Callers must have `rsvg-convert` on PATH (Homebrew: `brew install librsvg`).
//
// The lattice (HONEYCOMB / honeycombPattern) is the same honeycomb the site
// paints behind every page, so a banner and the page it previews read as one
// surface. It lives here as geometry — see HONEYCOMB for what pins it.

import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

/** Absolute path to the vendored fonts + fonts.conf. */
export const OG_FONTS_DIR = fileURLToPath(new URL('../og-fonts/', import.meta.url));

/** Family names as declared in the vendored static TTFs. */
export const FONT_SANS = 'Inter';
export const FONT_SERIF = 'Cormorant';

/** Environment for a fontconfig-backed rsvg-convert run. */
export function ogFontEnv() {
  return {
    ...process.env,
    FONTCONFIG_FILE: join(OG_FONTS_DIR, 'fonts.conf'),
    PANGOCAIRO_BACKEND: 'fc',
  };
}

/** XML-escape text destined for an SVG text node. */
export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The site's wallpaper lattice, as geometry rather than a picture: a flat-top
 * honeycomb tile. These five values are a transcription of `--wallpaper-tile`
 * in src/styles/global.css, and `tests/lib/brand.test.ts` pins the two together
 * — the banner and the page must never drift into two different lattices.
 *
 * It lives here, not in each generator, for the same reason the palette lives
 * in brand.ts: a banner must not be the only place the lattice is defined.
 */
export const HONEYCOMB = {
  width: 42,
  height: 24,
  viewBox: '0 0 42 24',
  hex: 'M35 12 28 24 14 24 7 12 14 0 28 0Z',
  links: 'M0 12h7M35 12h7',
};

/**
 * The lattice as an SVG `<pattern>`, for the background of an OG banner.
 *
 * `scale` multiplies the 42x24 tile. A banner is 1200px wide but is consumed at
 * link-preview size (~600px), so at 1x the cells would arrive at half the
 * apparent size of the desktop wallpaper and dissolve into texture; 2x is the
 * default so the banner and the page read as the same surface. `stroke-width`
 * is divided by the same factor, keeping the line a 1-unit hairline at any
 * scale.
 *
 * The colour is passed in, never defaulted: this module is a renderer and owns
 * no palette (see brand.ts for that).
 */
export function honeycombPattern({
  id = 'lattice',
  scale = 2,
  color,
  opacity = 0.11,
} = {}) {
  const { width, height, hex, links } = HONEYCOMB;
  return `<pattern id="${id}" width="${width * scale}" height="${height * scale}" patternUnits="userSpaceOnUse">
      <g transform="scale(${scale})" fill="none" stroke="${color}" stroke-width="${(1 / scale).toFixed(4)}" stroke-opacity="${opacity}">
        <path d="${hex}"/>
        <path d="${links}"/>
      </g>
    </pattern>`;
}

/**
 * The full-canvas layer that paints the lattice. Sits directly on the surface
 * fill and below the glow, so the warm light falls on the texture instead of
 * being flattened by it.
 */
export const honeycombLayer = (id = 'lattice') =>
  `<rect width="1200" height="630" fill="url(#${id})"/>`;

/**
 * Rasterise an SVG string to `outPath` via rsvg-convert, using the vendored
 * fonts. Exits the process on renderer failure (matches the OG scripts' CLI
 * contract: a failed banner must not leave a stale PNG behind).
 */
export function renderSvgToPng(svg, outPath, { tmpName = 'og-banner' } = {}) {
  mkdirSync(dirname(outPath), { recursive: true });
  const svgPath = join(tmpdir(), `${tmpName}.svg`);
  writeFileSync(svgPath, svg);
  const res = spawnSync('rsvg-convert', [svgPath, '-o', outPath], {
    encoding: 'utf8',
    cwd: OG_FONTS_DIR,
    env: ogFontEnv(),
  });
  try {
    unlinkSync(svgPath);
  } catch {}
  if (res.status !== 0) {
    console.error('rsvg-convert failed:', res.stderr || res.stdout);
    process.exit(1);
  }
  return outPath;
}

/**
 * Same contract as renderSvgToPng, but rasterises to a vector PDF
 * (`-f pdf`) — used for print-shaped assets such as the CV cover page.
 */
export function renderSvgToPdf(svg, outPath, { tmpName = 'og-banner' } = {}) {
  mkdirSync(dirname(outPath), { recursive: true });
  const svgPath = join(tmpdir(), `${tmpName}.svg`);
  writeFileSync(svgPath, svg);
  const res = spawnSync('rsvg-convert', ['-f', 'pdf', svgPath, '-o', outPath], {
    encoding: 'utf8',
    cwd: OG_FONTS_DIR,
    env: ogFontEnv(),
  });
  try {
    unlinkSync(svgPath);
  } catch {}
  if (res.status !== 0) {
    console.error('rsvg-convert failed:', res.stderr || res.stdout);
    process.exit(1);
  }
  return outPath;
}

// --- WCAG 2.x relative luminance / contrast --------------------------------

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToRgb(hex) {
  const m = HEX.exec(hex);
  if (!m) throw new Error(`invalid hex color: ${hex}`);
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const linear = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG "large text": >=24px, or >=18.66px when bold (>=700). */
export const isLargeText = (sizePx, weight = 400) =>
  sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);

/**
 * Contrast rows for a set of text tokens over `bg`.
 * Each token: { name, color, size?, weight?, decorative? }.
 * `decorative: true` marks non-text marks (dots, rules) — reported, not asserted.
 */
export function contrastRows(bg, tokens) {
  return tokens.map((t) => {
    const ratio = contrastRatio(t.color, bg);
    const threshold = t.decorative ? 0 : isLargeText(t.size ?? 0, t.weight ?? 400) ? 3 : 4.5;
    return { ...t, ratio, threshold, pass: t.decorative || ratio >= threshold };
  });
}

/**
 * Print a contrast table and throw unless every text token meets WCAG AA.
 * Decorative tokens are printed for reference but never fail the build.
 */
export function assertContrast(bg, tokens, label = '') {
  const rows = contrastRows(bg, tokens);
  const width = Math.max(8, ...rows.map((r) => r.name.length));
  console.log(`[contrast] ${label || 'tokens'} on ${bg}`);
  for (const r of rows) {
    const spec = r.decorative ? 'graphic' : `${r.size ?? '?'}px/${r.weight ?? 400}`;
    const verdict = r.decorative ? 'skip' : r.pass ? 'PASS' : 'FAIL';
    console.log(
      `  ${r.name.padEnd(width)}  ${r.color}  ${r.ratio.toFixed(2).padStart(5)}:1  ${spec.padStart(9)}  ${verdict}`,
    );
  }
  const failed = rows.filter((r) => !r.pass);
  if (failed.length) {
    throw new Error(`WCAG AA failed (${label || 'contrast'}): ${failed.map((r) => r.name).join(', ')}`);
  }
  return rows;
}
