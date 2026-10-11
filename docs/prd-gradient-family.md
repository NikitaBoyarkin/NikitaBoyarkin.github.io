# PRD — Gradient family

**Status:** implemented 2026-10-11, gate chain green. Nothing committed. Visual pass in a real browser **not** performed — see "Evidence".
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

One named, theme-aware gradient family in the token layer, applied at four surfaces, bound by a test — so a later edit to a stop or a theme cannot silently ship unreadable text.

**Non-goals.** No second accent. No gradient-filled text. No new hexes. No change to `public/games` or `src/lib/graph.ts` palettes.

## 3. Constraints discovered

These two facts decided the design; both are load-bearing.

1. **`contrast-gate.js` cannot see gradients.** `.claude/hooks/contrast-gate.js:37` states it as a deliberate coverage limit: *"Only solid hex values and single-level `var(--token)` references resolve. rgba()/hsl()/8-digit hex and **gradient backgrounds are skipped**."* Reusing the hook is not an option without rewriting its documented contract.
2. **`brand.test.ts` cannot see them either.** Its parser is `--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;` — a `linear-gradient(...)` value never matches.

Also: **axe/Lighthouse cannot measure text over a gradient**, which is why gradient-filled text is banned in this PRD (REQ-04).

## 4. Requirements

| ID | Requirement |
|---|---|
| REQ-01 | Four tokens — `--gradient-hero`, `--gradient-surface`, `--gradient-button`, `--gradient-rule` — defined in `:root`. |
| REQ-02 | Every colour stop is an **existing brand token** or `transparent`. A raw hex in a gradient token is a defect. |
| REQ-03 | Because stops are `var()` references, they resolve per theme with no per-theme duplication. Per-theme blocks override **composition only** (a percentage), never colour. |
| REQ-04 | No gradient is applied to text (`background-clip: text`). Section headings keep `--text-normal`; the accent lives in a rule/underline beside them. |
| REQ-05 | Intensity is subtle: alpha ≤14% on large surfaces, so the accent area budget (≤15%, `DESIGN.md`) holds. |
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
- `npm run build` → 203 pages; `npm run check` → 0 errors; `make check` green.
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

Open, deliberately not closed:

- [ ] **Visual pass in a browser was not performed.** The suite proves the numbers; it does not prove the gradients look right.
- [ ] The media-removal test asserts against **source**, not built CSS — a rule silently dropped at build time would pass. The emitted block was confirmed by hand this session (`dist/_astro/Base.*.css`: `@media print,(forced-colors:active),(prefers-contrast:more){html:root{…}}`), but nothing enforces it. Binding it would mean moving that assertion into `tests/built/`.

## 10. Evidence

| Claim | Class | Note |
|---|---|---|
| 379 `tests/lib` tests pass, 13 of them new | Verified | `bun test tests/lib` |
| Build produces 203 pages | Verified | `npm run build` (the 135 in earlier PRDs is stale) |
| `astro check` 0 errors / `make check` green | Verified | includes `check_site.py` link + metrics drift |
| Ramp holds AA in all three themes | Verified | composite at 0/25/50/75/100%; narrowest **4.93:1** (light hero under `--text-accent`) |
| The gate bites | Verified | 5 mutation-control cases in-file assert red |
| Tokens and 4 application rules reach `dist` | Verified | grep on `dist/_astro/Base.*.css` |
| The gradients *look* right | **Not verified** | no browser pass |
| Hover on `.project` / `.blog-card` still reads correctly | **Not verified** | `.project::before` accent bar is a separate pseudo-element; no cascade conflict found by reading, but unseen |

## 11. Implemented (uncommitted)

| File | Change |
|---|---|
| `src/styles/global.css` | four token definitions in `:root`; `--gradient-surface` override in `[data-theme="light"]`; `--gradient-hero` override in `[data-theme="cyberpunk"]`; `.button` → `--gradient-button`; `.featured-card`, `.project` → `--gradient-surface`; `#intro::before` → `--gradient-hero`; `#projects h2::after` → `--gradient-rule`; flat-collapse block under print / forced-colors / prefers-contrast |
| `src/styles/blog.css` | `.blog-card` → `--gradient-surface` |
| `tests/lib/gradient-tokens.test.ts` | **new** — the binding mechanism |
| `DESIGN.md` | `## Gradients` section + Contrast Verification paragraph |
| `docs/prd-gradient-family.md` | this document |

No commit, no push. Rollback: `git restore src/styles/ DESIGN.md tests/lib/ docs/prd-gradient-family.md`.
