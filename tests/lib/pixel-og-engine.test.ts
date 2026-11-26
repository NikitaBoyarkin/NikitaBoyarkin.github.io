import { describe, it, expect, afterAll } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

import {
  SS,
  SURFACE,
  ACCENT,
  INK,
  gridOf,
  renderPixelBanner,
} from '../../scripts/lib/pixel-og.mjs';

/**
 * Binds the claim the two rendering engines make: `rust/og-pixels` and the
 * JavaScript original in `pixel-og.mjs` must produce the same pixels.
 *
 * Why a second engine exists at all is a speed claim (the JS passes spent
 * ~116 ms per card in a per-pixel `Buffer.slice` + template string, and an OG
 * run touches ~55 cards), but a speed claim is only safe if correctness is
 * unchanged. This file is that proof: it renders one card through both engines,
 * from the same SVG, and compares every pixel.
 *
 * The Rust binary is optional here on purpose — a checkout without cargo must
 * still run the rest of the suite. The test skips loudly (a console line, not a
 * silent pass) and CI is where it matters least: the shipped PNGs are committed,
 * so the JS path is not what a visitor downloads.
 *
 * The SVG deliberately carries three kinds of region, because the engines agree
 * trivially on flat fills and disagree only in the interesting places:
 *   1. bare surface (snapped, never dithered),
 *   2. flat accent blocks snapped to cell edges (box filter has nothing to blur),
 *   3. a gradient strip that crosses the ramp midpoints, where the 4x4 Bayer
 *      bias is what decides the colour — the one branch worth testing.
 */

const ROOT = path.resolve(import.meta.dir, '../..');
const RUST_BIN = path.join(ROOT, 'rust/og-pixels/target/release/og-pixels');
const hasRust = fs.existsSync(RUST_BIN);

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs') as {
  PNG: {
    sync: {
      read: (buf: Buffer) => { width: number; height: number; data: Buffer };
    };
  };
};

const grid = gridOf(5);
const width = grid.w * SS;
const height = grid.h * SS;

function sampleSvg(): string {
  const gradient = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39;
    const r = Math.round(20 + 200 * t);
    const g = Math.round(10 + 120 * (1 - t));
    const b = Math.round(112 + 100 * t);
    return (
      `<rect x="${(60 + i * 12) * SS}" y="${20 * SS}" ` +
      `width="${12 * SS}" height="${60 * SS}" fill="rgb(${r},${g},${b})"/>`
    );
  }).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${SURFACE}"/>` +
    `<rect x="${40 * SS}" y="${20 * SS}" width="${10 * SS}" height="${6 * SS}" fill="${ACCENT}"/>` +
    `<rect x="${40 * SS}" y="${90 * SS}" width="${16 * SS}" height="${8 * SS}" fill="${INK}"/>` +
    gradient +
    `</svg>`
  );
}

const suffix = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const jsPath = path.join(tmpdir(), `pixel-og-parity-js-${suffix}.png`);
const rustPath = path.join(tmpdir(), `pixel-og-parity-rust-${suffix}.png`);

afterAll(() => {
  for (const file of [jsPath, rustPath]) {
    try {
      fs.unlinkSync(file);
    } catch {
      // Never written, or already gone.
    }
  }
});

describe('pixel-og engines', () => {
  it('renders identical pixels through the JS engine and the Rust engine', () => {
    if (!hasRust) {
      console.log(
        `[pixel-og] skipping engine parity: ${RUST_BIN} is not built ` +
          '(cargo build --release --manifest-path rust/og-pixels/Cargo.toml)',
      );
      return;
    }
    const svg = sampleSvg();
    const js = renderPixelBanner(svg, grid, jsPath, { engine: 'js' });
    const rust = renderPixelBanner(svg, grid, rustPath, { engine: 'rust' });

    expect(js.engine).toBe('js');
    expect(rust.engine).toBe('rust');

    const a = PNG.sync.read(fs.readFileSync(jsPath));
    const b = PNG.sync.read(fs.readFileSync(rustPath));
    expect([b.width, b.height]).toEqual([a.width, a.height]);
    expect(a.width).toBe(1200);
    expect(a.height).toBe(630);

    let firstDiff = -1;
    let differing = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      if (
        a.data[i] !== b.data[i] ||
        a.data[i + 1] !== b.data[i + 1] ||
        a.data[i + 2] !== b.data[i + 2] ||
        a.data[i + 3] !== b.data[i + 3]
      ) {
        differing++;
        if (firstDiff < 0) firstDiff = i / 4;
      }
    }
    expect({ differing, x: firstDiff % a.width, y: Math.floor(firstDiff / a.width) }).toEqual({
      differing: 0,
      x: -1,
      y: -1,
    });
  }, { timeout: 60_000 });

  it('keeps the Rust engine deterministic across two runs', () => {
    if (!hasRust) {
      console.log('[pixel-og] skipping Rust determinism: binary not built');
      return;
    }
    const svg = sampleSvg();
    const second = path.join(tmpdir(), `pixel-og-parity-rust-b-${suffix}.png`);
    try {
      const first = renderPixelBanner(svg, grid, rustPath, { engine: 'rust' });
      const other = renderPixelBanner(svg, grid, second, { engine: 'rust' });
      expect(fs.readFileSync(rustPath).equals(fs.readFileSync(second))).toBe(true);
      expect(first.bytes).toBe(other.bytes);
    } finally {
      try {
        fs.unlinkSync(second);
      } catch {
        // Nothing to clean up.
      }
    }
  }, { timeout: 60_000 });
});
