# Cream image regime — `#f8f2d8`

Status: implemented 2026-10-20. Applies to every picture asset in `public/images/`:
the 22 hand-authored hero SVGs and the 6 OG/CV generators that write the PNG/PDF set.

## Why

The hero SVGs were dark teal (`#0f2a2b → #1a3435`) with light ink, and the OG banners
were royal blue with cream ink. Two dark regimes, neither matching the light theme's
card surface. The request: one cream picture surface, `#f8f2d8`, with readability
raised at the same time.

## Why not just invert

Every old token was light-on-dark. Flipping the surface without re-picking ink yields
1.0–2.6:1 text. The palette below is measured, not eyeballed; every ratio is WCAG 2.x
relative luminance against the surface it actually sits on.

## Surface

`#f8f2d8` — `CREAM_SURFACE` in `src/lib/brand.ts`. It is ΔRGB 2 from `CREAM_CARD`
(`#f8f2da`) and reads as the same sheet; the two names stay separate because one is a
UI fill and this one is a picture surface.

## Illustration palette (the 22 hero SVGs)

Hexes live in the SVGs themselves — `DESIGN.md:358` treats illustration tint as outside
the token system. The allowlist below is the contract, and
`tests/lib/illustration-palette.test.ts` enforces it.

| role | hex | contrast on `#f8f2d8` |
|---|---|---|
| surface (full-bleed rect, flat) | `#f8f2d8` | — |
| primary ink — titles, values, labels read first | `#0f2a2b` | **13.48:1** |
| muted ink — axes, captions, secondary labels | `#4a6b69` | **5.19:1** |
| accent ink — accent words, strokes, rules | `#a8331a` | **5.92:1** |
| accent ink, strong (rare, emphasis) | `#8c2c15` | **7.51:1** |
| accent fill — panels that carry dark ink | `#ff8569` | ink on it **6.36:1** |
| accent fill, light — same, softer | `#ffa68a` | ink on it **7.99:1** |
| accent fill, data-bearing with no text on top | `#d2573a` | **3.62:1** (≥3:1 graphics) |
| dim panel / well | `#0f2a2b` @ `0.06–0.10` opacity | — |
| hairline / rule | `#0f2a2b` @ `0.16–0.22` opacity | — |

Banned on cream: `#e4e4e7`, `#a1a1aa`, `#c9d6d5`, `#8aa3a2`, `#5f7a79`, `#d99`,
`#e4c9c9`, `#ffffff`, `#ff6643` **as text or stroke**, `#234044` **as an opaque fill**.

### Mapping from the old dark set

| old | new | note |
|---|---|---|
| gradient `#0f2a2b → #1a3435` | flat `#f8f2d8` | gradient kept only as a ≤6% wash if the composition needs depth |
| `#e4e4e7` | `#0f2a2b` | |
| `#a1a1aa` | `#4a6b69` | |
| `#c9d6d5`, `#8aa3a2`, `#5f7a79` | `#4a6b69` (or `#0f2a2b` where it was body text) | |
| `#ff8569`, `#ffa68a` as **text** | `#a8331a` | |
| `#ff6643` as fill behind dark text | `#ff8569` | dark ink on it stays |
| `#ff6643` as a bar/tick with no text | `#d2573a` | |
| `#234044` panel | `#0f2a2b` @ `0.08` | |
| `#3f3f46` rule/bar | `#0f2a2b` @ `0.18` | |
| `#0f2a2b` ink on a coral fill | unchanged | 6.36:1 on `#ff8569` |

### Type floor

Minimum `font-size` for any informational label: **22** (footnotes) / **26** (labels)
in a 1200×600 canvas. Below that a cover is unreadable at card width
(`clamp(260px, 38%, 420px)` ≈ 0.32×, so 22 → 7px). `streamlit.svg`'s 13/15px labels are
the reason this rule exists.

## Banner palette (OG PNGs and the CV cover)

Sourced from `src/lib/brand.ts` — no bare hex in a generator.

| role | token | hex | contrast on `#f8f2d8` |
|---|---|---|---|
| surface | `CREAM_SURFACE` | `#f8f2d8` | — |
| ink — titles, body, name, URL | `BANNER_INK` = `BRAND_BLUE` | `#1400c3` | **10.28:1** |
| deep ink — values, emphasis | `BANNER_INK_DEEP` | `#0a0070` | **14.98:1** |
| muted ink — role line, labels | `BANNER_MUTED` | `#5b4fc4` | **5.56:1** |
| accent — rules, rings, hexes, top bar | `BANNER_ACCENT` | `#b8431f` | **4.84:1** |

Retired on cream: `CREAM`/`#f4efca` and `#f8f2da` as ink (1.04:1), `MUTED #bdb5ea`
(1.70:1), `ACCENT_ON_BLUE #fe4e02` (2.96:1 — under the 3:1 graphics floor),
`PERI #9db4ff` (1.80:1), `PEACH #ffb38a` (1.55:1).

### Mapping from the blue set

| old | new |
|---|---|
| surface `#1400c3` / blue gradient | `#f8f2d8` |
| `CREAM #f4efca` ink | `#1400c3` |
| `#f8f2da` ink | `#1400c3` |
| `MUTED #bdb5ea` | `#5b4fc4` |
| `ACCENT_ON_BLUE #fe4e02` | `#b8431f` |
| well fill `#0a0070` | `#1400c3` @ `0.07` fill, `#1400c3` text |
| honeycomb stroke `CREAM @0.11` | `#1400c3 @0.10` |
| decorative hexes `CREAM @0.12` | `#1400c3 @0.14` |
| frame `CREAM @0.14` | `#1400c3 @0.18` |
| glow `ORANGE @0.08` | `#b8431f @0.10` |
| vignette `#000 @0.25` | `#1400c3 @0.06` |
| graph node fill `PERI`/`PEACH` | `#1400c3` / `#b8431f` tints |
| graph node hairline (was `BG` blue) | `#f8f2d8` on the fill, `#1400c3` when on the surface |
| chart area fill `ORANGE @0.12` | `#b8431f @0.14` |

The AA gate in `scripts/lib/og-render.mjs` must be re-pointed at `CREAM_SURFACE` in
every generator; it throws, so a missed token is a hard failure, not a silent one.
Decorative tokens are exempt and must be checked by eye — the lattice and rings are
the ones that vanish silently.

## Invariants (do not change)

- `viewBox="0 0 1200 600"` and 2:1 intrinsic ratio on every hero SVG — LHCI
  `image-aspect-ratio` and the `global.css:1776` frame both depend on it.
- Every filename stays put: `hero:` frontmatter, the `volta.svg` LCP preload and
  `tests/built/homepage-lcp.test.ts` bind them.
- OG canvas stays `1200×630` (banner) / A4 595.276×841.89 pt (cover).
- `ogImage` paths stay put; the generator writes `volta-neobank-case-study.png` for
  the `volta` slug through an explicit override.
- No `ogImage` may become `.svg` (`tests/lib/og-images.test.ts:80-88`).
