// Pixel-art OG renderer: a grid-resolution SVG in, a snapped 1200x630 PNG out.
//
// Why a downsample step at all: the portrait is a photograph, and
// `image-rendering="pixelated"` point-samples it — at block 5 that keeps 1 pixel
// of every 25 and the face turns to noise. So the SVG is rasterised at
// SS x the grid (SS=4), where every non-photo primitive is already snapped to
// SS, and a box filter averages each SSxSS square down to one cell. Flat shapes
// survive the average exactly; the face keeps its tone.
//
// Then every cell is quantised to the brand ramp. A cell that already equals a
// ramp colour byte-for-byte is snapped, not dithered — that is what keeps the
// cream surface, the ink type and the coral rings free of speckle while the
// photo, the glow and the vignette get the 4x4 Bayer screen.

import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

import {
  BANNER_ACCENT,
  BANNER_INK,
  BANNER_MUTED,
  CREAM_SURFACE,
  SURFACE_BLUE_DEEP,
} from '../../src/lib/brand.ts';
import { renderSvgToPng } from './og-render.mjs';

export const SS = 4; // supersample factor fed to rsvg-convert
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** sRGB mix, used to derive the in-between ramp steps from brand tokens only. */
const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * The eight-step ramp, shadow to paper. Only its ends are brand tokens; the
 * steps between them are mixes of those tokens, so no bare hex is invented here
 * (DESIGN.md: a generator holds no brand hex of its own).
 */
export const RAMP = [
  SURFACE_BLUE_DEEP, // #0a0070 shadow
  BANNER_INK, // #1400c3 mid
  mix(BANNER_INK, BANNER_MUTED, 0.35),
  BANNER_MUTED, // #5b4fc4 muted label ink
  mix(BANNER_MUTED, CREAM_SURFACE, 0.55),
  BANNER_ACCENT, // #b8431f accent
  mix(BANNER_ACCENT, CREAM_SURFACE, 0.5),
  CREAM_SURFACE, // #f8f2d8 paper
];
const RAMP_RGB = RAMP.map(rgb);

export const SURFACE = CREAM_SURFACE;
export const INK = BANNER_INK;
export const MUTED = BANNER_MUTED;
export const ACCENT = BANNER_ACCENT;

/** Grid for a block size: 5 -> 240x126, 6 -> 200x105 (both divide 1200x630). */
export function gridOf(block) {
  if (1200 % block || 630 % block) throw new Error(`block ${block} does not divide 1200x630`);
  return { b: block, w: 1200 / block, h: 630 / block };
}

const hex = (v) => v.toString(16).padStart(2, '0');
const hexOf = (px) => `#${hex(px[0])}${hex(px[1])}${hex(px[2])}`;

function assertSource(png, grid) {
  const W = grid.w * SS;
  const H = grid.h * SS;
  if (png.width !== W || png.height !== H)
    throw new Error(`rsvg-convert produced ${png.width}x${png.height}, expected ${W}x${H}`);
  // The bottom-right corner is bare surface in every banner. If it is anything
  // else, either the backdrop lost its fill or the rasteriser is colour-managing.
  const at = ((H - 1) * W + (W - 1)) * 4;
  const got = hexOf(png.data.slice(at, at + 3));
  if (got !== SURFACE) throw new Error(`corner pixel ${got}, expected surface ${SURFACE}`);
}

/** Box-average each SSxSS square to one cell. */
function boxDown(png, grid) {
  const W = grid.w * SS;
  const out = Buffer.alloc(grid.w * grid.h * 4);
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * W + (x * SS + dx)) * 4;
          r += png.data[i];
          g += png.data[i + 1];
          b += png.data[i + 2];
        }
      }
      const n = SS * SS;
      const o = (y * grid.w + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return { width: grid.w, height: grid.h, data: out };
}

/** Distance from a pixel to the nearest ramp colour, and which one. */
function nearest(px, bias) {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < RAMP_RGB.length; k++) {
    const c = RAMP_RGB[k];
    const d =
      (px[0] + bias - c[0]) ** 2 + (px[1] + bias - c[1]) ** 2 + (px[2] + bias - c[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return { k: best, d: Math.sqrt(bestD) };
}

/** Snap every cell to the ramp; Bayer offset only where the cell is not already a ramp colour. */
function quantize(buf) {
  for (let y = 0; y < buf.height; y++) {
    for (let x = 0; x < buf.width; x++) {
      const o = (y * buf.width + x) * 4;
      const px = [buf.data[o], buf.data[o + 1], buf.data[o + 2]];
      const exact = nearest(px, 0);
      // ΔRGB < 8 is within rounding of the surface itself — dithering it would
      // sprinkle the whole background.
      const bias =
        exact.d < 8 ? 0 : ((BAYER4[y % 4][x % 4] + 0.5) / 16 - 0.5) * 64;
      const k = bias === 0 ? exact.k : nearest(px, bias).k;
      const c = RAMP_RGB[k];
      buf.data[o] = c[0];
      buf.data[o + 1] = c[1];
      buf.data[o + 2] = c[2];
    }
  }
  return buf;
}

/** Nearest-neighbour upscale by `block`, so one cell becomes a hard block. */
function upscale(buf, block) {
  const W = buf.width * block;
  const H = buf.height * block;
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const si = (Math.floor(y / block) * buf.width + Math.floor(x / block)) * 4;
      const o = (y * W + x) * 4;
      out[o] = buf.data[si];
      out[o + 1] = buf.data[si + 1];
      out[o + 2] = buf.data[si + 2];
      out[o + 3] = 255;
    }
  }
  return { width: W, height: H, data: out };
}

/** No anti-aliasing leaked: every pixel must be a ramp colour. */
export function assertPalette(png) {
  const ok = new Set(RAMP.map((h) => h.toLowerCase()));
  const seen = new Set();
  for (let i = 0; i < png.data.length; i += 4) {
    const c = hexOf(png.data.slice(i, i + 3));
    if (!ok.has(c)) {
      seen.add(c);
      if (seen.size > 3) break;
    }
  }
  if (seen.size) throw new Error(`off-palette pixels: ${[...seen].join(', ')}`);
}

/** Every block uniform: proof the pixels are cells, not scaled artwork. */
export function assertBlocks(png, block) {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const base = (Math.floor(y / block) * block * png.width + Math.floor(x / block) * block) * 4;
      const i = (y * png.width + x) * 4;
      if (
        png.data[i] !== png.data[base] ||
        png.data[i + 1] !== png.data[base + 1] ||
        png.data[i + 2] !== png.data[base + 2]
      )
        throw new Error(`block at (${Math.floor(x / block)},${Math.floor(y / block)}) is not uniform`);
    }
  }
}

/**
 * Full pipeline. `svg` must already be drawn at grid.w*SS x grid.h*SS with every
 * non-photo primitive snapped to multiples of SS.
 *
 * Two engines, one behaviour. The Rust binary (`rust/og-pixels`) runs the same
 * box-downsample, ramp quantise, nearest upscale and two assertions, with the
 * passes spread over every core; it exists because the JS version spent ~116 ms
 * of each card walking 756 000 pixels through `Buffer.slice` + a template
 * string, and a full OG run touches ~55 cards. `OG_PIXELS=js` pins the old path,
 * `OG_PIXELS=rust` refuses to fall back, and the default uses the binary when it
 * is already built and the JS engine otherwise.
 *
 * The build is deliberately NOT implicit. An automatic `cargo build` here meant a
 * cold, network-bound compile inside the first `renderPixelBanner` call — which,
 * inside a unit test with bun's 5 s default timeout, killed `cargo` mid-build and
 * then `rsvg-convert`, and took the CI run down with it (run 45738388730). Build
 * with `bun run og:pixels:build`; this module only ever checks whether the binary
 * exists.
 */
let renderSeq = 0;

const RUST_BIN = fileURLToPath(
  new URL('../../rust/og-pixels/target/release/og-pixels', import.meta.url),
);

/** undefined = not probed, string = binary path, null = JS engine. */
let autoEngine;

function resolveEngine(mode) {
  if (existsSync(RUST_BIN)) return RUST_BIN;
  if (mode === 'rust')
    throw new Error(
      `OG_PIXELS=rust but ${RUST_BIN} is missing — ` +
        'run: cargo build --release --manifest-path rust/og-pixels/Cargo.toml',
    );
  return null;
}

/**
 * Which engine renders: `auto` (the binary when present, JS otherwise), `js`,
 * or `rust` (refuse to fall back). The per-call choice exists so the parity test
 * can render one SVG through both engines in the same process.
 */
function rustEngine(mode = process.env.OG_PIXELS ?? 'auto') {
  if (mode === 'js') return null;
  if (mode === 'rust') return resolveEngine('rust');
  if (autoEngine === undefined) autoEngine = resolveEngine('auto');
  return autoEngine;
}

/** The Rust engine. Returns the written file's byte length. */
function renderInRust(bin, src, grid, outPath) {
  const res = spawnSync(
    bin,
    [
      '--src', src,
      '--out', outPath,
      '--block', String(grid.b),
      '--ss', String(SS),
      '--surface', SURFACE,
      '--ramp', RAMP.join(','),
    ],
    { encoding: 'utf8' },
  );
  if (res.status !== 0)
    throw new Error(`og-pixels failed: ${(res.stderr || res.stdout || '').trim()}`);
  return statSync(outPath).size;
}

export function renderPixelBanner(
  svg,
  grid,
  outPath,
  { engine = process.env.OG_PIXELS ?? 'auto' } = {},
) {
  const src = `${outPath}.src.png`;
  // Unique per process+call: a fixed tmp name lets concurrent generators (og, og:home,
  // og:sections) rasterise each other's SVG into the wrong PNG.
  renderSvgToPng(svg, src, { tmpName: `pixel-og-src-${process.pid}-${++renderSeq}` });

  const bin = rustEngine(engine);
  if (bin) {
    try {
      const bytes = renderInRust(bin, src, grid, outPath);
      return { png: null, bytes, engine: 'rust' };
    } finally {
      try {
        unlinkSync(src);
      } catch {}
    }
  }

  const png = PNG.sync.read(readFileSync(src));
  assertSource(png, grid);

  const small = quantize(boxDown(png, grid));
  const big = upscale(small, grid.b);
  assertPalette(big);
  assertBlocks(big, grid.b);

  const out = new PNG({ width: big.width, height: big.height });
  big.data.copy(out.data);
  const bytes = PNG.sync.write(out);
  writeFileSync(outPath, bytes);
  try {
    unlinkSync(src);
  } catch {}
  return { png: big, bytes: bytes.length, engine: 'js' };
}
