# Spec: Homepage Performance (RU + EN)

> Status: **approved (Phase 1 — Specify, 2026-09-20)**. Feature spec for the homepage-performance
> cycle. Inherits the project-wide contract from `docs/SPEC.md` (stack, commands, structure, code
> style, testing, boundaries) — this document specifies only the change.

## Objective

Reduce homepage performance cost so the two landing pages pass the repo's own Lighthouse
gate, without losing the product intent behind the heavy asset.

**User / who cares:** recruiters and hiring managers landing on `/` or `/en/` — a slow first
paint and an unresponsive page are a credibility cost for a portfolio that claims
performance-conscious analytics work. The deploy pipeline also treats LHCI as a gate.

**Problem (measured, 2026-09-20, local `bunx @lhci/cli autorun`):**

| Metric / audit | `/` | `/en/` | Budget |
|---|---|---|---|
| Lighthouse performance | **0.64** | **0.64** | ≥ 0.85 (warn) |
| Total Blocking Time | **3 520 ms** | (same bundle) | ≤ 200 ms |
| Main-thread work | **13.1 s** | — | ≤ 4 s |
| JS bootup | **9.6 s** | — | — |
| Time to Interactive | 10.5 s | — | ≤ 3.8 s |
| FCP / LCP / CLS | 1.9 s / 2.9 s / 0.05 | — | LCP ≤ 2.5 s, CLS ≤ 0.1 |
| Unused JS | 202 KiB | — | — |

Root cause is a **single bundle**: `_astro/dist.lfym8dZX.js` — **960 KB**, `@oneworks/avatar-web`
(the animated 3D hero avatar) — accounts for **9.42 s / 9.6 s** of bootup. It is already
deferred (`HeroAvatar.astro:49-61` mounts on `load` + `requestIdleCallback`, then dynamic-imports
`src/lib/avatar/mount-hero.ts` → `@oneworks/avatar-web`), but executing 960 KB still lands
inside the measurement window and destroys TBT. Secondary: PostHog (`analytics.LoGY1cs-.js`,
72 KiB unused, 90 ms) and an a11y `heading-order` failure (an `<h3 class="featured-card-title">`
with no preceding `<h2>`).

## Decisions (approved 2026-09-20)

1. **3D avatar becomes opt-in.** Static photo (`00_profile.webp`) stays the default and keeps
   doing LCP work; the 3D scene loads only after an explicit user action. Zero cost inside the
   measurement window unless the visitor asks for it.
2. **Target = the repo's gate + absolute budgets:** performance ≥ 0.85, TBT ≤ 200 ms,
   main-thread work ≤ 4 s, TTI ≤ 3.8 s.
3. **Scope also includes** the `heading-order` a11y fix and reducing/deferring PostHog cost.
4. **The 3D avatar is kept as a feature** (decided 2026-09-20) — only its load timing changes
   (becomes opt-in). Dependency/dead-code cleanup for `@oneworks/avatar*` is therefore **not**
   scheduled by this cycle.

## Scope

**In scope**
- `src/components/HeroAvatar.astro` — replace the auto (load+idle) mount with an explicit
  opt-in trigger; keep the static photo as the default and the LCP element.
- `src/pages/index.astro`, `src/pages/en/index.astro` — fix the heading hierarchy in the
  featured-card region.
- `src/components/Analytics.astro` — defer/trim PostHog so it no longer blocks or wastes
  main-thread time in the measurement window.
- Minimal supporting changes in `src/lib/avatar/*` if the opt-in path needs them.

**Out of scope**
- `/writing/`, `/topics/`, `/projects/volta/` (already perf 0.92–0.99).
- Font payload (123 KiB) and image sizing unless they block the target.
- Removing `@oneworks/avatar*` dependencies altogether.
- Any change to `.lighthouserc.json` thresholds (the gate stays as-is; we meet it, we don't move it).

## Commands (this cycle)

```bash
bun run build                     # produce dist/
bunx @lhci/cli autorun            # the acceptance measurement (same config as CI)
bun test                          # full lib suite must stay green
bun run check                     # astro check + tests type-check
make check                        # built-site links/assets
bun run audit:content             # numbers frozen — must not drift
```

## Project Structure (files this change touches)

```text
src/components/HeroAvatar.astro   # opt-in trigger (primary change)
src/lib/avatar/mount-hero.ts      # deferred mount entry — reuse, adjust if needed
src/pages/index.astro             # RU homepage — heading hierarchy
src/pages/en/index.astro          # EN homepage — heading hierarchy (+ parity)
src/components/Analytics.astro    # PostHog load strategy
```

## Code Style

Follow the existing progressive-enhancement pattern already established in `HeroAvatar.astro`:
static-first markup, JS only enhances, failure is silent, `prefers-reduced-motion` respected.
Reuse `withBase()` for any URL. No new dependencies. Match file-local conventions (typed
`interface Props`, single quotes in `.ts`).

## Testing Strategy

- **Acceptance is measured, not asserted by a unit test:** `bunx @lhci/cli autorun` against the
  built site; `/` and `/en/` must meet the Success Criteria. This is the same tool and config CI
  uses (`deploy.yml`, job `lighthouse`).
- **Regression:** `bun test`, `bun run check`, `make check`, `bun run audit:content` all green.
- **Behavioural checks (manual / Playwright script under `scripts/`):**
  - default page shows the static photo and never requests the 960 KB avatar chunk;
  - after the opt-in action the 3D scene mounts, and on failure the photo remains;
  - with `prefers-reduced-motion: reduce`, the photo remains (no autoplay scene);
  - RU and EN behave identically.
- **Analytics fidelity:** every event documented in `docs/analytics-events.md` still fires
  (autocapture may be delayed — see Open Questions). Verify with PostHog debug locally or the
  dev network panel.

## Boundaries

- **Always:** keep the static photo as the LCP element; preserve no-JS / no-WebGL /
  reduced-motion fallbacks; keep RU + EN in parity; run the four gates above before finishing.
- **Ask first:** removing the `@oneworks/avatar*` dependencies; changing `.lighthouserc.json`
  thresholds; altering the PostHog event set; touching nav/IA or brand tokens.
- **Never:** make the 3D scene a blocking or auto-executing cost inside the LHCI window;
  regress a11y/best-practices/SEO below 0.95; change any frozen number; commit secrets.

## Success Criteria

1. `/` and `/en/`: Lighthouse **performance ≥ 0.85**; target **TBT ≤ 200 ms**,
   main-thread work ≤ 4 s, TTI ≤ 3.8 s.
2. LCP ≤ 2.5 s and CLS ≤ 0.1 preserved; `accessibility` / `best-practices` / `seo` ≥ 0.95
   (the `heading-order` failure is cleared).
3. On a default visit, the `@oneworks/avatar-web` chunk is **not** requested and contributes
   ≈0 ms inside the measurement window; it loads only after the opt-in action.
4. Static photo is still the default and still the LCP element; no-JS and reduced-motion
   visitors see the photo only.
5. `bun test`, `bun run check`, `make check`, `bun run audit:content` all pass; RU/EN parity holds.
6. No new dependency; `bun.lock` unchanged.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Opt-in button hurts discoverability of the 3D feature | Make the affordance explicit and low-cost; track a click event; the photo alone is a complete experience |
| PostHog deferral drops early `$pageview` / autocapture | Defer to first interaction/idle with a short fallback timeout, not to "never"; verify event parity locally |
| Heading change breaks layout or SEO structure | Keep the visual style; change only the tag/semantics; re-run `make check` and LHCI seo |
| LHCI variance (single run, `numberOfRuns: 1`) | Re-run `autorun` to confirm; compare against the 0.64 baseline, not a decimal |
| Regression on the three already-fast pages | Re-run LHCI across all 5 URLs, not just the homepages |

## Assumptions

1. The avatar bundle is the dominant lever; with it out of the window, the homepages clear 0.85.
2. "Opt-in" means a visible, deliberate user action; the exact affordance (button, click on the
   photo) is a Phase 2 design decision.
3. PostHog must remain functional — we reduce its *blocking* cost, not its coverage.
4. Success is judged by LHCI (same config), plus the unit/build/link gates — not by a new tool.

## Open Questions

All resolved 2026-09-20 (defaults accepted):

1. ~~Opt-in affordance~~ → an explicit **«Показать 3D» button** under the photo — an accessible
   `<button>` (visible label, keyboard reachable), not a bare click on the image.
2. ~~PostHog strategy~~ → load on **first interaction** with an `idle`/timeout fallback. A delay
   in `$pageview` is acceptable; the tracked event set is unchanged.
3. ~~Keep the 3D avatar?~~ → **kept** (opt-in); no dependency/dead-code cleanup scheduled.
4. ~~Where cycle specs live~~ → **`docs/spec-*.md`** (this pattern).

No blocking open questions remain; the spec is approved and ready for Phase 2 (Plan).

## Measurement result (2026-10-04)

First acceptance measurement after implementation. **Server: `bun run serve-dist`** (not `astro preview`
— see the tooling note below). 3 runs per URL, same `.lighthouserc.json` assertions; thresholds untouched.

| Metric | `/` | `/en/` | Budget | Verdict |
|---|---|---|---|---|
| Lighthouse performance | **0.86** | **0.82** | ≥ 0.85 (warn) | ✅ `/` · ⚠️ `/en/` (warn only) |
| accessibility / best-practices / **seo** | 1.0 / 1.0 / **1.0** | 1.0 / 1.0 / **1.0** | ≥ 0.95 (error) | ✅ all pass |
| **Total Blocking Time** | **0 ms** | **0 ms** | ≤ 200 ms | ✅ (was 3 520 ms) |
| Main-thread work | **0.4 s** | **0.6 s** | ≤ 4 s | ✅ (was 13.1 s) |
| Time to Interactive | 3.6 s | 4.2 s | ≤ 3.8 s | ✅ `/` · ❌ `/en/` |
| FCP / LCP / CLS | 2.4 s / **3.6 s** / 0.069 | 2.6 s / **4.2 s** / 0.003 | LCP ≤ 2.5 s, CLS ≤ 0.1 | CLS ✅ · LCP ❌ |

Evidence class per metric: **Verified** for all rows (LHCI asserted them on this machine, this build).

**Decision #1 (3D avatar opt-in) is confirmed effective — Verified.** TBT 3 520 ms → **0 ms** and
main-thread 13.1 s → **0.4–0.6 s**: the 960 KB `avatar-3d` chunk no longer executes inside the
measurement window. Success Criterion 1 is met for `/`, and its TBT / main-thread targets are met
for both. Still open: `/en/` performance 0.82 (warn-only, non-blocking) and LCP 3.6 / 4.2 s against
the ≤ 2.5 s budget.

**Caveat — local LCP is a floor, not the production number.** `serve-dist` (like `astro preview`)
answers **uncompressed**, so `uses-text-compression` scores 0 locally. The deployed host does
compress: `curl -sI -H 'Accept-Encoding: gzip, br' https://nikitaboyarkin.github.io/` →
`content-encoding: gzip`, **17 220 B** vs **75 345 B** raw. The authoritative LCP/perf number must
come from a measurement against the deployed site, not the local server.

**Invalid earlier run (same day).** A run against `astro preview` reported perf 0.57 / 0.58 and
**seo 0.92 — an error-level FAIL** whose only offender was a `link-text` hit on
`https://docs.astro.build/en/reference/cli-reference/#astro-preferences` ("Learn more"). That anchor
is **not present** in `dist/index.html`, in `serve-dist`, in `astro preview`, in `astro dev`, or on
the deployed site (all four checked this session, zero matches). **Not reproducible; root cause
unidentified.** Treat that run as invalid — it must not be cited as a baseline.

**Tooling note (recommendation, not applied).** `collect.startServerCommand: "bun run preview"` is
unreliable locally: Astro 7's `astro preview` **daemonizes** (detaches, may take another port, and
prints JSON `{"message":"Preview server already running at http://localhost:4322 …"}`), while
`startServerReadyPattern: "localhost"` matches that JSON immediately — so LHCI proceeds and measures
`localhost:4321` regardless of which server actually holds it. Pointing the command at
`bun run serve-dist` (foreground; prints `serving <root> at http://localhost:4321`) with
`startServerReadyPattern: "serving"` makes the measurement deterministic. Thresholds stay as they are.
