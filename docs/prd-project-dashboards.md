# PRD — project dashboards (`public/demos/<slug>/index.html`)

Status: complete — all 22 case pages have a board (wave 1 + wave 2 landed and verified)
Owner: Nikita Boyarkin
Last updated: 2026-10-16

## Wave 2 — landed (verified)

`posthog`, `streamlit`, `supabase`, `linkedin`, `sales-calls`, `garden`, `scrolly`, `site`.

Final state of the whole site:

```bash
bun run build                  # 211 pages, 22 boards under dist/demos/
python3 scripts/check_site.py  # OK: all checks passed (249 HTML files)
bun run test                   # 450 pass, 0 fail
bun run test:built             # 236 pass, 0 fail
bun run check                  # 0 errors, 0 warnings, 3 pre-existing hints
```

22 of 22 cases carry `demo:` in both locales, and every one renders the tab and
the frame (checked on the built HTML, not the sources). The gate grew from 32 to
40 cases across `demo-tokens.test.ts`, one per new slug — the per-page `it.each`
entry *is* the coverage, so the count increment is the evidence that each page is
individually gated.

### Findings raised by wave 2

- **`sales-calls` case prose contradicts its own chart payload.** `sales-calls.md`
  and `-en.md` state **16 891** calls in `description` and `impact`, but the
  validated payload renders **11 486** — and 11 486 is what both the stage-0
  total and the sum of the five step-1 outcomes give, so 16 891 is not derivable
  from any funnel row. The board stays on the payload and says so on the page.
  **The prose needs a decision.**
- **`src/data/charts/posthog.json` conflates an observed `0.0` with a
  not-yet-observed retention cell.** The board separates them (`—` vs `0 %`) and
  notes it; the payload itself still cannot tell the two apart.
- **`garden` is a structural board by necessity, and says so.** Its case
  describes the external `digital_garden` repo, which is not in this catalog, so
  the board measures *this* site's content graph and states that in its lede
  rather than borrowing readership figures it cannot verify.
- **`scrolly` is structural too** — the repo holds no quantitative artifact
  beyond narrative structure and viz props. Its config also lists 5 AI-tool
  scenarios while the `outcomes` viz props hold 6; the board shows 6 and flags it.
- **`site`'s Lighthouse numbers carry a stated limitation**: all 152 reports were
  captured against the local dev server, not the deployed domain, and they span
  two Lighthouse versions.
- Omitted rather than invented: `linkedin` per-post comments (the export gives
  engagements as one scalar), `supabase` CSVs (the repo commits none — the
  generator was reproduced at `seed 42` instead and labelled as such).

## Wave 1 — landed (verified, not asserted)

`ab`, `causal`, `churn`, `rag`, `sql`, `python`, `serp-rank`, `ml`, `airflow`.

Gate chain on the whole site after the change:

```bash
bun run build                  # 211 pages, 15 boards under dist/demos/
python3 scripts/check_site.py  # OK: all checks passed (241 HTML files)
bun run test                   # 442 pass, 0 fail
bun run test:built             # 236 pass, 0 fail
bun run check                  # 0 errors, 0 warnings, 3 pre-existing hints
```

The no-colour-literal gate was proven to *cover* the new pages rather than
merely pass: injecting `style="background:#2e7d32"` into `ab/index.html` turned
`tests/lib/demo-tokens.test.ts` red on that exact page, and restoring it turned
it green again.

`demo:` is wired in `src/content/projects/<slug>.md` **and**
`src/content/projects-en/<slug>.md` for all 9. `src/components/ProjectDemo.astro`
renders the board as a `Дашборд` / `Dashboard` panel on the case page (second
tab, after the case study), plus a link in the meta row. It is a panel and not
an in-prose block for a concrete reason: the case body's first heading is an h1
(the title lives in the markdown), so an h2 above it would put the page's own
heading order out of sequence.

### Findings raised by wave 1 (all disclosed on the boards themselves)

- **`src/data/charts/churn.json` is internally inconsistent.** It states
  `recall@top-10% = 0.53` and `lift = 3.07x` together, which cannot both hold:
  under the project's own definition `lift = precision / base_rate`, and
  `recall@top-10% = 0.1 x lift`, so one of the two is wrong. Its ROC-AUC `0.904`
  and Brier `0.068` also disagree with the committed
  `churn-prediction/reports/metrics.json` (`0.9157` / `0.0633`). The board used
  the recomputed figures that reconcile with `metrics.json` and with its own
  slider arithmetic. **The chart payload still needs a decision** — it is a
  published number that does not survive its own algebra.
- **`sql` MRR: gross vs net.** `fct_mrr.csv` never subtracts cancellations, so
  it has no churn component; the board's waterfall therefore uses the active
  base from the project's own case-21 convention and states the 919.24 $ gap
  and its cause on the page.
- **`ml` has no committed metrics** anywhere in the repo (the README frames the
  project as a preprocessing pipeline), so the board's model comparison was
  recomputed with `random_state=42` and is labelled as recomputed.
- Omitted rather than invented: `rag` k=10 (only 5 retrieved docs exist),
  `python` date span (no date column), `causal` `uplift@top20` (two defensible
  orderings of tied LightGBM scores).

## Why

Every project case page states an outcome in prose. Six of 23 cases also have a
**functional standalone board** — `public/demos/<slug>/index.html` — that lets a
reader manipulate the actual numbers instead of reading a sentence about them.
The gap: 17 case pages have no board, so the strongest evidence in the portfolio
is only ever asserted, never demonstrated.

This PRD adds a board to every remaining case page, on the design system that
already exists, and binds the new pages to the drift gate so the 17 copies cannot
rot the way `public/games/index.html` did.

## The contract (non-negotiable — from `.claude/skills/portfolio-public-page-theming/`)

Read `public/demos/demo.css` (header comment = rationale), `public/demos/demo-theme.js`,
`src/styles/global.css` (the canon), and the skill + its two references **before**
writing a page. Then:

### 1. Head wiring — exactly this shape

```html
<!DOCTYPE html>
<html lang="ru" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>…</title>
  <meta name="theme-color" content="#0f2a2b">
  <script src="/demos/demo-theme.js"></script>
  <link rel="stylesheet" href="/demos/demo.css">
  <style>/* layout only */</style>
</head>
```

Load-bearing, in order:
1. **Root-absolute paths only.** `scripts/check_site.py` resolves every non-external
   `href`/`src` in the built HTML, skipping only `/_astro/`. A relative `demo.css`
   from `/demos/<slug>/` does not resolve and the gate fails.
2. **The script is blocking, in `<head>`, before the stylesheet.** Deferred or
   end-of-body flashes the wrong theme.
3. `data-theme="dark"` is the same default `Base.astro` uses.

### 2. The local `<style>` is layout only

No `:root` palette, no `box-sizing` reset, no font stack, no heading sizes, no local
tooltip/lede/metrics blocks. What stays: grid templates, canvas size, page-specific
geometry, and the local classes that map values onto `--dv-*` tokens.

Use the shared components instead of re-inventing them: `.demo-title`, `.demo-lede`,
`.demo-card`, `.demo-panel`, `.demo-tooltip` (+ `.is-visible`), `.demo-flag`
(+ `.demo-flag--ok`), `.demo-legend` / `.demo-swatch`, `.demo-kpi-value` /
`.demo-kpi-label`, `.demo-axis-label`, and the SVG utilities `.dv-ink`, `.dv-label`,
`.dv-muted` / `.dv-muted-line`, `.dv-axis`, `.dv-s1` / `.dv-s1-line`, `.dv-dataviz`.

`padding` on `body` already comes from `var(--page-pad)`.

### 3. Colour reaches the DOM as a class, never an inline style

```js
cell.className = 'cell seq-' + step;        // seq-1 … seq-7  (sequential ramp)
cell.className = 'cell cat-' + segment.n;   // cat-1 … cat-11 (categorical set)
```

Declare the step classes locally so the value→step mapping stays visible in the page
that owns it. Custom properties then re-resolve on a theme change with **zero
JavaScript** — only a `<canvas>` board needs a `demo:themechange` listener.

### 4. No colour literal outside `<meta name="theme-color">`

Enforced by the `demos carry no hardcoded colours` block in
`tests/lib/demo-tokens.test.ts`. An inline `style="background:#2e7d32"` beats every
token; that is exactly why it is banned.

### 5. `--dv-*` never styles an affordance

Not a button, a link, a focus ring, `--border-active`, or any hover state. Dataviz
colour is information; the coral action accent only holds its honest 10% while it
keeps the affordances to itself. Colour is a **redundant** channel — every board must
remain readable if the colours were removed (label the marks).

### 6. Base scale and language

14px/1.5 (demos are dashboard-density panels in fixed-height iframes, not prose);
`lang="ru"`; Inter headings (Cormorant is not loaded); `prefers-reduced-motion` is
inherited from `demo.css`.

### 7. Data is real or the board does not exist

Numbers come from the project's own committed artifacts. **Never fabricate an
illustrative number** — this is a data-analyst portfolio and a made-up figure
destroys the only thing it sells. If a project turns out to have no usable data
artifact, ship no board and report it as the outcome; that is a valid result.

Where a number cannot be re-derived cheaply (parquet, a model run), extract it with
the project's own toolchain, or use the number already committed in
`src/data/charts/<slug>.json` — that file is schema-validated and its conclusions
already cite digits.

## Scope — 17 boards

| slug | board | primary data source | wave |
|---|---|---|---|
| `ab` | SRM, lift + CI, power | `ab_test/data/experiment_sample.csv`, `src/data/charts/ab.json` | 1 |
| `causal` | Qini, decile uplift, CATE distribution | `causal-uplift/data/experiment.csv`, `charts/causal.json` | 1 |
| `churn` | risk deciles, churn by activity | `churn-prediction/data/{users,activity}.csv`, `charts/churn.json` | 1 |
| `sql` | MRR waterfall, funnel, retention | `sql-analytics-case-study/dbt/output_data/*.csv` | 1 |
| `rag` | recall@k / MRR, faithfulness | `rag-eval-harness/reports/*.csv` | 1 |
| `serp-rank` | position bias, IPW-corrected CTR, revenue/search | `serp-rank-lab/data/processed/*.parquet` | 1 |
| `airflow` | DAG run history, DQ gates, daily output | `airflow/data/out/*.csv`, `airflow/reports/` | 1 |
| `ml` | model comparison, cluster profile | `ml/data/*.csv`, `ml/reports/` | 1 |
| `python` | EDA: distributions, missingness, segments | `python/data/synthetic.csv`, `python/reports/` | 1 |
| `posthog` | funnel, retention, activation | `posthog-saas-analytics/reports/`, `charts/posthog.json` | 2 |
| `streamlit` | app KPI board | `charts/streamlit.json`, `streamlit-app/` | 2 |
| `supabase` | warehouse marts, metric tree | `supabase-product-analytics/{sql,scripts}` | 2 |
| `sales-calls` | call-stage funnel | `charts/sales-calls.json` | 2 |
| `scrolly` | story chapters + data | `scrolly-english-speaking/src` | 2 |
| `garden` | posts/glossary/graph structure | site `src/content/`, `dist/graph.json` | 2 |
| `site` | pages, payload, Lighthouse | `dist/`, `lhci-reports/` | 2 |
| `linkedin` | posts, impressions, engagement | `linkedin-nikita-boyarkin/{data,reports}` | 2 |

Existing boards (not in scope): `cohort`, `rfm`, `volta` (+`volta-board`), `telegram`
(referenced as the `bot` case), `bayesian` (referenced by a post), `games`.

## Wiring (site side)

- `demo: demos/<slug>/index.html` in `src/content/projects/<slug>.md` **and**
  `src/content/projects-en/<slug>.md`. URL-less path: `ProjectCard` prefixes the base.
- `src/pages/projects/[slug].astro` and `src/pages/en/projects/[slug].astro`:
  a «Демо» / «Live demo» link in `.project-meta` plus an inline `<iframe>` preview at
  the top of the case panel, mirroring how `src/content/posts/*.md` embed a board.

## Acceptance

```bash
bun run build                  # public/* → dist/
python3 scripts/check_site.py  # resolves every internal href/src incl. dist/demos/*
bun run test                   # parity + AA + "no colour literal" gate
bun run test:built             # reads the real built HTML in dist/
bun run check                  # astro check + tsc — 0 errors
```

- every new slug appears in `PAGES` in `tests/lib/demo-tokens.test.ts`, and that test
  is green;
- every board opens standalone **and** embedded, follows all three themes, and is
  readable at 360px wide;
- `DESIGN.md` → Demos and `CLAUDE.md` → Theme System no longer say "five boards".

## Anti-patterns

- ❌ relative asset paths; ❌ inline colour in JS; ❌ `--dv-*` on a hover state;
- ❌ `fill`+`stroke` in one utility class (it beats `fill="none"` and floods a
  polyline's interior — hence the paired `-line` classes);
- ❌ deleting a parity or `bites` case to make the suite green;
- ❌ a board for a project with no real data, with invented numbers.
