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
| `.kg-root.kg-bare .kg-svg { inline-size: min(100%, calc(74svh * 900/560)) }` | capped box, `preserveAspectRatio="meet"` inside it | Uncapped, the 900:560 viewBox is ~896px tall at 1440px and pushes the controls off a laptop screen; `meet` letterboxes, so nothing stretches |
| `bleed` prop on `Base` | `bleed` class on `<html>` → `html.bleed body, html.bleed main { max-width:none; margin-inline:0 }`, `html.bleed .nav-mobile { margin-inline:0 }` | The cap is not only `.container`'s: `body` has its own `max-width` and page gutter, and from the desktop breakpoint `main` carries `--content-max`. `.nav-mobile` cancels the gutter with negative margins, which would push the bar past both edges once the gutter is gone |
| `.graph-board` | picks up the `.canvas-grid` dot rule (shared selector list, same `--wallpaper-line` token) | Same texture as the homepage board without duplicating the gradient |

The document is **not** locked to `100dvh` — the page scrolls, and the JS-off
fallback is the SSR SVG, unchanged.

Defaults are `false` on both props, so the graph embedded on the role landings
(`/colleague/`, `/en/colleague/`) keeps its card.

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
