import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { parse as parseYaml } from 'yaml';

import {
  SS,
  SURFACE,
  ACCENT,
  gridOf,
  assertPalette,
  assertBlocks,
  renderPixelBanner,
} from '../../scripts/lib/pixel-og.mjs';
import { GLYPHS, assertCovered, measure } from '../../scripts/lib/pixel-font.mjs';
import { SECTIONS } from '../../src/lib/sections';

/**
 * Binds the claims the pixel-art OG pipeline makes about the 84 banners it ships
 * in `public/images/og/`. Each block below is a claim plus the way it breaks:
 *
 *   1. Palette — every pixel is one of the eight ramp colours. A single
 *      off-ramp pixel means the rasteriser returned anti-aliasing (or a
 *      colour-managed corner), so the banner would drift away from the flat
 *      pixel style every other card has. `assertPalette` walks all 756 000
 *      pixels of a 1200x630 canvas, which is where most of this file's runtime
 *      goes; measured 11.3 s for the full 84-file pass on this machine, under
 *      the 15 s budget, so nothing is sampled (if it ever exceeds the budget,
 *      sample `assertBlocks` only — never `assertPalette`).
 *   2. Blocks — every 5x5 block is uniform. That is the proof the image is a
 *      240x126 grid of cells upscaled by nearest neighbour, not artwork that
 *      was merely downscaled to 1200x630.
 *   3. Text fit — `measure()` is what keeps type inside its column. If a glyph
 *      advance or a real title grows past its box, the generator either throws
 *      at render time or silently cuts the word; the identity strings and the
 *      real card titles are checked here so the failure lands in CI first.
 *   4. Determinism — re-running `renderPixelBanner` on the same SVG must
 *      produce byte-identical PNGs. Otherwise every `og` run dirties the repo
 *      and reviewers cannot tell a real banner change from rasteriser noise.
 *   5. Glyph coverage — `assertCovered` throws on a character the 5x7 font
 *      cannot paint; a hole in a banner ships silently. The fixed strings,
 *      every section label and every real card title (after the generator's
 *      normalisation) must be paintable, and the local copy of that
 *      normalisation table must not drift from `scripts/generate-og.mjs`.
 *
 * `scripts/generate-*.mjs` are intentionally NOT imported: they render on
 * import (top-level side effects) and would overwrite `public/images/og/`.
 */

const ROOT = path.resolve(import.meta.dir, '../..');
const OG_DIR = path.join(ROOT, 'public/images/og');
const CONTENT_DIR = path.join(ROOT, 'src/content');
const GENERATOR = path.join(ROOT, 'scripts/generate-og.mjs');

const BANNER_W = 1200;
const BANNER_H = 630;
const BLOCK = 5; // the grid every shipped banner uses: 240x126 cells
const TITLE_CELLS = 130; // Math.floor((725 - 75) / 5) in scripts/generate-og.mjs

// pngjs ships no type declarations and is not on the tsconfig `types` path, so
// it is required through `createRequire`; the shape below is all this file uses.
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs') as {
  PNG: {
    sync: {
      read: (buf: Buffer) => { width: number; height: number; data: Buffer };
    };
  };
};

// --- Normalisation, copied from scripts/generate-og.mjs ---------------------
// A local copy is needed because the generator is not importable (side
// effects). `TYPOGRAPHIC_SOURCE` / `COMPOSED_SOURCE` hold the exact source
// spellings and are asserted against the generator text below, so a table that
// drifts here turns red instead of quietly diverging.
const TYPOGRAPHIC: Record<string, string> = {
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
const COMPOSED: Record<string, string> = { Й: 'И', Ё: 'Е', й: 'и', ё: 'е' };

const TYPOGRAPHIC_SOURCE = [
  "'×': 'x'",
  "'–': '-'",
  "'…': '...'",
  "'‘': \"'\"",
  "'’': \"'\"",
  "'“': '\"'",
  "'”': '\"'",
  "'«': '\"'",
  "'»': '\"'",
];
const COMPOSED_SOURCE = ["Й: 'И'", "Ё: 'Е'", "й: 'и'", "ё: 'е'"];

/** The generator's `normalizeTitle`: typographic substitutions, collapse spaces. */
const normalizeTitle = (text: string) =>
  [...String(text)]
    .map((ch) => TYPOGRAPHIC[ch] ?? ch)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

/** What the generator actually paints: normalise, then compose Й/Ё onto И/Е. */
const paintText = (text: string) =>
  [...normalizeTitle(text)].map((ch) => COMPOSED[ch] ?? ch).join('');

const IDENTITY_STRINGS = [
  'Nikita Boyarkin',
  'PRODUCT / DATA ANALYST',
  'NIKITABOYARKIN.GITHUB.IO',
  'NB',
];

/** Every shipped card title, from `title:` in posts + projects frontmatter. */
function cardTitles(): { file: string; title: string }[] {
  const out: { file: string; title: string }[] = [];
  for (const collection of ['posts', 'projects'] as const) {
    const dir = path.join(CONTENT_DIR, collection);
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/)?.[1];
      if (!frontmatter) throw new Error(`${collection}/${file}: no frontmatter`);
      const data = parseYaml(frontmatter) as { title?: unknown };
      if (typeof data.title !== 'string' || !data.title.trim())
        throw new Error(`${collection}/${file}: no string title`);
      out.push({ file: `${collection}/${file}`, title: data.title });
    }
  }
  return out;
}

/** assertCovered on `paintText(text)`, with context instead of a bare throw. */
function coverageFailures(entries: { label: string; text: string }[]): string[] {
  const failures: string[] = [];
  for (const { label, text } of entries) {
    try {
      assertCovered(paintText(text));
    } catch (error) {
      failures.push(`${label}: ${(error as Error).message}`);
    }
  }
  return failures;
}

// --- 1 + 2: palette and block uniformity ------------------------------------
// One decode per file feeds both assertions: a 1200x630 RGBA buffer is ~3 MB,
// so the files are decoded, checked and dropped one at a time rather than all
// held in memory at once.
describe('banner pixels', () => {
  const files = fs
    .readdirSync(OG_DIR)
    .filter((f) => f.endsWith('.png'))
    .sort();
  const sizeIssues: string[] = [];
  const paletteIssues: string[] = [];
  const blockIssues: string[] = [];
  let inspected = 0;

  // The full 84-banner decode + assertPalette pass takes ~11 s; bun's default
  // hook timeout is 5 s, so the budget is raised explicitly.
  beforeAll(() => {
    const started = Date.now();
    for (const file of files) {
      let decoded: { width: number; height: number; data: Buffer };
      try {
        decoded = PNG.sync.read(fs.readFileSync(path.join(OG_DIR, file)));
      } catch (error) {
        const message = `${file}: ${(error as Error).message}`;
        sizeIssues.push(message);
        paletteIssues.push(message);
        blockIssues.push(message);
        continue;
      }
      inspected++;
      if (decoded.width !== BANNER_W || decoded.height !== BANNER_H)
        sizeIssues.push(`${file}: ${decoded.width}x${decoded.height}, expected ${BANNER_W}x${BANNER_H}`);
      try {
        assertPalette(decoded);
      } catch (error) {
        paletteIssues.push(`${file}: ${(error as Error).message}`);
      }
      try {
        assertBlocks(decoded, BLOCK);
      } catch (error) {
        blockIssues.push(`${file}: ${(error as Error).message}`);
      }
    }
    // Logged, not asserted: timing assertions are flaky on shared CI. The
    // budget in the header comment is what decides sampling.
    console.log(
      `[pixel-og] decoded and checked ${inspected}/${files.length} banners in ${Date.now() - started} ms`,
    );
  }, { timeout: 60_000 });

  it('renders every OG banner at 1200x630 with only ramp colours', () => {
    expect(files.length).toBeGreaterThan(0);
    // Anchors: prove the scan is looking at the real banner set, not an empty dir.
    expect(files).toContain('portfolio-banner-v2.png');
    expect(files).toContain('portfolio-graph-v2.png');
    expect(files).toContain('section-home.png');
    expect(inspected).toBe(files.length);
    expect(sizeIssues).toEqual([]);
    expect(paletteIssues).toEqual([]);

    // The gate bites: one off-ramp pixel must be rejected, otherwise a green
    // run above would not prove the scan compared anything.
    const offRamp = { width: 1, height: 1, data: Buffer.from([255, 0, 255, 255]) };
    expect(() => assertPalette(offRamp)).toThrow();
  });

  it('builds every banner from uniform 5px cells, not scaled artwork', () => {
    expect(blockIssues).toEqual([]);

    // Two different colours inside one 5px block must be rejected.
    const broken = { width: 2, height: 1, data: Buffer.from([0, 0, 0, 255, 90, 90, 90, 255]) };
    expect(() => assertBlocks(broken, BLOCK)).toThrow();
  });
});

// --- 3: text fit -------------------------------------------------------------
describe('text fit', () => {
  // Mirrors `fits()` / `cellWidth()` in scripts/generate-og.mjs: cells are
  // measured at the block size, one gap per non-final character when advanceGap
  // is set. The x/maxX/size/gap triples below are the generator's own call sites.
  const block = gridOf(BLOCK).b;
  const cellWidth = (text: string, size: number, gap = 0) =>
    (measure(text) + gap * (text.length - 1)) * size;
  const fitsColumn = (text: string, x: number, maxX: number, size: number, gap = 0) =>
    x + cellWidth(text, size, gap) * block <= maxX;

  it('fits the fixed identity strings inside their generator columns', () => {
    const generator = fs.readFileSync(GENERATOR, 'utf8');
    // Anti-drift for the copied geometry: these are the generator's call sites.
    expect(generator).toContain('const PANEL = { x: 56,');
    expect(generator).toContain('fits(NAME, 186, 940, 2)');
    expect(generator).toContain('fits(ROLE, 186, 940, 1, 1)');
    expect(generator).toContain('fits(SITE_URL, PANEL.x, 1150, 1, 1)');

    // Cell widths are exact: a glyph advance change moves these numbers.
    expect(measure('Nikita Boyarkin')).toBe(73);
    expect(measure('PRODUCT / DATA ANALYST')).toBe(104);
    expect(measure('NIKITABOYARKIN.GITHUB.IO')).toBe(116);

    expect(fitsColumn('Nikita Boyarkin', 186, 940, 2)).toBe(true);
    expect(fitsColumn('PRODUCT / DATA ANALYST', 186, 940, 1, 1)).toBe(true);
    expect(fitsColumn('NIKITABOYARKIN.GITHUB.IO', 56, 1150, 1, 1)).toBe(true);

    // Negative control: the same name at 3x overflows, so the gate has teeth.
    expect(fitsColumn('Nikita Boyarkin', 186, 940, 3)).toBe(false);
  });

  it('has no card title whose widest word overflows the 130-cell title box', () => {
    const titles = cardTitles();
    expect(titles.length).toBeGreaterThan(0);
    const overflow: string[] = [];
    for (const { file, title } of titles) {
      for (const word of paintText(title).split(' ').filter(Boolean)) {
        const cells = measure(word);
        if (cells > TITLE_CELLS) overflow.push(`${file}: "${word}" is ${cells} cells`);
      }
    }
    expect(overflow).toEqual([]);
  });
});

// --- 4: determinism ----------------------------------------------------------
describe('banner determinism', () => {
  const grid = gridOf(BLOCK);
  const width = grid.w * SS; // 960
  const height = grid.h * SS; // 504
  const suffix = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const firstPath = path.join(tmpdir(), `pixel-og-determinism-${suffix}-a.png`);
  const secondPath = path.join(tmpdir(), `pixel-og-determinism-${suffix}-b.png`);

  afterAll(() => {
    for (const file of [firstPath, secondPath]) {
      try {
        fs.unlinkSync(file);
      } catch {
        // Already gone (or the render never wrote it) — nothing to clean up.
      }
    }
  });

  it('rasterises the same SVG to byte-identical PNGs on two runs', () => {
    // Fail loudly when the rasteriser is absent: silently skipping would leave
    // the determinism claim untested and no signal in the build.
    const probe = spawnSync('rsvg-convert', ['--version'], { encoding: 'utf8' });
    if (probe.error || probe.status !== 0)
      throw new Error(
        'rsvg-convert is required by renderPixelBanner (macOS: brew install librsvg)',
      );

    // Minimal banner: bare surface plus one accent rect, every edge snapped to
    // a cell multiple so the box filter has nothing to anti-alias.
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="${SURFACE}"/>` +
      `<rect x="${40 * SS}" y="${20 * SS}" width="${10 * SS}" height="${6 * SS}" fill="${ACCENT}"/>` +
      `</svg>`;

    const first = renderPixelBanner(svg, grid, firstPath);
    const second = renderPixelBanner(svg, grid, secondPath);

    const bytesFirst = fs.readFileSync(firstPath);
    const bytesSecond = fs.readFileSync(secondPath);
    expect(bytesFirst.equals(bytesSecond)).toBe(true);
    expect(first.bytes).toBe(second.bytes);
    expect(first.bytes).toBe(bytesFirst.length);
  });
});

// --- 5: glyph coverage -------------------------------------------------------
describe('glyph coverage', () => {
  it('covers the fixed identity strings without a composed glyph', () => {
    expect(coverageFailures(IDENTITY_STRINGS.map((text) => ({ label: text, text })))).toEqual([]);

    // The gate bites: a character with no glyph is rejected, not silently skipped.
    expect(() => assertCovered('\u20AC')).toThrow();
  });

  it('covers every section label in both locales, as written and uppercased', () => {
    const entries = SECTIONS.flatMap((section) => [
      { label: `${section.key}/ru`, text: section.label.ru },
      { label: `${section.key}/en`, text: section.label.en },
      { label: `${section.key}/ru-upper`, text: section.label.ru.toUpperCase() },
      { label: `${section.key}/en-upper`, text: section.label.en.toUpperCase() },
    ]);
    expect(entries.length).toBeGreaterThanOrEqual(SECTIONS.length * 2);
    expect(coverageFailures(entries)).toEqual([]);
  });

  it('covers every real card title after normalisation', () => {
    const titles = cardTitles();
    expect(titles.length).toBeGreaterThan(0);
    expect(coverageFailures(titles.map(({ file, title }) => ({ label: file, text: title })))).toEqual(
      [],
    );
  });

  it('has every pair of the local normalisation table present in the generator', () => {
    const generator = fs.readFileSync(GENERATOR, 'utf8');
    expect(TYPOGRAPHIC_SOURCE.length).toBe(Object.keys(TYPOGRAPHIC).length);
    expect(COMPOSED_SOURCE.length).toBe(Object.keys(COMPOSED).length);
    for (const pair of TYPOGRAPHIC_SOURCE) expect(generator).toContain(pair);
    for (const pair of COMPOSED_SOURCE) expect(generator).toContain(pair);
    // Sanity: the font really does lack Й/Ё, which is why composition is needed.
    expect('Й' in GLYPHS).toBe(false);
    expect('Ё' in GLYPHS).toBe(false);
  });
});
