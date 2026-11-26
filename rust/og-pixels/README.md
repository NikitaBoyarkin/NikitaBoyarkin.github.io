# og-pixels

The rasteriser behind `scripts/lib/pixel-og.mjs` and every pixel-art OG card in
`public/images/og/`.

**What it does.** Takes the PNG `rsvg-convert` produced from a card's SVG
(960x504, i.e. the 240x126 cell grid supersampled 4x), box-averages each 4x4
square to one cell, snaps the cell to the eight-step brand ramp with a 4x4 Bayer
bias where the cell is between two ramp colours, nearest-upscales back to
1200x630, then asserts that every pixel is a ramp colour and every block is
uniform. Output: the shipped card.

**Why it exists.** The same three passes in JavaScript are correct but slow: the
palette assertion alone spent ~116 ms per card walking 756 000 pixels through a
`Buffer.slice` plus a template string, and one full OG run touches ~55 cards. The
whole family (`og`, `og:sections`, `og:home`, `og:community`, `og:graph`) went
from ~12 s to ~3.3 s with this binary; what remains is `rsvg-convert` itself.

**Behaviour is pinned, not "close enough".** The port mirrors the JS one for one
— integer box sum divided by `SS*SS` and rounded, `<` on the distance comparison
so the lower ramp index wins a tie, the same Bayer bias formula, the same
early-exit order in the palette scan. `tests/lib/pixel-og-engine.test.ts` renders
one card through both engines and compares every pixel; the shipped cards were
regenerated and verified pixel-identical against the JS engine before this
binary landed (55 images, 0 differing pixels), which is also why their
compression improved ~34% without any visual change.

## Usage

The script calls it for you. To build or rebuild it by hand:

```sh
cargo build --release --manifest-path rust/og-pixels/Cargo.toml
```

`scripts/lib/pixel-og.mjs` builds it on first use when the binary is missing and
`cargo` is on PATH; otherwise it falls back to the JS engine (with a warning) so
a checkout without Rust still renders cards.

| Env var | Effect |
| --- | --- |
| `OG_PIXELS=rust` | Require the binary; throw instead of falling back |
| `OG_PIXELS=js` | Pin the JavaScript engine |
| `OG_PIXELS_BUILD=0` | Never attempt a build from the script |

## CLI

```sh
og-pixels --src card.src.png --out public/images/og/card.png \
  --block 5 --ss 4 \
  --surface "#f8f2d8" \
  --ramp "#0a0070,#1400c3,...,#f8f2d8"
```

The ramp and surface arrive as arguments because the palette has one home:
`src/lib/brand.ts`. This binary owns no brand colour of its own, exactly like the
generators.

## The one intentional difference

PNG *bytes* differ from the JS encoder (zlib implementation and filter choice),
so the shipped files are ~34% smaller. Pixels are identical; the card contract is
the pixel grid, not the byte stream. Keep that in mind if a diff ever shows a
regenerated card: compare pixels, not bytes.
