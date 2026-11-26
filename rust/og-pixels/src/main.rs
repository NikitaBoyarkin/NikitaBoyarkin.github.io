//! Pixel-art OG banner rasteriser — the Rust half of `scripts/lib/pixel-og.mjs`.
//!
//! Input: the PNG `rsvg-convert` produced from the card's SVG, drawn at
//! `grid.w * SS` by `grid.h * SS` with every flat primitive snapped to `SS`.
//! Output: the 1200x630 card, quantised to the brand ramp.
//!
//! The three passes and the two assertions mirror the JavaScript originals one
//! for one — same boxing (integer sum over SS x SS, divided by SS*SS and rounded),
//! same nearest-colour search (`<` keeps the lowest ramp index on a tie), same
//! 4x4 Bayer bias, same early-exit order in the palette scan. The port exists
//! because those passes are hot: the JS build spent 116 ms of every card in a
//! per-pixel `Buffer.slice` + template string, and the pass walks 55 cards.
//!
//! Determinism is load-bearing: `tests/lib/pixel-og.test.ts` asserts that two
//! renders of the same SVG are byte-identical, so every reduction here is
//! per-output-cell (never a cross-thread accumulation) and the encoder runs with
//! fixed settings.

#![forbid(unsafe_code)]

use std::fs;
use std::io::BufWriter;
use std::process::ExitCode;

use rayon::prelude::*;

const BANNER_W: usize = 1200;
const BANNER_H: usize = 630;
const BAYER4: [[u32; 4]; 4] = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

struct Options {
    src: String,
    out: String,
    block: usize,
    ss: usize,
    surface: [u8; 3],
    ramp: Vec<[u8; 3]>,
}

fn main() -> ExitCode {
    match parse_args(std::env::args().skip(1)) {
        Ok(opts) => match run(&opts) {
            Ok(()) => ExitCode::SUCCESS,
            Err(message) => {
                eprintln!("og-pixels: {message}");
                ExitCode::FAILURE
            }
        },
        Err(message) => {
            eprintln!("og-pixels: {message}");
            eprintln!(
                "usage: og-pixels --src SRC.png --out OUT.png --block 5 --ss 4 \
                 --surface '#f8f2d8' --ramp '#0a0070,#1400c3,...'"
            );
            ExitCode::FAILURE
        }
    }
}

fn parse_args<I: Iterator<Item = String>>(mut args: I) -> Result<Options, String> {
    let mut src: Option<String> = None;
    let mut out: Option<String> = None;
    let mut block: Option<usize> = None;
    let mut ss: Option<usize> = None;
    let mut surface: Option<String> = None;
    let mut ramp: Option<String> = None;

    while let Some(flag) = args.next() {
        let mut value = || args.next().ok_or_else(|| format!("{flag} needs a value"));
        match flag.as_str() {
            "--src" => src = Some(value()?),
            "--out" => out = Some(value()?),
            "--block" => block = Some(parse_usize(&value()?)?),
            "--ss" => ss = Some(parse_usize(&value()?)?),
            "--surface" => surface = Some(value()?),
            "--ramp" => ramp = Some(value()?),
            other => return Err(format!("unknown argument: {other}")),
        }
    }

    let block = block.ok_or("--block is required")?;
    let ss = ss.ok_or("--ss is required")?;
    if block == 0 || ss == 0 {
        return Err("--block and --ss must be positive".into());
    }
    if !BANNER_W.is_multiple_of(block) || !BANNER_H.is_multiple_of(block) {
        return Err(format!(
            "block {block} does not divide {BANNER_W}x{BANNER_H}"
        ));
    }

    let ramp = parse_ramp(&ramp.ok_or("--ramp is required")?)?;
    if ramp.is_empty() {
        return Err("--ramp needs at least one colour".into());
    }

    Ok(Options {
        src: src.ok_or("--src is required")?,
        out: out.ok_or("--out is required")?,
        block,
        ss,
        surface: parse_hex(&surface.ok_or("--surface is required")?)?,
        ramp,
    })
}

fn parse_usize(raw: &str) -> Result<usize, String> {
    raw.parse::<usize>()
        .map_err(|_| format!("not a positive integer: {raw}"))
}

fn parse_ramp(raw: &str) -> Result<Vec<[u8; 3]>, String> {
    raw.split(',')
        .filter(|part| !part.trim().is_empty())
        .map(|part| parse_hex(part.trim()))
        .collect()
}

/// `#rrggbb` (or `rrggbb`) to RGB. The ramp arrives as text so the brand tokens
/// keep a single home in `src/lib/brand.ts`; this binary owns no palette.
fn parse_hex(raw: &str) -> Result<[u8; 3], String> {
    let hex = raw.strip_prefix('#').unwrap_or(raw);
    // Checked before slicing: a non-ASCII byte would make `hex[at..at + 2]`
    // panic on a char boundary, and this function's contract is to return.
    if hex.len() != 6 || !hex.is_ascii() {
        return Err(format!("invalid hex colour: {raw}"));
    }
    let channel = |at: usize| {
        u8::from_str_radix(&hex[at..at + 2], 16).map_err(|_| format!("invalid hex colour: {raw}"))
    };
    Ok([channel(0)?, channel(2)?, channel(4)?])
}

fn run(opts: &Options) -> Result<(), String> {
    let grid_w = BANNER_W / opts.block;
    let grid_h = BANNER_H / opts.block;
    let (width, height, src) = decode(&opts.src)?;

    let expect_w = grid_w * opts.ss;
    let expect_h = grid_h * opts.ss;
    if width != expect_w || height != expect_h {
        return Err(format!(
            "rsvg-convert produced {width}x{height}, expected {expect_w}x{expect_h}"
        ));
    }
    assert_source(&src, &opts.surface)?;

    let cells = box_down(&src, width, opts.ss, grid_w, grid_h);
    let snapped = quantize(&cells, grid_w, &opts.ramp);
    let big = upscale(&snapped, grid_w, grid_h, opts.block);

    assert_palette(&big, &opts.ramp)?;
    assert_blocks(&big, BANNER_W, opts.block)?;

    encode(&opts.out, BANNER_W, BANNER_H, &big)
}

/// RGBA8 pixels, whatever the source colour type was.
fn decode(path: &str) -> Result<(usize, usize, Vec<u8>), String> {
    let file = fs::File::open(path).map_err(|e| format!("cannot read {path}: {e}"))?;
    let decoder = png::Decoder::new(file);
    let mut reader = decoder
        .read_info()
        .map_err(|e| format!("cannot decode {path}: {e}"))?;
    let mut buffer = vec![0u8; reader.output_buffer_size()];
    let frame = reader
        .next_frame(&mut buffer)
        .map_err(|e| format!("cannot decode {path}: {e}"))?;

    let (width, height) = (frame.width as usize, frame.height as usize);
    let pixels = &buffer[..frame.buffer_size()];
    let rgba = match frame.color_type {
        png::ColorType::Rgba => pixels.to_vec(),
        png::ColorType::Rgb => {
            let mut out = vec![0u8; width * height * 4];
            let (chunks, _) = pixels.as_chunks::<3>();
            let (targets, _) = out.as_chunks_mut::<4>();
            for (src, dst) in chunks.iter().zip(targets.iter_mut()) {
                dst[0] = src[0];
                dst[1] = src[1];
                dst[2] = src[2];
                dst[3] = 255;
            }
            out
        }
        png::ColorType::GrayscaleAlpha => {
            let mut out = vec![0u8; width * height * 4];
            let (chunks, _) = pixels.as_chunks::<2>();
            let (targets, _) = out.as_chunks_mut::<4>();
            for (src, dst) in chunks.iter().zip(targets.iter_mut()) {
                dst[0] = src[0];
                dst[1] = src[0];
                dst[2] = src[0];
                dst[3] = src[1];
            }
            out
        }
        png::ColorType::Grayscale => {
            let mut out = vec![0u8; width * height * 4];
            let (targets, _) = out.as_chunks_mut::<4>();
            for (src, dst) in pixels.iter().zip(targets.iter_mut()) {
                dst[0] = *src;
                dst[1] = *src;
                dst[2] = *src;
                dst[3] = 255;
            }
            out
        }
        other => return Err(format!("unsupported colour type: {other:?}")),
    };
    if rgba.len() != width * height * 4 {
        return Err(format!(
            "{path}: decoded {} bytes for {width}x{height}",
            rgba.len()
        ));
    }
    Ok((width, height, rgba))
}

/// The bottom-right corner is bare surface in every banner. If it is anything
/// else, either the backdrop lost its fill or the rasteriser is colour-managing.
fn assert_source(src: &[u8], surface: &[u8; 3]) -> Result<(), String> {
    let last = src.len().saturating_sub(4);
    let got = [src[last], src[last + 1], src[last + 2]];
    if &got != surface {
        return Err(format!(
            "corner pixel {}, expected surface {}",
            hex_of(&got),
            hex_of(surface)
        ));
    }
    Ok(())
}

/// Box-average each SS x SS square to one cell.
fn box_down(src: &[u8], src_w: usize, ss: usize, grid_w: usize, grid_h: usize) -> Vec<u8> {
    let mut out = vec![0u8; grid_w * grid_h * 3];
    let n = (ss * ss) as f64;
    out.par_chunks_mut(3).enumerate().for_each(|(idx, cell)| {
        let x = idx % grid_w;
        let y = idx / grid_w;
        let (mut r, mut g, mut b) = (0u32, 0u32, 0u32);
        for dy in 0..ss {
            for dx in 0..ss {
                let i = ((y * ss + dy) * src_w + (x * ss + dx)) * 4;
                r += u32::from(src[i]);
                g += u32::from(src[i + 1]);
                b += u32::from(src[i + 2]);
            }
        }
        cell[0] = round_channel(r, n);
        cell[1] = round_channel(g, n);
        cell[2] = round_channel(b, n);
    });
    out
}

/// `Math.round(sum / n)` for a non-negative sum: JS rounds a half toward +inf,
/// which is `f64::round` for non-negative values too.
fn round_channel(sum: u32, n: f64) -> u8 {
    let value = (f64::from(sum) / n).round();
    if value <= 0.0 {
        0
    } else if value >= 255.0 {
        255
    } else {
        value as u8
    }
}

/// Nearest ramp colour with an optional per-channel Bayer bias, returning the
/// index and the unbiased-by-construction distance (`<` keeps the lower index).
fn nearest(px: [f64; 3], bias: f64, ramp: &[[u8; 3]]) -> (usize, f64) {
    let mut best = 0usize;
    let mut best_d = f64::INFINITY;
    for (k, c) in ramp.iter().enumerate() {
        let dr = px[0] + bias - f64::from(c[0]);
        let dg = px[1] + bias - f64::from(c[1]);
        let db = px[2] + bias - f64::from(c[2]);
        let d = dr * dr + dg * dg + db * db;
        if d < best_d {
            best_d = d;
            best = k;
        }
    }
    (best, best_d.sqrt())
}

/// Drop the accumulated step to one of the eight ramp colours.
fn quantize(cells: &[u8], grid_w: usize, ramp: &[[u8; 3]]) -> Vec<u8> {
    let mut out = vec![0u8; cells.len()];
    out.par_chunks_mut(3).enumerate().for_each(|(idx, cell)| {
        let x = idx % grid_w;
        let y = idx / grid_w;
        let base = idx * 3;
        let px = [
            f64::from(cells[base]),
            f64::from(cells[base + 1]),
            f64::from(cells[base + 2]),
        ];
        let exact = nearest(px, 0.0, ramp);
        // A cell inside rounding distance of a ramp colour is snapped, not
        // dithered — otherwise the whole cream surface gets sprinkled.
        let bias = if exact.1 < 8.0 {
            0.0
        } else {
            ((f64::from(BAYER4[y % 4][x % 4]) + 0.5) / 16.0 - 0.5) * 64.0
        };
        let k = if bias == 0.0 {
            exact.0
        } else {
            nearest(px, bias, ramp).0
        };
        cell.copy_from_slice(&ramp[k]);
    });
    out
}

/// Nearest-neighbour upscale, so one cell becomes a hard block.
fn upscale(cells: &[u8], grid_w: usize, grid_h: usize, block: usize) -> Vec<u8> {
    let width = grid_w * block;
    let height = grid_h * block;
    let mut out = vec![0u8; width * height * 4];
    out.par_chunks_mut(width * 4)
        .enumerate()
        .for_each(|(y, row)| {
            let cy = y / block;
            for x in 0..width {
                let si = (cy * grid_w + x / block) * 3;
                let o = x * 4;
                row[o] = cells[si];
                row[o + 1] = cells[si + 1];
                row[o + 2] = cells[si + 2];
                row[o + 3] = 255;
            }
        });
    out
}

/// No anti-aliasing leaked: every pixel must be a ramp colour.
fn assert_palette(buf: &[u8], ramp: &[[u8; 3]]) -> Result<(), String> {
    let mut offenders: Vec<[u8; 3]> = Vec::new();
    let (pixels, _) = buf.as_chunks::<4>();
    for px in pixels {
        let color = [px[0], px[1], px[2]];
        if ramp.contains(&color) {
            continue;
        }
        if !offenders.contains(&color) {
            offenders.push(color);
            if offenders.len() > 3 {
                break;
            }
        }
    }
    if offenders.is_empty() {
        Ok(())
    } else {
        let list: Vec<String> = offenders.iter().map(hex_of).collect();
        Err(format!("off-palette pixels: {}", list.join(", ")))
    }
}

/// Every block uniform: proof the pixels are cells, not scaled artwork.
fn assert_blocks(buf: &[u8], width: usize, block: usize) -> Result<(), String> {
    let height = buf.len() / (width * 4).max(1);
    for y in 0..height {
        for x in 0..width {
            let base = ((y / block) * block * width + (x / block) * block) * 4;
            let i = (y * width + x) * 4;
            if buf[i] != buf[base] || buf[i + 1] != buf[base + 1] || buf[i + 2] != buf[base + 2] {
                return Err(format!(
                    "block at ({},{}) is not uniform",
                    x / block,
                    y / block
                ));
            }
        }
    }
    Ok(())
}

fn encode(path: &str, width: usize, height: usize, rgba: &[u8]) -> Result<(), String> {
    let file = fs::File::create(path).map_err(|e| format!("cannot write {path}: {e}"))?;
    let writer = BufWriter::new(file);
    let width32 = u32::try_from(width).map_err(|_| format!("width {width} overflows u32"))?;
    let height32 = u32::try_from(height).map_err(|_| format!("height {height} overflows u32"))?;
    let mut encoder = png::Encoder::new(writer, width32, height32);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    // The JS encoder (pngjs) defaults to zlib level 9 plus adaptive row filters.
    // Both are load-bearing for payload: a card is one flat picture, and with
    // the crate defaults the same pixels compressed to 75 KB instead of 10 KB.
    encoder.set_compression(png::Compression::Best);
    encoder.set_adaptive_filter(png::AdaptiveFilterType::Adaptive);
    let mut png_writer = encoder
        .write_header()
        .map_err(|e| format!("cannot encode {path}: {e}"))?;
    png_writer
        .write_image_data(rgba)
        .map_err(|e| format!("cannot encode {path}: {e}"))?;
    png_writer
        .finish()
        .map_err(|e| format!("cannot finish {path}: {e}"))?;
    Ok(())
}

fn hex_of(c: &[u8; 3]) -> String {
    format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ramp() -> Vec<[u8; 3]> {
        vec![[0x0a, 0x00, 0x70], [0x14, 0x00, 0xc3], [0xf8, 0xf2, 0xd8]]
    }

    #[test]
    fn box_down_averages_each_square() {
        // 2x2 cells, ss=2 -> 4x4 source. Top-left square averages to (1,2,3).
        let mut src = vec![0u8; 4 * 4 * 4];
        for y in 0..4 {
            for x in 0..4 {
                let i = (y * 4 + x) * 4;
                src[i] = x as u8; // 0,1,2,3
                src[i + 1] = y as u8;
                src[i + 2] = 10;
                src[i + 3] = 255;
            }
        }
        let cells = box_down(&src, 4, 2, 2, 2);
        // Cell (0,0): x in 0..2 -> mean 0.5 -> 1; y mean 0.5 -> 1.
        assert_eq!(&cells[0..3], &[1, 1, 10]);
        // Cell (1,1): x in 2..4 -> mean 2.5 -> 3; y mean 2.5 -> 3.
        assert_eq!(&cells[9..12], &[3, 3, 10]);
    }

    #[test]
    fn round_matches_js_math_round() {
        assert_eq!(round_channel(8, 16.0), 1); // 0.5 -> 1
        assert_eq!(round_channel(7, 16.0), 0);
        assert_eq!(round_channel(24, 16.0), 2); // 1.5 -> 2
    }

    #[test]
    fn quantize_snaps_an_exact_ramp_colour_without_dither() {
        let cells = vec![0x14, 0x00, 0xc3, 0xf8, 0xf2, 0xd8];
        let out = quantize(&cells, 2, &ramp());
        assert_eq!(&out[0..3], &[0x14, 0x00, 0xc3]);
        assert_eq!(&out[3..6], &[0xf8, 0xf2, 0xd8]);
    }

    #[test]
    fn quantize_picks_the_nearest_ramp_colour() {
        // Slightly off the ink swatch: still lands on it.
        let cells = vec![0x16, 0x02, 0xc0];
        let out = quantize(&cells, 1, &ramp());
        assert_eq!(&out[0..3], &[0x14, 0x00, 0xc3]);
    }

    #[test]
    fn upscale_repeats_each_cell() {
        let cells = vec![1, 2, 3, 4, 5, 6]; // 2x1 grid
        let out = upscale(&cells, 2, 1, 2);
        assert_eq!(out.len(), 4 * 2 * 4);
        // First row: two pixels of cell 0, then two of cell 1.
        assert_eq!(&out[0..4], &[1, 2, 3, 255]);
        assert_eq!(&out[4..8], &[1, 2, 3, 255]);
        assert_eq!(&out[8..12], &[4, 5, 6, 255]);
    }

    #[test]
    fn palette_assertion_rejects_an_off_ramp_pixel() {
        let buf = vec![0x14, 0x00, 0xc3, 255, 255, 0, 255, 255];
        let err = assert_palette(&buf, &ramp()).unwrap_err();
        assert!(err.contains("#ff00ff"), "{err}");
    }

    #[test]
    fn block_assertion_rejects_a_broken_block() {
        let buf = vec![0, 0, 0, 255, 90, 90, 90, 255];
        let err = assert_blocks(&buf, 2, 2).unwrap_err();
        assert!(err.contains("not uniform"), "{err}");
    }

    #[test]
    fn parse_hex_accepts_both_spellings() {
        assert_eq!(parse_hex("#0A0070").unwrap_or([0, 0, 0]), [10, 0, 112]);
        assert_eq!(parse_hex("0a0070").unwrap_or([0, 0, 0]), [10, 0, 112]);
        assert!(parse_hex("#fff").is_err());
    }

    #[test]
    fn rejects_a_block_that_does_not_divide_the_canvas() {
        let args = vec![
            "--src".to_string(),
            "a.png".into(),
            "--out".into(),
            "b.png".into(),
            "--block".into(),
            "7".into(),
            "--ss".into(),
            "4".into(),
            "--surface".into(),
            "#ffffff".into(),
            "--ramp".into(),
            "#000000".into(),
        ];
        let err = parse_args(args.into_iter()).err().unwrap_or_default();
        assert!(err.contains("does not divide"), "{err}");
    }
}
