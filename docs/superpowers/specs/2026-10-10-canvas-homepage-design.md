# Canvas Homepage — Design

**Date:** 2026-10-10
**Status:** implemented; gate pass + one amendment 2026-10-10 — see docs/superpowers/plans/2026-10-10-canvas-homepage.md
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

## Amendment — 2026-10-10 (owner decision, settled)

Recorded here rather than folded silently into the text above, so a later reader can see
that the gate below was narrowed deliberately, and by whom.

**Gate 4 (non-text contrast) is amended: WCAG 1.4.11's 3:1 floor applies to the interactive
node borders — the role cards and the CTA links — and does not apply to the `aria-hidden`
decorative layers (the sketch strokes and the dot grid).**

Consequences, all binding:

- The interactive node borders must clear 3:1 against the page backdrop in every theme. The
  only border token that does is `--border-active`; the decorative `--border-color` hairline
  does not. The resting borders of the role cards and the CTA links therefore use
  `--border-active` — measured 6.36 / 5.72 / 8.27.
- The sketch strokes and the dot grid keep their designed subtlety. Their measured ratios
  stay in the results table **as recorded values, not as pass/fail**: they are decoration,
  hidden from assistive technology, and outside 1.4.11's scope. They are not defects and no
  change is owed on them.
- The amendment narrows the gate; it does not relax `--border-active`. That the resting border
  is drawn with `--border-active` is bound by `tests/built/canvas.test.ts` →
  `puts the resting border of the interactive nodes on --border-active`. The contrast ratio
  itself remains a measured value, not an assertion.

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

Fixed world **1440×900** (`WORLD = {w:1440,h:900}` in `src/lib/canvas-layout.ts`; an
earlier draft of this spec said 1600×900 — the implementation, and the plan's own
DESIGN.md text, use 1440×900). Node boxes are data in `src/lib/canvas-layout.ts`:

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

The starting viewport fits **all** nodes (k ≈ 1 for the layout content column against a
1440×900 world; at a 1440×900 window the measured k is 0.8028, because the viewport is
the content column rather than the window — see Measured results). Zoom is for
inspecting a node, not for discovering the page.

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

- Frames and arrows: `currentColor` / existing tokens. Hairlines `--border-color`.
  Focus rings use `--border-active` — measured **6.36:1 dark / 5.72:1 light / 8.27:1
  cyberpunk** against the page backdrop (Verified), clearing the 3:1 non-text floor.
  **Correction (measured):** as first built, the *interactive node borders* were **not**
  `--border-active` as an earlier draft claimed — the role cards used `--border-color`
  (1.45 / 1.09 / 1.44, below 3:1). *Fixed 2026-10-10:* the resting borders of the role
  cards and the CTA links now use `--border-active` (6.36 / 5.72 / 8.27). See the
  **Amendment** above for what the floor does and does not cover, and Measured results
  for the numbers.
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
| `transform: scale()` blurs text | Screenshot at k≈2.2 (dark + light, 1440×900): text renders crisp, no visible blur |
| 100vh canvas + the fixed CTA rail collide | Rail renders only at ≥1860px (`Base.astro`) and only `/` passes `showCtaRail`, so the inset lives on `index.astro` alone. Measured: no node under the rail at 1860/1920 |
| Wheel capture annoys visitors | Wheel scrolls; zoom only via modifier, buttons, or keyboard |

## Measured results (implemented)

Measured 2026-10-10 against the built output served with `bun run preview`
(`http://localhost:4321`), Chromium via Playwright, at 1024×768 and 1440×900 on `/`
and `/en/`. Themes were driven the way the site actually selects them — the
`localStorage.theme` key (`dark`/`light`/`cyberpunk`) that the pre-paint script in
`Base.astro` reads — not by emulating `prefers-color-scheme`, which LHCI does not set.
Evidence classes follow `.claude/rules/evidence-ledger.md`.

| Measurement | Result | Class | Behind it |
|---|---|---|---|
| `bun run build` | 201 pages, 0 errors | Verified | build |
| `bun run check` | 0 errors, 3 hints | Verified | `astro check` |
| `make check` | `OK: all checks passed` | Verified | bun test + `check_site.py` |
| `bun run test:built` | 117 pass / 0 fail | Verified | built-HTML suite |
| `:global(` in built CSS | 0 occurrences | Verified | `grep -c "global(" dist/_astro/Base.*.css` |
| theme overrides emitted | `html[data-theme=light] .canvas-sketch` and `html[data-theme=cyberpunk] .canvas-sketch` present as parsed rules, specificity 0,2,1 against the scoped base's 0,2,0 | Verified | parsed out of `dist/_astro/Base.*.css` |
| cyberpunk sketch override actually applies | `.canvas-sketch` computes `stroke: rgb(255,133,105)` (= `--border-active`), `stroke-opacity: 0.35` — before the fix it computed `rgb(42,42,74)` (= `--border-color`) | Verified | `getComputedStyle` on the built page, theme via `localStorage.theme` |
| JS-off marker in the markup | `<html … class="canvas-static">` in `dist/index.html` and `dist/en/index.html`; cleared only by the pre-paint script, restored by the module's catch | Verified | built HTML + `tests/built/canvas.test.ts` |
| rail inset scope | `padding-inline-end:var(--rail-total)` inlined **only** in `dist/index.html` (as `@media (width>=1860px)`); 0 in `dist/en/index.html` | Verified | grep of built HTML |
| `--vp-k` / `padding-inline-end`, `/` | 1024 → 0.6667 / 0px; 1440 → 0.8028 / 0px; 1859 → 0.8194 / 0px; 1860 → 0.6361 / 264px; 1920 → 0.6361 / 264px | Verified | `getComputedStyle('.canvas-viewport')` |
| same, `/en/` | padding `0px` at every width | Verified | same |
| rail clearance ≥1860px | no `.canvas-node` intersects the `.cta-rail` rect at 1860 or 1920 | Verified | rect intersection |
| sketch stroke contrast *(decorative — recorded, not judged)* | 1.45 dark / 1.09 light / 1.92 cyberpunk | Verified | computed stroke colour × `stroke-opacity`, composited over the page backdrop |
| dot grid contrast *(decorative — recorded, not judged)* | 1.15 / 1.10 / 1.15 | Verified | `--wallpaper-line` over the backdrop |
| `--border-active` vs page | **6.36 dark / 5.72 light / 8.27 cyberpunk** | Verified | reproduced numerically — the draft's arithmetic holds |
| role node border | **6.36 / 5.72 / 8.27 (= `--border-active`)**, clears the 3:1 floor | Verified | measured `border-top-color` on `a[data-node="role-hr"]` |
| CTA node borders | **6.36 / 5.72 / 8.27 (= `--border-active`)** on both `<a class="button">` inside `[data-node^='cta-']` | Verified | measured `border-top-color`; the earlier row here read the wrapper `<div>`'s `currentColor`, which is not a border |
| legibility at k≈2.2 | text crisp, no visible blur (dark + light) | Verified | screenshots at max zoom |
| keyboard order | Tab = reading order (nav → `cta-booking` → `cta-cv` → `role-*`); `window.scrollY` stays 0 throughout | Verified | Tab sequence on `/` and `/en/` |
| JS off — h1, claim, both CTAs | fully visible at 1024 and 1440, `/` and `/en/` | Verified | JS-disabled context, CDP `DOM.getBoxModel` intersected with `.canvas-viewport` |
| JS off — 3 role cards, `projects-all` | **fully visible (100%)** at 1024 and 1440 on both pages | Verified | same. Before the fix: ~30% at 1024, ~66% at 1440, `projects-all` off-screen at 1024 |
| JS off — decorative layers | `.canvas-grid` and `.canvas-sketch` are `display: none` in the stacked state | Verified | `DOM.getBoxModel` returns no box |
| Lighthouse a11y + perf, both themes | no score | **Blocked (environment)** | `@lhci/cli` + Chrome present, healthcheck passed, but Chrome could not load `localhost:4321` (`CHROME_INTERSTITIAL_ERROR`) |

### Mutation controls (2026-10-10)

Each fix carries an assertion that was run against the defect it claims to catch. All three
defects were reintroduced in one build; the named assertions went red. Numbers are the two
runs, nothing re-stated from memory.

| Defect reintroduced | Assertion that went red | With the defect | Reverted |
|---|---|---|---|
| `class="canvas-static"` dropped from `<html>` | `ships the not-live canvas marker on <html>` | red | green |
| `html[data-theme="cyberpunk"]` back to `[data-theme="cyberpunk"]` | `wins the cyberpunk canvas override on specificity, not on source order` | red | green |
| the resting-border rule deleted | `puts the resting border of the interactive nodes on --border-active` | red | green |
| (suite total) | — | 114 pass / 3 fail | 117 pass / 0 fail |

## PENDING

- `PersonaGate.astro` removal — deferred until the canvas is confirmed better on a real
  viewport; not deleted in this change.
- A real-device pass (physical iOS/Android), not emulation.
- A Lighthouse / axe run once a working headless Chrome is reachable offline (LHCI is
  Blocked above).
- The stacked state's node-flow declarations now exist twice, by necessity: once in
  `PersonaCanvas.astro`'s `max-width: 899px` query and once in `global.css` against
  `html.canvas-static`. CSS cannot OR a media query with a class selector, so a single copy
  is not expressible without editing `PersonaCanvas.astro` (out of this change's scope) or
  dropping the media query. They are kept adjacent and commented; nothing binds them to
  stay in step.
- The 768–900px band has no dedicated capture; only 1024 and 1440 were measured.

## Notes — what the measurements refuted

- **`:global()` in a global stylesheet is dead CSS.** `global.css` is imported
  directly, not scoped to a component, so `:global([data-theme=…])` was emitted
  verbatim and the browser dropped the rule — the light and cyberpunk sketch overrides
  never applied. Corrected to plain selectors; bound by `tests/built/canvas.test.ts` →
  `emits no :global( left in any built stylesheet`.
- **The rail inset sat on the wrong breakpoint.** It reserved `--rail-total` from
  1100px, but `.cta-rail` renders only at ≥1860px and only `/` passes `showCtaRail` —
  so `/en/` reserved 264px for a rail it never renders. Moved onto `index.astro`.
- **The fit is not `k = 1`.** `.canvas-viewport` is the layout content column (960px at
  a 1024 window, 1156 at 1440, 1180 at ≥1860), not the window, so k is fractional even
  with the rail absent (0.8028 at 1440). The padding is absent where the rail is absent,
  which is the behaviour actually required.
- **Sketch strokes and the dot grid do not clear 3:1** (1.09–1.92 measured). They are
  decorative and `aria-hidden`, so by the **Amendment** above the non-text floor does not
  apply to them; the numbers above are recorded, not judged. What the draft got wrong was
  the other half: the interactive borders were `--border-color` (role) — now
  `--border-active`, see the results table.
- **The cyberpunk sketch override was defeated by cascade order.** `PersonaCanvas.*.css`
  loads after `Base.*.css`; the scoped `.canvas-sketch[data-astro-cid-…]` (0,2,0) tied
  with `[data-theme=cyberpunk] .canvas-sketch` (0,2,0), so source order let the base
  `stroke: var(--border-color)` win — only `stroke-opacity:.35` survived. *Fixed
  2026-10-10* by anchoring both theme selectors on `html[data-theme=…]` (0,2,1), which wins
  on specificity regardless of emission order. Proven on the built page, not in the
  source: `.canvas-sketch` now computes `stroke: rgb(255,133,105)`. Bound by
  `tests/built/canvas.test.ts` → `wins the cyberpunk canvas override on specificity, not on
  source order`, which compares specificities parsed out of the emitted CSS.
- **JS off used to clip the gate.** With no script to correct the SSR fit, `.canvas-viewport`
  is narrower than the 1440-wide world and the right-hand nodes fell outside it. *Fixed
  2026-10-10* by shipping a `canvas-static` marker on `<html>` that only the pre-paint script
  clears — so the stacked layout also applies when JavaScript never runs, without a second
  copy of the content in the markup. Bound by `tests/built/canvas.test.ts` → `ships the
  not-live canvas marker on <html>` and `clears the marker only from script…`.
- **The spec said world 1600×900; the implementation is 1440×900**
  (`WORLD = {w:1440,h:900}`), which the plan's own DESIGN.md text already used.

## Out of scope

- Dragging individual nodes (positions stay authored, not user-movable)
- Persisting a viewport in `localStorage`
- `ProofBand` and every section below the hero
- Replacing `/graph/`, which keeps its own SVG implementation
