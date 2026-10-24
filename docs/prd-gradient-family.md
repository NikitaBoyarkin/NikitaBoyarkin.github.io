# PRD — Gradient family

**Status:** implemented 2026-10-11, committed (`5aabc3a`, by the owner). Gate chain green. Built-CSS binding and the mechanical half of the browser pass added the same day — `tests/built/gradient.test.ts`, `scripts/probe-gradient.mjs`. The aesthetic pass is still open; see "Remaining work" and "Evidence".
**Owner request:** `/astro` — *«добавь градиента в стиль»*.

## 1. Problem

Gradient recipes exist on the site, but as four unnamed one-offs with no theme parity and no test:

| Where | Recipe today |
|---|---|
| `#intro::before` | `radial-gradient(circle, color-mix(--text-accent 8%, transparent), transparent 70%)` |
| `.intro-photo::before` | same idea at 14% |
| `.project::before`, `.blog-card::before` | `linear-gradient(90deg, --text-accent, --text-accent-hover)` hover bar |
| `html[data-theme="light"] .persona-card` | `linear-gradient(180deg, --card-background, color-mix(… 86%, --background-primary))` |
| `.about-body` | `linear-gradient(90deg, --text-accent 0%, transparent 65%)` |
| `.skeleton` | shimmer |
| `CanvasStage.astro` | mesh backdrop for the dataviz panel |

Consequences: each new gradient re-derives its own stop list; a theme that needs a gentler ramp gets a bespoke override; and **no mechanism notices when a gradient starts carrying text it can't carry**.

## 2. Goal

One named, theme-aware gradient family in the token layer, applied at five surfaces, bound by a test — so a later edit to a stop or a theme cannot silently ship unreadable text.

**Non-goals.** No second accent. No gradient-filled text. No new hexes. No change to `public/games` or `src/lib/graph.ts` palettes.

## 3. Constraints discovered

These two facts decided the design; both are load-bearing.

1. **`contrast-gate.js` cannot see gradients.** `.claude/hooks/contrast-gate.js:37` states it as a deliberate coverage limit: *"Only solid hex values and single-level `var(--token)` references resolve. rgba()/hsl()/8-digit hex and **gradient backgrounds are skipped**."* Reusing the hook is not an option without rewriting its documented contract.
2. **`brand.test.ts` cannot see them either.** Its parser is `--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;` — a `linear-gradient(...)` value never matches.

Also: **axe/Lighthouse cannot measure text over a gradient**, which is why gradient-filled text is banned in this PRD (REQ-04).

## 4. Requirements

| ID | Requirement |
|---|---|
| REQ-01 | Five tokens — `--gradient-hero`, `--gradient-surface`, `--gradient-button`, `--gradient-rule`, `--gradient-page` — defined in `:root`. |
| REQ-02 | Every colour stop is an **existing brand token** or `transparent`. A raw hex in a gradient token is a defect. |
| REQ-03 | Because stops are `var()` references, they resolve per theme with no per-theme duplication. Per-theme blocks override **composition only** (a percentage), never colour. |
| REQ-04 | No gradient is applied to text (`background-clip: text`). Section headings keep `--text-normal`; the accent lives in a rule/underline beside them. |
| REQ-05 | Intensity is subtle: accent share ≤14% on large surfaces, so the accent area budget (≤15%, `DESIGN.md`) holds. `--gradient-page` is the widest member but carries no accent at all — a three-stop diagonal across dominant surfaces — so the budget rests on the hero glow and the rule. `scripts/audit-palette-coverage.mjs` measures the rendered share. |
| REQ-06 | A test binds the invariant: stop allowlist + worst-case ramp composite vs the text token that sits on that surface, with mutation control. |
| REQ-07 | Gradients are removed under `@media print`, `@media (forced-colors: active)`, `@media (prefers-contrast: more)` — joining the wallpaper removal list at `DESIGN.md:303`. |
| REQ-08 | `DESIGN.md` documents the family and names the binding test. |

## 5. Design

```css
/* :root — one definition; the stops resolve per theme through var() */
--gradient-hero: radial-gradient(
  60% 80% at 85% 8%,
  color-mix(in srgb, var(--text-accent) 10%, transparent),
  transparent 70%
);
--gradient-surface: linear-gradient(
  180deg,
  var(--card-background),
  color-mix(in srgb, var(--card-background) 88%, var(--background-primary))
);
--gradient-button: linear-gradient(135deg, var(--button-bg), var(--button-bg-hover));
--gradient-rule: linear-gradient(90deg, var(--text-accent) 0%, transparent 70%);
```

The ramp can only interpolate between two endpoints that **already clear AA** (`--card-background`, `--text-normal`, `--button-bg`, `--button-ink`), which is what makes a subtle gradient safe by construction rather than by inspection.

Per-theme overrides — composition only:

| Theme | Override | Why |
|---|---|---|
| `[data-theme="light"]` | `--gradient-surface` mix 88% → **94%** | on cream, the 12% step reads as a smudge; matches the shipped `.persona-card` 86% precedent |
| `[data-theme="cyberpunk"]` | `--gradient-hero` 10% → **14%** | theme runs its lattice at 0.10 vs 0.07 elsewhere |

`brand.ts` is deliberately untouched: no new hex exists to store. The stops stay covered by the existing drift gate *because they are existing tokens*.

## 6. Mechanism

`tests/lib/gradient-tokens.test.ts`, modelled on `tests/lib/demo-tokens.test.ts`:

1. Parse every `--gradient-*` token from each theme block.
2. **Completeness** — an expected token missing from a theme that overrides it fails (so "fix" by deletion cannot pass).
3. **Stop allowlist** — a raw hex stop fails. This is the failure mode `reference-astro-pitfalls` records for `public/games` (`--accent:#ff6643` surviving a palette change unseen).
4. **Worst-case composite** — sample the ramp at 0/25/50/75/100%, composite each sample over the token's base surface, assert the text token on that surface holds AA: `--text-normal` on cards, `--button-ink` on the fill. The button case is the real one — light-theme `button-bg` vs `bg-primary` is already 2.86:1 (`DESIGN.md`, "measured, not gated"), so the ramp must not darken under the ink.
5. **Mutation control** — a deliberately failing gradient must go red, proving the parser compared values.

`contrast-gate.js` is **not** modified: it is an edit-time nudge, and compositing a ramp inside it is more machinery than the invariant needs. Its stated coverage limits stay true.

## 7. Acceptance

- `bun test tests/lib` green, including the new file.
- `bun run build` → 203 pages; `bun run check` → 0 errors; `make check` green.
- Visual pass at all three themes × desktop/mobile: hero, project card (rest + hover), primary button, section rule.
- Accent area still within the `≤15%` budget by the method at `DESIGN.md:195`.
- LHCI a11y ≥0.95 on `/` and `/en/`.

## 8. Risks & ceilings

| Risk | Handling | Ceiling |
|---|---|---|
| axe reports gradient backgrounds as `color-contrast` *incomplete*, not pass | Run LHCI on `/` and `/en/`; if a11y drops, reduce hero alpha first | the hero glow is the only large accent-tinted area |
| Gradient swap is not `transition`-able (`background-color` transition won't animate it) | accepted for now; hover states already carry `transform` + `box-shadow` | do not add a `background-image` transition — layout cost |
| `--gradient-surface` overlaps the existing `.project::before` hover bar and `transform` | verify hover visually in all three themes | both are pseudo-elements, no cascade conflict expected |
| Astro scoping | application rules live in unscoped `global.css`; a scoped `<style>` would need `html[data-theme='…']` mass, **not** `:global()` (`reference-astro-pitfalls` §49/§51) | — |

## 9. Remaining work

- [x] `tests/lib/gradient-tokens.test.ts` — written; the invariant is bound.
- [x] `--gradient-hero` — applied to `#intro::before`.
- [x] `--gradient-rule` — applied to `#projects h2::after`.
- [x] `DESIGN.md` — Gradients section, token table, line in Contrast Verification (**REQ-08**).
- [x] `@media print` / `forced-colors` / `prefers-contrast: more` removal (**REQ-07**).
- [x] Gate chain run — see "Evidence".
- [x] **Built-CSS binding** (`tests/built/gradient.test.ts`, 2026-10-11) — the collapse block, the five token definitions, the two per-theme overrides and the application rules are now asserted against `dist/_astro/*.css`. Previously the emitted block was confirmed by hand and nothing enforced it.
- [x] **Browser pass, mechanical half** (`scripts/probe-gradient.mjs`, 2026-10-11) — three themes × desktop/mobile over the routes that actually carry the surfaces: computed styles, hover, screenshots. REQ-07 is re-checked in the engine, not in the source text.

Open, deliberately not closed:

- [ ] **Aesthetic judgement.** The probe proves each surface paints *a* gradient and that the collapse works; it cannot say the ramp looks right. Screenshots in `reports/gradient-shots/` await a human (or vision) pass.
- [ ] **Route drift in §1/§5.** The surfaces are not on `/`. `#intro` and `.featured-card` live on the persona routes (`/hr/`, `/manager/`, `/colleague/`, plus EN), `.blog-card` on the writing routes (`/notes/`, `/en/writing/`, `/topics/*`), `.project` on `/projects/`. §1's table reads as if these were homepage rules — true of the source, misleading about where they render. The probe's card surface therefore points at `/projects/`: `/colleague/` carries exactly one `.featured-card` and it is the hero variant, so requiring a card there asked for something the design deliberately omits.
- [ ] **`.featured-card-hero` is deliberately unfilled.** On `/colleague/` the first `.featured-card` also carries `featured-card-hero`, and `.hero-visual .featured-card-hero` (`global.css:1414`) sets `background: none` at higher specificity — so the family reaches non-hero cards only. Verified, not a defect; §11's `.featured-card → --gradient-surface` holds for the non-hero class alone.

## 10. Evidence

| Claim | Class | Note |
|---|---|---|
| 379 `tests/lib` tests pass, 13 of them new | Verified | `bun test tests/lib` |
| Build produces 203 pages | Verified | `bun run build` (the 135 in earlier PRDs is stale) |
| `astro check` 0 errors / `make check` green | Verified | includes `check_site.py` link + metrics drift |
| Ramp holds AA in all three themes | Verified | composite at 0/25/50/75/100%; narrowest **4.93:1** (light hero under `--text-accent`) |
| The gate bites | Verified | 5 mutation-control cases in-file assert red |
| Tokens and 4 application rules reach `dist` | Verified | grep on `dist/_astro/Base.*.css` |
| The built CSS is bound, not just the source | Verified | `tests/built/gradient.test.ts`, 8 tests / 20 assertions, incl. 3 mutation controls |
| The collapse is real in the engine | Verified | `probe-gradient.mjs`: under `print`, `forced-colors: active` and `prefers-contrast: more` the hero's `background-image` is `none` and no `--gradient-*` token still holds a gradient |
| Every declared surface paints a gradient | Verified | same probe, `reports/gradient-shots/probe-gradient.json` (per-surface rows, three themes). 42/48 rows carry a gradient; the six `none` rows are exactly the two collapse layers × three contexts. **Computed style only** — it says the declaration parses, not that anything is perceptible. See the two rows below. |
| The page ground is a diagonal ramp, not a flat fill | Verified | probe, all three themes × four routes: `linear-gradient(135deg, rgb(20,0,195), rgb(22,0,159))` dark, `rgb(244,239,202) → rgb(255,255,255)` light, `rgb(23,23,23) → rgb(35,35,39)` cyberpunk. `body::after` computed `content: none` — the old wash layer is gone, so the lattice sits on the ramp. |
| The probe no longer asks for an impossible surface | Verified | card surface moved from `/colleague/` (one `.featured-card`, hero variant, unfilled by design) to `/projects/` (23 `.project` cards); probe run reports 0 failures, 0 absences |
| The gradients are *perceptible* | **Not verified — fails** | pixel diff, surface vs same surface with `--gradient-*: none`, dark theme, 1440×900: `#intro` meanΔ **0.04/255** (0.8% of pixels move >6), `.button` meanΔ **0** (maxΔ 0 — the `--button-bg`→`--button-bg-hover` ramp is between two visually identical tokens, so removing it changes nothing), `.blog-card` meanΔ 5.87 (66% of pixels), `.project` meanΔ 11.7. The hero glow, the surface the design was built around, is not visible. |
| Aesthetic judgement | **Not verified** | screenshots in `reports/gradient-shots/`; owner reads them |
| `.featured-card-hero` has no fill | Verified | computed `background-image: none`; cause is the `.hero-visual .featured-card-hero` specificity, not a broken token |
| Hover on `.project` / `.blog-card` keeps its ramp | Verified | probe hover rows, all three themes; the hero card is excluded — see the `.featured-card-hero` row |
| The gradients *look* right | **Not verified** | screenshots only; no aesthetic pass |

## 11. Implemented

Committed as `5aabc3a` (owner) — `src/styles/global.css`, `src/styles/blog.css`, `tests/lib/gradient-tokens.test.ts`, `DESIGN.md`, this document. Added uncommitted on 2026-10-11:

| File | Change |
|---|---|
| `tests/built/gradient.test.ts` | **new** — binds the family against `dist/_astro/*.css`: five definitions, both composition overrides, the application rules, the flat-collapse block, plus a guard that the collapse does not leak into the default cascade. Mutation controls included. |
| `scripts/probe-gradient.mjs` | **new** — the browser pass: route-aware surfaces × three themes × two viewports, computed styles, hover, screenshots to `reports/gradient-shots/`, and REQ-07 across the three collapse contexts. |

Rollback for the uncommitted pair: `git clean -n` then remove the two files.

**Page ground, 2026-10-24 — uncommitted.** The owner asked for a gradient on the main background; variant B shipped: `--gradient-page` became a diagonal down the dominant-surface ladder, and the application moved from a fixed `body::after` wash to `html`, so the wallpaper lattice reads on top of the ramp instead of under a wash. A follow-up in the same session added the third stop: the two-stop ramp interpolated `--background-primary` → `--background-secondary`, which are one near-identical step apart in the dark theme, so the direction was invisible. `--card-background` closes the ramp and the diagonal now reads.

| File | Change |
|---|---|
| `src/styles/global.css` | `--gradient-page` → `linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 55%, var(--card-background) 100%)`; `html { background: var(--gradient-page) var(--background-primary) }`; `body::after` removed (opaque stops made the wash layer redundant) |
| `DESIGN.md` | token-table row for `--gradient-page`; accent-budget bullet now rests on the hero glow and the rule only |
| `tests/built/gradient.test.ts` | application note `html` (the selector moved with the token) |
| `scripts/probe-gradient.mjs` | `page ground` surface on `html`; card surface moved to `/projects/` |
