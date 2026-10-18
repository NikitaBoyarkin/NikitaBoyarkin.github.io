# Home dashboard — frozen interface

**Status:** contract, agreed before code (same rule as `explorer-surface.md`). Every
agent writes only inside its own paths; anything needed elsewhere is reported, not
touched.

Turns the `/` gate into a dashboard: the persona canvas stays as the hero, and below
it the page becomes the only surface that shows **every** part of the site — including
the 53 standalone apps that no index, no sitemap and no navigation currently exposes.

## 0. Progress

| Axis | State | Verified by |
|---|---|---|
| **A. Data spine** | **done** — `src/lib/dashboard.ts`, `src/lib/dashboard-scan.ts`, `src/lib/dashboard-data.ts`, `src/pages/dashboard-index.json.ts` | `bun test tests/lib/dashboard.test.ts` (23), `bun test tests/built/dashboard.test.ts` (12), `bun run build` (213 pages, 23 KB JSON) |
| **B. Surface** | **done** — `src/components/Dashboard{Grid,Card,Metrics}.astro`, `src/pages/index.astro`, `src/pages/en/index.astro` | rendered in headless Chromium: 8 cards (7 on EN), 103 anchors, `details` folds 46 artefact rows, no horizontal overflow at 390 or 1440 |
| **C. Visual system** | **done** — `src/styles/dashboard.css`, imported last in `Base.astro` | WCAG contrast computed on the rendered DOM: 0 failures in dark / light / cyberpunk (min 5.16 / 5.72 / 5.60) |
| **D. Shell / search** | **done** — `Base.astro` (CSS import), `SearchBox.astro` (`⌘K` / `Ctrl+K` alias) | `astro check`: 0 errors; `tsc`: exit 0 |
| **E. Canvas hero retired** | **done** (2026-10-18) — `src/components/HeroGate.astro` replaces `PersonaCanvas` on `/` + `/en/`; the cue moved in flow; `canvasFullBleed` dropped | `tests/built/homepage-gate.test.ts` (no canvas markup, three routes each with an icon, cue → `#dash`); `bun run build` 213 pages; render 1440×900/390×844/1860×1000 in dark + light: `<h1>` at y=162, all three gate cards fully visible, no console errors |

Two facts the build changed while axis A was written, both recorded in the sections
below: the `routes` metric was **dropped** (the sitemap is generated after endpoints
run, so the count could not be honest), and `public/projects.json` turned out **not to
be needed** (project rows point at project pages; the demos are card 7's job).

One owner-side correction: this plan first claimed a browser was unavailable to the
agent and that the hero decision could not be verified locally. That was wrong —
Playwright and its Chromium are installed and used by `scripts/mobile-audit.mjs` and
`scripts/audit-palette-coverage.mjs`. Axis B/C were verified in a real browser (§12).

---

## 1. Why this is not a duplicate of `/explorer/`

The site already has three entry points: the canvas hero, `/explorer/` (filterable
everything over content collections) and `/graph/`. A dashboard that re-indexed content
would be a fourth, worse, one.

What is genuinely missing is **discovery of `public/`**:

| Artifact | Count | In `sitemap-0.xml`? | In `explorer-index.json`? | In nav? |
|---|---|---|---|---|
| `public/demos/*/index.html` | 23 | no | no | no |
| `public/diagrams/*.html` | 20 | no | no | no |
| `public/games/` | 1 hub + 10 games | no | no | no |
| `public/repo-audit/` | 2 | no | no | no |

The sitemap integration only sees routes Astro builds from `src/pages/`
(`astro.config.mjs:191-204`), so `public/`-served HTML is invisible to it. Nothing
today links to the 23 demos or the 20 diagrams from anywhere on the site.

**Therefore:** the dashboard's job is *curation + surfacing the unindexed*, and its
exhaustive-mode escape hatch is a link to `/explorer/`, not a second filter panel.

**Historical note, verified:** the site *had* a dashboard homepage before. `.home-board`
(`global.css:463-474`, media blocks `:530-569`) and `#page-board` / `.kanban-column`
(`global.css:3512-3564`, comment «Homepage kanban board — Профиль | Проекты | Сейчас в
работе») are now **CSS-only with zero markup references** — dead residue that the canvas
redesign replaced. This task is therefore partly a *return* to a design that was
deliberately discarded, and those rules are either mineable prior art or candidates for
deletion in a separate pass. They are not a live precedent and must not be revived
accidentally.

## 2. Non-goals

- No second search. `SearchBox.astro` is reused (see §7).
- No second content index. `/explorer/` stays the exhaustive surface.
- No new layout engine. `.xp` + `.bento-grid` already exist (§6).
- No JS dependencies, no CDN, no server runtime.

## 3. Files and ownership

| Axis | Files (write only these) |
|---|---|
| **A. Data spine** | `src/lib/dashboard.ts` (pure: types, copy, pluralisation, builder), `src/lib/dashboard-scan.ts` (build-only `public/` scan), `src/lib/dashboard-data.ts` (async loader), `src/pages/dashboard-index.json.ts` |
| **B. Surface** | `src/pages/index.astro`, `src/pages/en/index.astro`, `src/components/DashboardGrid.astro`, `src/components/DashboardCard.astro`, `src/components/DashboardMetrics.astro` |
| **C. Visual system** | `src/styles/dashboard.css` |
| **D. Shell / search** | `src/layouts/Base.astro` (CSS import + `navLinks` only), `src/components/SearchBox.astro` (hotkey only) |
| **Frozen (nobody edits)** | this file, `tests/lib/dashboard.test.ts`, `tests/built/dashboard.test.ts` |

Why axis A is four files and not two: `dashboard.ts` must stay importable from a client
script and testable with fixtures, so it may not touch `astro:content` or `node:fs`; the
scan and the collection reads therefore live beside it, and the endpoint is a three-line
wrapper. The split is what makes `tests/lib/dashboard.test.ts` runnable without Astro.

`src/lib/dashboard.ts` is the single source of type truth and the curation config.
Read it first.

## 4. Data contract

`GET /dashboard-index.json` returns:

```ts
// GET /dashboard-index.json — both locales in one document, as search-index.json
{ ru: DashboardIndex, en: DashboardIndex }

// DashboardIndex
{ generatedAt: string,
  locale: 'ru' | 'en',
  sections: DashboardSection[],   // 8 cards for RU, 7 for EN (no `topics`)
  surfaces: DashboardSurface[],   // Explorer · Graph · Search · [Notes & Guides]
  metrics:  DashboardMetric[],    // six computed counts
  meta:     { generatedFrom: string[] } }
```

Rules the builder honours in code, not in prose:

- **Titles for scanned artefacts come from each file's own `<title>`** — nothing is
  invented, and the contract test fails if a row falls back to a slug. They are not
  translated: these are language-neutral static files with no EN twin.
- **The scan is loud on a wrong root, quiet on an empty category.** A missing `public/`
  directory throws (it cannot be legitimate — it means the path was derived from
  `import.meta.url`, which points into `dist/` after bundling); a `public/` with no
  diagrams is allowed to be empty.
- **The JSON is budgeted at 120 KB.** Content cards are truncated to 6 rows because
  their section index holds the full list; the tools card is never truncated because no
  index exists to take over. Shipped size: 23 KB.

`DashboardSection`: `id · title · desc · href · count · countLabel · children[]`
`DashboardCard` (child): `title · href · kind · external?`
`DashboardMetric`: `value · label · href?`

Sources, unioned at build time in `dashboard-data.ts`:

1. **Content collections** → per-section counts and child lists: `projects` (22),
   `volta-parts` (23), `posts` (24), `glossary` (27), `library` (2), `TOPICS`
   (`src/lib/topics.ts`, 9).
2. **A build-time scan of `public/`** (`src/lib/dashboard-scan.ts`) → `demos/*/`,
   `diagrams/*.html`, `games/`, `repo-audit/`. This is the only way those 53 apps can
   reach an index at all.

`public/projects.json` is **not** a source, contrary to the first draft of this
contract. Its `demo` hrefs are already reachable twice — from each project page and from
card 7 — so wiring a second link into every project row would double the row to repeat
what two other surfaces say. Reuse, do not re-scan.

Rules the builder must honour:

- **Locale honesty**, same as the explorer contract: `/` uses the RU collections,
  `/en/` uses the EN ones. EN showing 2 posts is the truth, not a bug to paper over.
- **Display titles for scanned artifacts** have no metadata in `public/`; derive from
  the slug (kebab → Title Case) and allow an explicit override map in
  `src/lib/dashboard.ts`. Never invent a title.
- **Counts are computed, never literal.** No number in the component source.
- **`href` always through `withBase()`**; the JSON is served from the site root.
- Budget: response ≤ 120 KB. The section `children` lists are truncated to their first
  N entries (the full list is `/explorer/`'s job) — every card still links to its
  section index, so nothing becomes unreachable.

## 5. Card set and metrics (frozen)

| # | Card | Source | Count | Target |
|---|---|---|---|---|
| 1 | Projects — case studies | `src/content/projects/` | 22 | `/projects/` |
| 2 | Volta neobank | `src/content/volta-parts/` | 23 modules | `/projects/volta/` |
| 3 | Writing | `src/content/posts/` | 24 | `/writing/` |
| 4 | Glossary | `src/content/glossary/` | 27 | `/glossary/` |
| 5 | Library / shelf | `src/content/library/` | 2 | `/library/` |
| 6 | Topics | `src/lib/topics.ts` | 9 | `/topics/` |
| 7 | **Tools & demos** | `public/` scan + `projects.json` | 23 demos · 20 diagrams · 10 games | `/demos/…`, `/diagrams/…`, `/games/`, `/repo-audit/` |
| 8 | About / CV / Contact | `about`, `contact`, `CV-Nikita-Boyarkin.pdf` | — | `/about/`, `/contact/`, PDF |

**Surfaces row** (chips, not cards): Explorer · Graph · Search (`/` and `⌘K`) ·
Notes & Guides.

**Metrics band** (`.proof-grid`), six computed counts in this order: 22 projects ·
23 Volta modules · **53 interactive apps** (23 demos + 20 diagrams + 10 games, linked to
the arcade hub — the only real index among the scanned artefacts) · 24 posts ·
27 terms · 2 sources. Every value is derived; a metric whose target does not exist is
omitted rather than printed. `repo-audit` appears on the tools *card* but is excluded
from the 53 — it is meta-content, not an app.

The first draft listed a "routes" metric taken from the sitemap URL count. It is
**dropped**: `@astrojs/sitemap` writes `sitemap-0.xml` after the endpoint has run, so at
build time the number would have to be a hand-maintained literal — exactly the dishonest
metric this contract rules out. Six honest numbers, no seventh.

## 6. Class contract (`dash-*`)

`xp-` belongs to the explorer, `kg-` to the graph, so the dashboard takes `dash-`.
`src/styles/dashboard.css` defines these **using `var(--token)` only, no raw hex**, and
is imported in `Base.astro` after `global.css`.

```
.dash-hero         hero wrapper: one screen tall, and the cue's positioning context
.dash-cue          "Всё на сайте ↓" scroll affordance (hidden below the lock's gates)
.dash              the surface band
.dash-shell        panel rail + content (1 column; 260px + content at >=1000px)
.dash-rail         sticky left rail at >=1000px (same offset as `.xp-panel`)
.dash-group        one rail group (surfaces, metrics)
.dash-sub          uppercase micro-label
.dash-chips        surface chip list
.dash-chip         surface chip (label + optional hint)
.dash-chip-hint    shortcut / locale hint inside a chip
.dash-metrics      metric list (also `.proof-grid`, which supplies the columns)
.dash-metric       one metric anchor
.dash-metric-value / .dash-metric-label
.dash-grid         the card grid (1 / 2 / 3 columns)
.dash-card         one curated section card
.dash-card-title / .dash-card-count / .dash-card-desc
.dash-card-more    "Все N →", pushed to the card's baseline
.dash-rows         row list; .dash-row-count for an aggregating row
.dash-rows-group   `<details>` wrapper — only the tools card folds
.dash-empty        empty state
```

Plus one non-class block: the `@media (min-width: 900px) and (min-height: 700px)`
override that lifts global.css's one-screen lock, gated on
`:has(main > .dash)` so only the homepage scrolls.

Reuse, do not redefine: `.container`, `.page-title`, `.proof-grid` (columns only —
its `.proof-item/.proof-value` children belong to a different band), `.tag-chip`
(the pill, including its contrast pairing), `.visually-hidden`.

Do **not** use `container-wide` / `container-content` — `tests/lib/prose-css.test.ts`
scans `src/pages`.

## 7. Search reuse

No new search. `SearchBox.astro` already ships fuzzy matching, type facets, `↑↓`, ARIA
combobox (`SearchBox.astro:239-271`) and is mounted site-wide (`Base.astro:531`).

Single change (implemented): accept **`⌘K` / `Ctrl+K`** in addition to the existing `/`
(`SearchBox.astro`, the `keydown` listener), `preventDefault()` so the browser's own
address-bar shortcut does not win.

The first draft of this contract also promised that `⌘K` would *close* an open panel
(toggle). That is not implemented and the promise is withdrawn rather than left standing:
`/` does not toggle either, and making one shortcut behave differently from its alias
would be the kind of two-behaviour-one-keystroke surprise worth avoiding. The dashboard's
search chip dispatches the same `/` keydown rather than growing a second entry point.

## 8. Surface integration — verified, one design decision open

**Structural room exists.** `index.astro:38-52` slots exactly one child; the slot lands
in a plain in-flow `<main id="main">` (`Base.astro:586-588`); the canvas viewport is
`position: relative; block-size: 100vh; overflow: hidden` (`CanvasStage.astro:248-262`),
**not** `position: fixed`. The no-JS fallback is the slotted content itself while
`<html>` keeps `canvas-static` (`global.css:4144-4185`) — `Base.astro:280-299` is only a
comment, not markup.

**The blocker is a deliberate contract, not an accident.** Passing `canvasFullBleed`
(`index.astro:49`) activates:

```css
/* global.css:4260-4274 */
html.canvas-fullbleed:not(.canvas-static) body {
  /* One screen, no scroll: bar, board and strip are sized to fill it. */
  block-size: 100dvh; overflow: hidden; display: flex; flex-direction: column;
}
```

plus `main { flex: 1 1 auto; min-block-size: 0 }` (`:4291-4296`),
`.canvas-viewport { block-size: 100% }` (`:4303-4305`) and a ~36 px footer strip
(`:4309-4328`). Triple-gated — `min-width: 900px` **and** `min-height: 700px` **and** JS
on (`global.css:4253-4258`) — so it is inert on a phone and with JS off. While active, a
sibling section below the canvas is **clipped, not scrollable**.

`bleed` is the existing full-width-but-scrollable pattern: `Base.astro:58-61`,
`global.css:4061-4073`, used by `graph.astro:14`, with the comment *"No 100vh lock here:
the graph page scrolls."*

So "dashboard below the hero" costs retiring `canvasFullBleed` on `/` in favour of
`bleed` plus an explicitly one-viewport hero. That is a real trade: `canvasFullBleed`
*is* the "never scrolls" guarantee, and the hero is a full-viewport pointer surface, so
a visitor may never discover content below. **Open decision:**

| | Option | Cost | Risk |
|---|---|---|---|
| **A** | Hero = one full viewport, dashboard below, explicit scroll affordance | Retire the `canvasFullBleed` lock on `/` | Discoverability; hero drag may compete with page scroll on touch |
| **B** | Hero shrinks to a band (~60–70 vh) so the first dashboard card peeks above the fold | Retire the lock **and** resize the hero composition | Changes the canvas art direction; needs a visual check in all three themes |
| **C** | Leave `/` untouched; dashboard at `/dashboard/`, linked from hero + nav | Extra entry in `.lighthouserc.json:6-25`; a second entry point | The homepage still does not answer "where is everything" |

**Decided: A** — chosen by the owner after the fact check above, because B resizes a
hand-composed hero and that is a judgement no agent should make blind. The hero therefore
keeps the band it always had; the price of that is a visitor who would never learn there
is anything below, and it is paid with an explicit cue (`.dash-cue`, «Всё на сайте ↓»)
inside the hero, pointing at `#dash`.

Implemented as measured, not as guessed: the lock is lifted by a `@media (min-width: 900px)
and (min-height: 700px)` block in `dashboard.css` gated on `:has(main > .dash)`, and the
hero's band is rebuilt from the site's own tokens —
`calc(100dvh - var(--nav-mobile-h) - var(--space-4) - var(--dash-strip))`. On a 900px
viewport that resolves to **783px**, exactly the height the retired lock produced, so the
canvas fit measures the band it has always measured. Verified in a real browser (§11):
hero 783px, band identical, canvas live, no console errors.

## 9. EN twin

`src/pages/en/index.astro` renders the same components with `lang="en"`; copy lives in
a `DASHBOARD_COPY` map in `src/lib/dashboard.ts`. EN counts will differ from RU
(posts 2, library 2) — that is the contract, not a defect.

## 10. No-JS shell

Every card, child link, surface chip and metric renders server-side as a real `<a>` /
text node. JS only: the `⌘K` alias and any progressive filter. A visitor with JS off
can still reach every part of the site from `/` — this is the acceptance criterion,
not a nicety.

## 11. Brand + accessibility rules (non-negotiable)

- One accent (`--text-accent` / `--button-bg`), ≤15 % of screen, **never a content
  fill**.
- No second sans family, no gradient-filled text, no `background-clip: text`.
- Hover = `translateY` + `var(--shadow-color)`, never scale/opacity alone.
- Dataviz tokens (`--dv-*`, `--text-accent-dataviz`) are information only — the metrics
  band may use them, the cards may not.
- WCAG AA in **all three themes** (dark, light, cyberpunk);
  `.claude/hooks/contrast-gate.js` enforces 4.5:1 text / 3:1 non-text on every write to
  `src/styles/dashboard.css`.
- Russian UI copy; English code and comments.

### Measured (headless Chromium, 1440×900 and 390×844, three themes)

A WCAG contrast audit over the rendered DOM of the new surface — effective background
composited up the ancestor chain, alpha included, large-text exemption applied — found
**one failure** and it was real: `.dash-chip-hint` at **4.34:1** on `.tag-chip`'s
`--background-tertiary` surface in the dark theme, against a 4.5 threshold. Fixed by
using `--text-normal`, the pairing `global.css` already documents for that same chip.
After the fix:

| Theme | Text nodes checked | Min ratio | Failures |
|---|---|---|---|
| dark | 160 | **5.16** | 0 |
| light | 160 | **5.72** | 0 |
| cyberpunk | 160 | **5.60** | 0 |

Light and cyberpunk passed on the first run; the dark theme is the one that would have
failed the LHCI `color-contrast: 1` assertion.

Also measured: no horizontal overflow at 390px or 1440px (`scrollWidth == clientWidth`),
and the hero band is **783px** on a 900px viewport — exactly `100dvh − --nav-mobile-h −
--space-4 − --dash-strip` = 900 − 65 − 16 − 36, i.e. the geometry the retired one-screen
lock produced. The canvas is still live in that band: `canvas-static` is removed at
runtime, `.canvas-node` computes to `position: absolute`, and `.canvas-world` carries the
fit transform (`matrix(0.6, 0, 0, 0.6, 288, -270)`). No console errors, no failed requests.

> **Correction (2026-10-18).** That last clause was wrong, and it is the most useful
> sentence in this file: `matrix(0.6, 0, 0, 0.6, 288, -270)` is not proof the canvas
> *fitted* — it is the signature of the failure. `0.6` is `MIN_ZOOM` (the correct scale
> for a 1440×783 band is 0.87) and `-270px` is `(0 − 900 × 0.6) / 2`, i.e. a vertical
> offset computed against a viewport of height **zero**. Measured on the built page: the
> identity node sat at `y = −135` and the HR card at `y = −15` — both above the fold — with
> 783px of dead band below them. The band was measured; the composition inside it never
> was. See decisions 36–37.

### A layout defect that measurement caught and a screenshot only hinted at

The rail is 260px wide. A prose hint inside a surface chip wrapped to a second line there
and the pill stopped reading as a pill — measured as one chip at `260×49` against
`223×32`, `130×32`, `180×32` for its neighbours. The prose hints ("всё содержимое с
фильтрами", "связи между материалами") are therefore removed; the two functional ones
(`/ или ⌘K`, `RU`) stay, and every chip is now a single `32px` line.

## 12. Verification (order)

```bash
bun test tests/lib/dashboard.test.ts      # the contract (pure builder + scan) — PASSES
bun run build                             # page count must not drop (271 HTML files)
bun test tests/built/dashboard.test.ts    # every printed href resolves in dist/ — PASSES
bun run check                             # astro check: 0 errors, tsc: exit 0 — PASSES
make check                                # full gate (build + tests + check_site.py)
bun run serve-dist & bun run scripts/mobile-audit.mjs   # mobile overflow
bunx @lhci/cli autorun --config=.lighthouserc.json      # a11y >= 0.95, contrast 1.0
```

Report `file:line` evidence, not diffs or essays. Do not run git.

Rendered evidence (`§11 Measured`) came from a throwaway script driving Playwright
against `astro preview` on a spare port. It was deleted after use and its screenshots
went to `reports/tmp-dash/`, which was also removed — nothing generated by this work is
left in `reports/`. Note that running `scripts/audit-palette-coverage.mjs` *rewrites
tracked files* under `reports/palette-audit/`; that side effect was hit by accident here
and reverted with `git checkout -- reports/palette-audit/`. Do not run that script as a
verification step without expecting the rewrite.

Note for anyone extending the data spine: the unit suite runs under `bun test`, where
`import.meta.url` is the *source* path. A module-relative `public/` root therefore
resolves correctly in tests and to `dist/public/` after bundling — which is how the first
build of axis A died with every unit assertion green. Build-output claims belong in
`tests/built/`, and `make check` is the only thing that runs both.

## 13. Definition of done

| # | Criterion | Checked by |
|---|---|---|
| a | Every route in `sitemap-0.xml` reachable from `/` | pending axis B. The href-resolution half is already bound: `tests/built/dashboard.test.ts` asserts every card, row, metric and surface href resolves to a file in `dist/`, and that no shipped demo or diagram is left unnamed |
| b | `⌘K` and `/` both focus the existing search; Enter opens the hit | manual + `tests/built` |
| c | Lighthouse a11y ≥ 0.95, color-contrast = 1.0, perf ≥ 0.90 | `lhci autorun` in CI. Locally measured equivalent: 0 contrast failures in all three themes (§11) |
| d | 0 new JS dependencies | `package.json` diff empty — still empty |
| e | No existing page, text or URL removed; built page count does not drop | `bun run build` (213 pages, unchanged) + `check_site.py` (all checks passed) |
| f | Fully keyboard operable, focus visible, skip-link still works | native by construction — every card, row, metric and surface is a real `<a>`, the tools card is a native `<details>`, and the only button is the search chip. Still wants a human pass in CI's LHCI |

## 14. Decisions log

Canonical reasoning lives here so a future agent does not re-litigate it.

| # | Decision |
|---|---|
| 1 | Hybrid: navigation cards + cheap build-time metrics (no live backend) |
| 2 | The dashboard lives on `/` — the current homepage is replaced, not duplicated |
| 3 | Complete coverage, but grouped: 8 curated cards, exhaustive mode → `/explorer/` |
| 4 | Search + `⌘K` + keyboard nav |
| 5 | One source of truth; no link list hardcoded in HTML |
| 6 | Existing design tokens, new layout |
| 7 | Same language as the existing site (RU UI copy, EN twin) |
| 8 | Existing navbars stay on every other page |
| 9 | Zero dependencies |
| 10 | Full mobile parity |
| 11 | Hero answers "who is this" in 5 seconds |
| 12 | Metrics computed at build, never literal |
| 13 | Definition of done = §13 table |
| 14 | Plan first, stop for approval, then implement |
| 15 | Canvas stays as hero; dashboard renders below it — **reopened by §8**: needs either the `canvasFullBleed` retirement (A) or a hero band (B) |
| 16 | Dashboard is a curated entry point; `/explorer/` stays exhaustive |
| 17 | Reuse `SearchBox`; add a `⌘K` alias only |
| 18 | Data spine = union of collections ∪ `projects.json` ∪ `public/` scan |
| 19 | Metrics from collections + `public/` scan; no git dates |
| 20 | No-JS parity for all cards, chips and metrics |
| 21 | A dedicated "Tools & demos" cluster surfaces the 53 unindexed apps |
| 22 | EN twin at `/en/` |
| 23 | New `src/styles/dashboard.css` (stays under the contrast gate) |
| 24 | Build on `.xp` + `.bento-grid` + `.proof-grid`; no new layout engine |
| 25 | Card set as in §5 |
| 26 | This file is the plan document |
| 27 | Hero band (B): retire the `canvasFullBleed` lock on `/`, first card above the fold — **superseded by 31** |
| 28 | Axis A split into four modules so the builder stays fixture-testable without Astro |
| 29 | `routes` metric dropped — not derivable at build time without a literal |
| 30 | `projects.json` dropped as a source — its demo links are already reachable twice |
| 31 | **Option A, not B**: hero keeps its exact one-screen band and the composition is untouched; the price is an explicit scroll cue. Chosen by the owner after §8's fact check |
| 32 | The one-screen lock is lifted by CSS gated on `:has(main > .dash)`, not by a new `Base` prop — the condition is self-describing and lives in one file |
| 33 | Prose hints dropped from the surface chips, measured at 2 wrapped lines in the 260px rail |
| 34 | `⌘K` alias opens the panel and does not toggle-close; the withdrawn promise is recorded in §7 |
| 35 | Interactive `preview`, verification scripts and screenshots are removed after use; nothing generated lands in `reports/` |
| 28 | Axis A split into four modules so the builder stays fixture-testable without Astro |
| 29 | `routes` metric dropped — not derivable at build time without a literal |
| 30 | `projects.json` dropped as a source — its demo links are already reachable twice |
| 36 | **The canvas hero is retired** (2026-10-18, supersedes 15 and 31). Root cause: the canvas fit is a synchronous pre-paint `clientHeight` read (`CanvasStage.astro`), and on this page the `.dash-hero` band had no resolved block-size at that instant — the read returned 0, so zoom collapsed to `MIN_ZOOM` (0.6) and `--vp-ty` resolved to **−270px**. The identity and the HR card rendered *above* the fold. Option A kept the hero and paid for it with a cue; it did not survive the measurement. `HeroGate.astro` is plain in-flow markup: no world, no transform, no fit to get wrong |
| 37 | The six header nav entries (`projects`, `about`, `writing`, `glossary`, `explorer`, `topics`) were removed and replaced by a single in-bar **«Главная»/«Home»**; `INLINE_NAV_KEYS = ['home']`. `graph` / `library` / `repo-audit` stay in the drawer. Every header and dashboard button now carries an icon from the frozen contract `src/lib/icons.ts` (`ICON` + `BRAND_ICON`), bound by `tests/lib/icons.test.ts` |

## 15. Open items

1. **§8 hero geometry** — closed twice over. The owner chose **A** (hero untouched, log
   row 31), and the band was then measured at exactly the geometry the lock produced
   (§11). No open work.
2. **Do `public/demos/` and `public/diagrams/` have their own hub pages?** — answered:
   **no.** Neither has an `index.html`; `public/games/` and `public/repo-audit/` do. So
   the dashboard is the first index the 23 demos and 20 diagrams have ever had, and card
   7 links individual artefacts instead of a hub. Worth considering later as its own
   change: a real `/demos/` + `/diagrams/` hub pair would give those artefacts a
   canonical URL and let card 7 shrink. Out of scope here.
3. **A human look at the hero.** The band is provably the same size and the canvas is
   provably live, but "the composition still looks right at 783px" is a judgement the
   measurements do not make. Worth one look in all three themes before this ships.
3. **Nav entry for Tools & demos** — `navLinks` holds **10 rows** (`Base.astro`), and the
   width-gated inline bar (`INLINE_NAV_KEYS`) shows exactly **one** of them — «Главная»/«Home»;
   the other nine are drawer-only (decisions 36–37). A Tools & demos row would make it
   eleven in the drawer; deferred.
4. **Dead CSS** — `.home-board`, `#page-board` and `.kanban-column` are unreferenced
   (§1). Decide in a separate pass whether to mine or delete them; the dashboard must
   not resurrect them by accident.
