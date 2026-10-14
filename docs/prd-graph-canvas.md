# PRD — `/graph/` as a full-width board

**Date:** 2026-10-13 · **Status:** shipped · **Files:** `src/pages/graph.astro`,
`src/pages/en/graph.astro`, `src/components/KnowledgeGraph.astro`,
`src/layouts/Base.astro`, `src/styles/global.css`,
`tests/built/graph-page.test.ts`

## Problem

The graph page presented the graph inside a card (`KnowledgeGraph`'s `.kg-root`:
`background-secondary`, 1px border, `radius-lg`, `space-5` padding) inside a
1180px column inside a 1000px `body`. On a 1440px window that left roughly
130px of dead margin per side around a framed panel — while the homepage next to
it presents content as a board: edge to edge, on a dot grid, no frame.

Owner's request: make the graph page read like the homepage board; the card is
not wanted.

"Canvas" here means **the board's presentation**, not an HTML `<canvas>`. The
graph is SSR SVG with its own zoom/pan engine; it was not moved onto
`CanvasStage` (a second zoom engine plus a 100vh clip would fight the existing
one), and the `canvasFullBleed` prop was not reused — its document lock is gated
on `canvas-static` being cleared by `CanvasStage`'s script, which never runs on
this page.

## Decision

Four small, additive props and classes; no rewrite of the graph itself.

| Piece | Mechanism | Why |
|---|---|---|
| `bare` prop on `KnowledgeGraph` | `kg-bare` class → drops background, border, radius, vertical padding; keeps the page's inline gutter | The card surface goes, but the search bar and controls must not start at the window edge |
| `.kg-bare:not(.kg-fullscreen)` | selector guard | The fullscreen overlay takes its surface from `.kg-root`; a bare reset would make it transparent |
| `.kg-root.kg-bare:not(.kg-fullscreen) .kg-svg { inline-size: min(100%, calc(74svh * 900/560)) }` | capped box, `preserveAspectRatio="meet"` inside it | Uncapped, the 900:560 viewBox is ~896px tall at 1440px and pushes the controls off a laptop screen; `meet` letterboxes, so nothing stretches. The guard is load-bearing: `kg-bare` stays on the root inside the overlay, so without it this cap also governs fullscreen (see the follow-up below) |
| `bleed` prop on `Base` | `bleed` class on `<html>` → `html.bleed body, html.bleed main { max-width:none; margin-inline:0 }`, `html.bleed .nav-mobile { margin-inline:0 }` | The cap is not only `.container`'s: `body` has its own `max-width` and page gutter, and from the desktop breakpoint `main` carries `--content-max`. `.nav-mobile` cancels the gutter with negative margins, which would push the bar past both edges once the gutter is gone |
| `.graph-board` | picks up the `.canvas-grid` dot rule (shared selector list, same `--wallpaper-line` token) | Same texture as the homepage board without duplicating the gradient |

The document is **not** locked to `100dvh` — the page scrolls, and the JS-off
fallback is the SSR SVG, unchanged.

Defaults are `false` on both props, so the graph embedded on the role landings
(`/colleague/`, `/en/colleague/`) keeps its card.

## Follow-up — the `⛶` overlay (2026-10-14)

The button was reported broken on `/graph/`: clicking it left the graph *smaller*
than the inline board. The overlay was already `position: fixed; inset: 0`, so
three separate things had to be true for it to fail — and all three were:

| Defect | Mechanism | Fix |
|---|---|---|
| The overlay sized itself to its section, not the viewport | `<section class="graph-board reveal">` kept a residual `transform: translateY(0)` after the reveal. **An identity matrix is still a transform**, and a transformed element is the containing block for `position: fixed` descendants. Measured at 1280×800: overlay `1280×212` at y=87, drawing **41×25** | `.reveal.visible` settles on `transform: none` — the same value the reduced-motion and `@media (scripting: none)` branches already use, and what HEAD already had before an uncommitted edit regressed it |
| The drawing was clamped to 951px inside a 1280px overlay | `.kg-root.kg-bare .kg-svg` kept matching in the overlay (`kg-bare` stays on the root there), so the *embedded* board's width cap governed fullscreen too | `:not(.kg-fullscreen)` on that rule |
| The overlay's whole first row was unclickable | It took `--z-overlay` (1000), which is the drawer scrim and sits *below* the sticky top bar — the bar shares `--z-dialog` (1200) with the drawer it opens. The search box, the legend and the zoom/exit controls painted behind a 65px bar | new `--z-fullscreen: 1300` token, above the dialog layer |
| The overlay drew *less* drawing than the board it replaced | `padding: var(--space-5)` and `.kg-root`'s 1px border. `--page-pad` drops to 15px under 768px, so the fixed 20px gutter plus the border made the fullscreen drawing 12px narrower than the inline one on a phone (345px → 333px); the 40px of block padding made it 5px shorter on a 700px-tall window (518px → 513px) | `padding: var(--space-4) var(--page-pad)`, `border: 0` |

After the fix the overlay measures `0,0,W,H` at 1440/1024/375 and the drawing is
at least as large as the inline board at every size (1231×766 vs 1070×666 at
1440×900).

## Verification

`tests/built/graph-page.test.ts` binds every claim above against `dist/`:
`bleed` on `<html>` and no `canvas-fullbleed`; the `.graph-board` section and no
`class="container` wrapper; exactly one `<h1>`; `id="kg-root"` carrying
`kg-bare`; the unchanged `viewBox`/`preserveAspectRatio`; the screen-reader
description and generator line still in the markup; and `/colleague/` as the
control — `kg-root` present, `kg-bare` absent.

Plus `bun run check`, `bun test tests/lib`, `python3 -I scripts/check_site.py`,
and a browser pass at 1440 / 1024 / 375px across dark / light / cyber, RU and
EN, with JS off and through the `⛶` fullscreen toggle (which stays opaque).

The follow-up above is bound by the `graph fullscreen overlay (built CSS)` block
in the same test file: `.reveal.visible` settling on `transform: none` (not
`translateY(0)`), the overlay's `position:fixed`/`inset:0`/`z-index`, its
`--z-fullscreen` token resolving *above* `--z-dialog`, the `:not(.kg-fullscreen)`
guard on the bare cap, and the overlay's `--page-pad` gutter. Each assertion was
checked to fail against the pre-fix build before landing.
