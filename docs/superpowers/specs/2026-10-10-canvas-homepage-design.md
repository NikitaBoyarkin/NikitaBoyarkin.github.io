# Canvas Homepage — Design

**Date:** 2026-10-10
**Status:** approved (design), implementation not started
**Scope:** `/` and `/en/` homepage hero + role gate
**Supersedes:** nothing — combined with the 2026-10-05 homepage redesign brief

## Goal

The homepage hero and role gate should read as an **Excalidraw canvas**: a dot-grid
field, hand-drawn sketchy frames, a pan/zoom viewport. Content stays real HTML —
the "canvas" is a transform layer over semantic DOM, not a `<canvas>` element.

### Why not a literal canvas

`/` is the site's primary landing page: Person JSON-LD, `speakable.cssSelector: ['h1']`,
the OG banner, and the role gate that routes to `/hr/`, `/manager/`, `/colleague/`.
Rendering it into `<canvas>` (or embedding `@excalidraw/excalidraw`) would hide every
word from crawlers and screen readers and cost a ~1 MB React island for an editor the
visitor never edits. The hand-drawn look is achieved with sketchy **lines**, not with
a canvas API.

## Decisions (owner, 2026-10-10)

| Question | Decision |
|---|---|
| What lives on the canvas | Hero + role gate. `ProofBand` stays an ordinary section below. |
| Interaction | Pan + zoom |
| Typography | Cormorant + Inter kept. Hand-drawn is **lines only** — no new font download. |
| Viewport | 100vh |
| Mobile (<768px) | Static stack; canvas is progressive enhancement for ≥768px |
| 2026-10-05 redesign brief | Combined — sketchy layer over the editorial order and type scale |

## Architecture

A transform layer over real DOM.

```
.canvas-viewport          position: relative; block-size: 100vh; overflow: hidden
  └ .canvas-world         position: absolute; inset: 0;
                          transform: translate(var(--vp-tx), var(--vp-ty)) scale(var(--vp-k));
                          transform-origin: 0 0;
      ├ .canvas-grid      dot grid (radial-gradient tile), scales with the world
      ├ .canvas-sketch    decorative SVG: sketchy frames + connector arrows, aria-hidden
      └ .canvas-nodes     real <h1>, <p>, <a> at absolute world coordinates
  └ .canvas-controls      zoom in / out / reset buttons
```

Pan/zoom math is **not** rewritten — it reuses `src/lib/graph-zoom.ts`
(`clampZoom`, `zoomAt`, `panBy`, `centerOn`, `viewBoxOf`), which is already pure and
unit-tested. The world coordinates are `Viewport.x/y` plus `k`, mapped to CSS
variables by a thin adapter.

### World and layout

Fixed world **1600×900**. Node boxes are data in `src/lib/canvas-layout.ts`:

| Node id | Content | Kind |
|---|---|---|
| `identity` | `<h1>` + role + PhD line | text block |
| `claim` | the claim paragraph | text block |
| `cta-booking` | Book 30 minutes (`booking_click`) | `<a>` |
| `cta-cv` | CV (`cv_download_pdf`, `download`) | `<a>` |
| `role-hr` / `role-manager` / `role-colleague` | the three gate cards | `<a>` |
| `projects-all` | "Show all N projects" | `<a>` |

DOM order is the reading order: identity → claim → CTAs → role cards → projects-all.
It must not depend on the visual coordinates, so a screen reader and a crawler see a
sane document regardless of where a box sits in the world.

### Initial view: the whole board

The starting viewport fits **all** nodes (k ≈ 1 for a 1440×900 window against a
1600×900 world). Zoom is for inspecting a node, not for discovering the page.

This is the load-bearing choice. It keeps h1 and all three role links visible with
zero interaction, which protects LCP, keeps the gate doing its job, and avoids the
"content is somewhere off-screen" antipattern. The transform is computed on the
server and rendered inline as `--vp-*` so there is no flash and no layout shift.

### Sketchy frames

`src/lib/sketch.ts` — deterministic hand-jittered path generator.

- `mulberry32` PRNG seeded per node (`hash(nodeId)`), so a given node draws the same
  shape on every build and in every test run.
- Two-pass stroke with corner overshoot and bounded amplitude, matching Excalidraw's
  sloppiness mechanic.
- Pure function: `sketchRect(w, h, seed) → { paths: string[], points: number }`.

No dependency. If the result reads as cheap, the fallback is `roughjs` as a
**build-only devDependency** — its generator emits drawable ops without a DOM, so the
paths would still be inlined at build with zero runtime cost. Not adopted unless
needed.

### Interaction

| Input | Behavior |
|---|---|
| Drag | Pan |
| Wheel | **Scrolls the page** |
| Cmd/Ctrl + wheel | Zoom at pointer |
| Zoom buttons (±/reset) | Zoom at viewport center |
| `+` / `-` / `0` | Zoom in / out / fit |
| Tab | Focus moves through the real links; canvas pans to the focused node |

Wheel deliberately does **not** hijack the page scroll. The classic hostile-canvas
antipattern (wheel zooms, the visitor cannot leave) is avoided; zoom has three other
routes including a keyboard one.

Zoom clamp is **0.6–2.2**, tighter than the graph's 0.3–4 — this is a 100vh landing
surface, not an exploration tool.

`focusin` on a node → `centerOn(node)` with a transition; instant when
`prefers-reduced-motion: reduce`.

### Mobile

Below 768px: `.canvas-viewport` becomes `block-size: auto; overflow: visible`, the
world loses its transform, and nodes flow in a single column. Same markup, same links
— a CSS media query plus a JS feature guard. No touch-action surgery, no scroll
conflict.

### Styling and tokens

- Frames and arrows: `currentColor` / existing tokens. Hairlines `--border-color`;
  interactive node borders and focus `--border-active` (6.36:1 dark, 5.72:1 light,
  8.27:1 cyberpunk — clears the 3:1 non-text floor in all three themes).
- Dot grid: `radial-gradient` tile at `--wallpaper-line`, laid on the world layer so
  it pans and zooms with the content. It follows the existing honeycomb wallpaper's
  token rather than introducing a second texture colour.
- No raw hex outside `brand.ts`. No `--dv-*` token on anything interactive
  (`DESIGN.md` rule).
- `transform: scale()` on text is re-rasterized by modern engines, but legibility at
  k=2 is verified by screenshot rather than assumed.

### Accessibility and SEO

- `<h1>`, `<a>` and prose are live DOM in document order. No text in canvas or SVG.
- Sketch and arrow layers are `aria-hidden="true"`.
- Zoom controls are real `<button>`s with labels; the viewport exposes no ARIA canvas role.
- Analytics is untouched: `persona_gate_view`, `persona_selected`, `cta_exposure`,
  `booking_click`, `cv_download_pdf`, and the `is-stored` / `is-suggested` highlight
  logic all carry over from `PersonaGate.astro`.

## Files

| File | Status | Role |
|---|---|---|
| `src/lib/canvas-layout.ts` | new | node coordinates + initial viewport (pure) |
| `src/lib/sketch.ts` | new | deterministic jittered paths (pure) |
| `src/components/CanvasStage.astro` | new | viewport, controls, pan/zoom script |
| `src/components/PersonaCanvas.astro` | new | gate content re-authored as canvas nodes |
| `src/pages/index.astro` | edit | `PersonaGate` → `PersonaCanvas` |
| `src/pages/en/index.astro` | edit | same, EN |
| `src/styles/global.css` | edit | canvas layer tokens and rules |
| `tests/lib/canvas-layout.test.ts` | new | layout math |
| `tests/lib/sketch.test.ts` | new | determinism, bounded jitter |
| `tests/built/canvas.test.ts` | new | h1 + role links present in `dist/index.html` |
| `DESIGN.md` | edit | document the canvas layer and the editorial combination |

`PersonaGate.astro` is **not** deleted in this change. It stays until the canvas is
confirmed better on a real viewport; removal is a separate follow-up.

## Baseline: uncommitted work

The site repo carries uncommitted work on exactly these surfaces (CV button in the
hero, `showCtaRail` on `/`, `is-suggested` state, `cta_exposure`, additions to
`tests/lib/persona.test.ts`). The canvas is built **on top of** that working-tree
state — none of it is reverted. Whether that work lands as its own commit before the
canvas branch is the owner's call.

## Tests and gates

- `tests/lib/canvas-layout.test.ts` — node boxes stay inside the world; no two boxes
  overlap; the initial viewport contains every node box's center; `zoomAt`/`centerOn`
  clamping via `graph-zoom`.
- `tests/lib/sketch.test.ts` — same seed → identical paths; different seeds → different
  paths; jitter amplitude within the declared bound; path count matches the two-pass
  contract. A passing run must bite: mutating the amplitude constant has to fail it.
- `tests/built/canvas.test.ts` — `dist/index.html` and `dist/en/index.html` contain the
  `<h1>`, the three role links (`/hr/`, `/manager/`, `/colleague/` and EN equivalents),
  both CTAs, and no `role="img"` wrapper around text.
- Verify order: `npm run build` → `npm run check` (astro check 0) → `make check`
  (bun test + `check_site.py`) → axe/Lighthouse in **both** themes.
- LHCI does not emulate `prefers-color-scheme`: the OS theme decides, so a
  light-theme-only contrast bug does not reproduce locally. Both themes are checked
  explicitly (see `reference-astro-pitfalls`).

## Risks

| Risk | Mitigation |
|---|---|
| Canvas degrades the gate — a role link off-screen at 1440/1024 | Initial view fits every node; verified by measurement at both widths |
| Sketchy paths read as cheap rather than hand-drawn | Screenshot before polish; `roughjs` (build-only) is the fallback path |
| `transform: scale()` blurs text | Screenshot at k=2, not assumed |
| 100vh canvas + the fixed CTA rail collide | Rail is fixed at ≥1100px; canvas padding accounts for `--rail-total` |
| Wheel capture annoys visitors | Wheel scrolls; zoom only via modifier, buttons, or keyboard |

## Out of scope

- Dragging individual nodes (positions stay authored, not user-movable)
- Persisting a viewport in `localStorage`
- `ProofBand` and every section below the hero
- Replacing `/graph/`, which keeps its own SVG implementation
