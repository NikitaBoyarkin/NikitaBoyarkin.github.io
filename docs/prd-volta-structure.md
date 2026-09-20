# PRD — Volta Structure, Visualization & Description

| Field | Value |
|---|---|
| Status | Phase 0 executed 2026-09-20 (§10). Phases 1–5 open. |
| Date | 2026-09-20 |
| Owner | Nikita Boyarkin |
| Scope | `projects/volta` hub + `volta-parts` (22 → 23) + light-touch entry surfaces and sibling cross-links. No sibling rewrite. |
| Relates to | `docs/prd-readability.md` (this PRD **amends its D11** for volta-parts), `docs/prd-v6.md`, `docs/prd-v7-outreach.md`. Does not re-open their other goals. |
| Deliverable | This document, then phased edits with mechanical acceptance checks. |

---

## 0. How to read this document

This is an **execution PRD**. It turns the decisions taken on 2026-09-20 into work with
verifiable acceptance criteria.

Three rules apply:

1. **Numbers are frozen** — the `bun run audit:content` drift guard (from `prd-readability.md`
   Phase 0) diffs every numeric token against `docs/content-baseline.json`. This PRD changes
   numbers in **exactly one place**: the reconciliation list (§4 D17 / §5 Phase 0). Everything
   else is presentation. After Phase 0 the baseline is re-snapshotted, so the reconciliation is
   the *only* legitimate numeric delta.
2. **Every task carries an acceptance criterion that fails when the task is not done.** Where a
   criterion cannot be checked mechanically, it says so explicitly and is marked **manual**.
3. **Evidence classes are marked.** `[V]` verified by reading the file. `[I]` inferred from
   verified evidence. `[NV]` not verified.

---

## 1. Context

### 1.1 What the audit found `[V]`

Audited on 2026-09-20 by direct read of the repo and the local source clone.

| Surface | Finding |
|---|---|
| Hub `src/content/projects/volta.md` | 317 lines, **2 530-word body**, 19 headings (15 H2 + 4 H3), **5 tables** (18+5+4+8+7 rows), **7 embedded PNGs**, and **all 34 charts** rendered in one column. Longest sections: `Рекомендации для бизнеса` (45 lines), `Визуализации` (31), `Досье` (24). |
| Charts on the hub | `src/pages/projects/[slug].astro:201` calls `<ChartsSection slug={slug} lang="ru" />` **without `ids`**. `ChartsSection.astro:18–22` treats absent/empty `ids` as "render all" → the hub shows **34 chart cards** in a single `flex-direction: column` (`ChartsSection.astro:56–60`). Built output `dist/projects/volta/index.html` contains 34 `id="chart-…"`. |
| `src/data/charts/volta.json` | 34 charts: **bar 20, line 7, cohort-heatmap 5, funnel 1**. No `scatter`, no `histogram`. Every chart id is referenced by exactly one part; zero orphans. |
| Volta parts | 22 RU + 22 EN in `src/content/volta-parts{,-en}/`. All 22 carry the **same 8-key frontmatter** (`charts, description, github, impact, order, part, title, tools`); **3 impact bullets** and **6 tools** each; `charts` count 1–4. **No `draft`**. **No group/layer field.** |
| Parts skeleton | All **22/22 deviate** from `prd-readability.md` D11. Uniform H2 set: `Контекст → Данные и метод → Выводы → Рекомендации → Документация` (18 files); 4 files (`anomalies, churn, segmentation, unit-economics`) add a one-off `Визуализация` before `Документация`. The EN twins mirror this. |
| Parts navigation | Flat, unlabelled. `[part].astro:105–115` renders a flat `<ul>` of 21 siblings + "Обзор Volta"; **no layer labels, no order numbers, no prev/next**. The hub's `children` list (`[slug].astro:222–233`) is likewise a flat `<ul>` of 22. |
| Layer taxonomy | Exists **only in prose** (`volta.md:172,181,194,202`): core 1–4 / extended 5–12 / Market & Jobs 13–17 / RAT v2 18–22. Not machine-readable. |
| Source clone | `/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/volta-banking` — git, branch `main`, HEAD `f0b7da4`, clean. Contains **23 analyses** (`scripts/volta_*.py`) but the site exposes only **22 parts**. |
| Missing analysis | `volta-banking/scripts/volta_causal_kyc.py` — a full **difference-in-differences** causal validation of the retention claim (treated = in-app KYC, comparison = partner, cutoff 2024-09; naive pre/post, 2×2 DiD, covariate-adjusted DiD with cohort-clustered SE, parallel-trends check, placebo, SMD/overlap), with `generate_causal_kyc_data.py` and `tests/test_causal_kyc.py`. **Not exposed as a part or chart on the site.** |
| Demo `public/demos/volta/index.html` | 21 KB, zero external scripts, 8 inline SVGs. KPI strip says **"17 analytical projects"** and **"170+ tests · 98% coverage"**; includes a **"Causal layer — difference-in-differences"** section (matching the missing `volta_causal_kyc`). It is **not linked from the hub** (`dist/projects/volta/index.html` contains 0 `demos/volta`); it is reachable only from `ProjectCard` (board/spotlight/headline). |
| Entry surfaces | Home featured card (`src/pages/index.astro:101–126`) renders hero + `description` + 5 tool chips + "Разбор проекта →" — **no `impact`, no demo, no GitHub**. `HeadlineCases.astro:64–133` (Volta = headline #1) renders hero + `caseStudy.metrics.slice(0,3)` + demo chip + GitHub chip. `ProjectCard.astro` renders **all 6 `impact` bullets joined** into one `Эффект: …` line. `ProjectSpotlight.astro` / `HomeBoard.astro` are **dead code**. |
| prev/next bug | `src/pages/projects/[slug].astro:29` defines a local `ORDER` of **8 slugs**; the collection and `src/lib/projects.ts` `PROJECT_ORDER` have **17**. 9 slugs get `indexOf === -1` and sort first, so on the Volta page "← Предыдущий" points to Supabase. The EN twin `src/pages/en/projects/[slug].astro:30` has the identical stale 8-slug list. |
| Unused capability | `scatter` is in `CHART_TYPES` (`src/lib/charts.ts:11`), the discriminated union (`:46`), `ChartCard.astro:30`, and `ChartScatter.astro` exists — but **no chart file uses it**. Scatter-shaped content (PCA projection, silhouette) ships as static PNGs. |
| Orphan asset | `public/images/volta/segmentation_silhouette.png` is referenced by **no** file, though the segmentation narrative discusses the silhouette. |

### 1.2 Numeric contradictions found `[V]`

| # | Claim A | Claim B | Source of truth |
|---|---|---|---|
| 1 | RFM = **6** segments (`volta.md:138,186`; `projects-en/volta.md:136,184`; `volta-parts/rfm.md:7`; `volta.json` `rfm-heatmap` description + conclusion; source `README.md:34,165,338`; source `presentations/volta_executive_summary.html:101`) | Heatmap `cohorts` has **7** rows | Code `volta_rfm_analysis.py:55–72`: 6 named branches + `default="Needs Attention"` = **7** (replayed: Champions 23.9%, Lost 23.2%, Needs Attention 19.0%, Loyal 12.8%, At Risk 11.5%, Potential 5.4%, New 4.2%). **7 is correct.** |
| 2 | FX current ≈ **€3M/mo**, gap "**два порядка**" (`volta-parts/fx-sourcing.md:38`, `volta.json:797`) | "~€332M/мес, **122×**" (`volta.md:163,205`; part frontmatter) | Code `volta_fx_sourcing.py`: current = 1000 × €2 729 = **€2.729M**; gate = **€332.36M**; ratio = **121.8× ≈ 122×**. **122× is correct**; "€3M / два порядка" is wrong. |
| 3 | Causal claim "+**6.24pp** activation" (`volta_causal_kyc.py:9`, `volta_segmentation.py:15,930`, `presentations/volta_executive_summary.html:61,62,65`, `notebooks/04_segmentation.ipynb:524`) | "+**5.72pp** KYC conversion" (`volta.md`; source `README.md:30,133,288,448,480`; `outputs/ab_conversion_comparison.md:9`) | `generate_causal_kyc_data.py:18` declares `activated +0.057` "matches Project 2's +5.72pp activation lift"; the A/B output is 61.54% − 55.82% = **+5.72pp**. **+5.72pp is correct**; the exec summary's stale block (treatment 62.1%, Z=6.35, CI [+4.26,+8.16], +€716K/yr) is from an older run. |

### 1.3 What is already fine `[V]`

- Hub `description` is result-first and inside the 120–200-char spec; RU Cyrillic / EN Latin.
- All 23 chart payloads validate; every conclusion carries a digit (schema-enforced).
- `related:` links are locale-neutral; RU/EN parts are 1:1.
- Design system, themes, typography are set — this PRD does not restyle the site.

---

## 2. Problem statements

### P1 — The hub is unreadable at the top and endless at the bottom `[V]`

34 chart cards in one column, 5 overlapping tables, 7 PNGs, and a 22-item flat link list. A
recruiter who reads for 30 s gets a TL;DR, then a wall. There is no map of the 22 parts and no
curated evidence set — the reader must scroll ~34 charts to reach the recommendations.

### P2 — The 23 sub-projects are navigated as an unlabelled flat list `[V]`

The core/extended/Market&Jobs/RAT-v2 taxonomy is prose-only; the schema has no `layer` field; the
hub and part pages render flat `<ul>`s; part pages have no prev/next. The loop
`discover → validate → measure → optimize` is invisible in navigation.

### P3 — The flagship's central causal claim is under-evidenced on the site `[V]`

The narrative says the fix *caused* +9.2pp M3 retention, but the site's support is a pre/post
Welch t-test (correlation). The repo already holds a full DiD analysis (`volta_causal_kyc.py`)
that is not exposed. The site says "22 projects"; the repo has 23 analyses.

### P4 — The demo is stale and unlinked `[V]`

"17 analytical projects", "170+ tests · 98% coverage" (README says ≥90% / ~97%), and it is not
reachable from the hub. A live artifact that contradicts the page it belongs to is a trust flag
(`CONTEXT.md` red flag class).

### P5 — Parts pages are visually and structurally inconsistent with the rest of the site `[V]`

All 22 deviate from the documented skeleton; 4 carry a one-off `Визуализация`; 7 static PNGs are
duplicated between the hub and parts; the `scatter` chart type is unused; one asset is orphaned.

### P6 — Entry surfaces undersell the flagship `[V]`

The home featured card — the recruiter's first contact and the site's North Star surface — shows
only the description and 5 chips, with no impact metrics, no demo, no GitHub. The prev/next order
on project pages is broken in both locales.

### P7 — Two published numbers are false `[V]`

RFM "6" (actually 7) and FX "€3M / два порядка" (actually €2.73M / 122×), on the site **and** in
the source repo README / executive-summary HTML.

---

## 3. Goals and non-goals

### 3.1 Goals

| ID | Goal | Measure |
|---|---|---|
| G1 | Hub is scannable: TL;DR → map → 4 evidence blocks → curated charts → gates → method | H2 set matches D10; hub chart count = 6 |
| G2 | All 23 parts are discoverable and labelled by layer, with linear prev/next | every part page has a layer label + prev/next; map groups by `layer` |
| G3 | The causal claim is evidenced by the DiD analysis | `causal-kyc` part exists RU+EN; count "23" everywhere |
| G4 | Every published number is true | RFM = 7, FX = €2.73M / 122×, causal = one source of truth; `audit:content` green after re-snapshot |
| G5 | Visualization is consistent and native where possible | PNGs on Volta reduced to ≤1 (SHAP-local); `scatter` type used; SVG charts carry value labels + key-finding annotation |
| G6 | Parts follow one documented skeleton | 23/23 parts in-order subset of the dossier skeleton; 0 one-off `Визуализация` |
| G7 | Entry surfaces carry the result | featured card shows ≥3 metrics + demo + GitHub; prev/next order matches `PROJECT_ORDER`; demo KPI truthful and linked from the hub |
| G8 | Sibling projects stay untouched except cross-links | 0 content rewrites in `src/content/projects/` other than `volta` |

### 3.2 Non-goals — explicitly out of scope

- **Visual redesign of the site.** Theme, palette, typography, layout primitives are set.
- **Rewriting the 8 sibling projects** (`ab`, `cohort`, `churn`, `rfm`, `causal`, `sql`, `posthog`,
  `streamlit`) — they are independent claims about separate repos (§1.2/B of the audit). Only
  cross-links and entry surfaces are touched.
- **New projects beyond `causal-kyc`.** The repo has exactly 23 analyses; no others are added.
- **Changing the flagship's narrative spine.** `Дело → Улики → Вердикт` is a deliberate asset
  (`prd-readability.md` D6/D14) and is kept; this PRD restructures around it, not away from it.
- **New metrics.** The reconciliation (§Phase 0) fixes false claims; it does not invent numbers.
- **Post rewriting.** Posts are out of scope; only the demo and the Volta surface change.

---

## 4. Decisions taken (2026-09-20)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Scope = Volta hub + 22→23 parts + light-touch entry surfaces + sibling cross-links.** | The 22 parts are the "related projects"; siblings are separate artifacts. |
| D2 | **Priority recruiter → peer → AI-search.** | `CONTEXT.md` North Star is recruiter contacts/month; SEO/AI infra is already invested. |
| D3 | **Trigger = hub overload + invisible parts; the stale demo is mandatory; rest is residual.** | P1 and P2 compound; P4 is a trust flag. |
| D4 | **Full freedom on components/schema/CSS within "no chart libraries" + design system; numbers frozen.** | Fixing overload and grouping is impossible content-only. |
| D5 | **Hub role = hybrid**: keep the narrative spine, restructure around it, add a grouped map, delegate charts to parts. | Keeps the flagship's deliberate narrative asset while fixing P1/P2. |
| D6 | **Siblings: light touch only** — coherent cross-links + entry surfaces; no content rewrite. | They are independent claims about different repos. |
| D7 | **Add `layer` to `voltaPartSchema`** (`core\|extended\|market-jobs\|rat-v2\|causal`); group the hub map, the part sibling list, and add prev/next by `order`. | Makes the loop visible; kills the flat list. |
| D8 | **Convert static PNGs to native charts where clean** (PCA scatter, ROC, k-selection, sensitivity, SHAP-summary, anomaly); keep **SHAP-local** as PNG; de-duplicate; resolve the orphan. | Native charts give theme + responsiveness + bilingualism; `scatter` finally gets used. |
| D9 | **Rebuild the demo** to the true project count, measured test/coverage KPI, synced causal section; **link it from the hub**. | A live artifact must be truthful. |
| D10 | **Hub layout (moderate):** `Итог в 30 секундах → Дело → Карта проекта → Улики №1–4 → Вердикт → Графики → Остальные проекты → Слой RAT v2 → Рекомендации и гейты → Данные и метод → Эффект → Документация`. Curated hub charts = `onboarding-funnel`, `kyc-ab-conversion`, `cohort-retention-heatmap`, `retention-pre-post`, `segmentation-size-vs-revenue`, `segmentation-pareto-cumulative`. | Fixes P1 without discarding the narrative. |
| D11 | **Legitimize the parts "dossier" skeleton** (`Контекст → Данные и метод → Выводы → Рекомендации → Документация`); fold the 4 one-off `Визуализация` into `Данные и метод`; **amend `prd-readability.md` D11** (projects keep the shared skeleton; parts get the dossier skeleton). | The parts' convention is already 100% uniform and reads better for a dossier. Renaming 66 headings to satisfy a stale rule has no reader benefit. |
| D12 | **Description axis = all**: (a) light hub fix, (b) 23 part descriptions rewritten as result-first mini-abstracts (dual-purpose: they become the map one-liners), (c) a result-summary block on part pages, (d) entry-surface copy. | If the hub delegates depth, part descriptions become the primary text. |
| D13 | **Visualization depth = restyle SVG** (value labels on bars, key-finding annotation, consistent axes/typography, highlight colour). **No interactivity.** | Interactivity on hand-built static SVG is costly and fragile; recruiter-first wins from readability. |
| D14 | **Entry surfaces: redesign the home featured card** (≥3 metrics + demo + GitHub); fix prev/next `ORDER` in RU+EN; remove or wire dead code (`ProjectSpotlight`/`HomeBoard`). | First contact is the North Star surface and is currently weaker than `HeadlineCases`. |
| D15 | **Delivery: this PRD → phases → execution. RU+EN both. Fix the source repo too.** | Repo mandates twin files; the GitHub artifact is what recruiters open first. |
| D16 | **Add `causal-kyc` as the 23rd part**, `layer: causal`, `order: 23` (no renumbering of existing parts); "22"→"23" everywhere; add 1–2 DiD charts. | The causal claim is the flagship's strongest claim and its proof is unused. |
| D17 | **Residuals:** wire `segmentation_silhouette.png` into the `segmentation` part; `layer` values `core\|extended\|market-jobs\|rat-v2\|causal`; `ProjectBoard` stays 17 projects (parts are not board cards); no separate Volta index page (the map lives on the hub); re-snapshot `docs/content-baseline.json` after reconciliation; demo test/coverage KPI measured from the repo, not invented. | Removes silent assumptions. |

---

## 5. Work plan

### Phase 0 — Reconciliation & guard

Fix the three contradictions in §1.2 at their source of truth, then re-snapshot the drift baseline.

| Task | Files |
|---|---|
| RFM `6` → `7` (and name the 7th: `Needs Attention`) | `src/content/projects/volta.md:138,186`; `src/content/projects-en/volta.md:136,184`; `src/content/volta-parts/rfm.md:7`; `src/data/charts/volta.json` `rfm-heatmap` description + conclusion (RU+EN) |
| FX `€3M / два порядка` → `€2,7 млн/мес … ~122×` | `src/content/volta-parts/fx-sourcing.md:38`; `src/data/charts/volta.json:797` |
| Causal `+6.24pp` → `+5.72pp` (source of truth = the A/B output) | `volta-banking/scripts/volta_causal_kyc.py:9`; `volta-banking/scripts/volta_segmentation.py:15,930`; `volta-banking/presentations/volta_executive_summary.html:61,62,65` (treatment 62.1%→61.5%, Z 6.35→5.82, CI [+4.26,+8.16]→[+3.78,+7.66], +€716K/yr→+€656K/yr); `volta-banking/notebooks/04_segmentation.ipynb:524` |
| Source-repo `6` → `7` | `volta-banking/README.md:34,165,338`; `volta-banking/presentations/volta_executive_summary.html:101`; root-cause docstring `volta-banking/scripts/volta_rfm_analysis.py:5` |
| Re-snapshot baseline | `bun run audit:content:snapshot` → commit `docs/content-baseline.json` |

**Acceptance:** `bun run audit:content` exits 0 after the re-snapshot; the reconciliation list is
the only numeric delta versus the previous baseline; source-repo `README`/HTML state 7.

---

### Phase 1 — Data model

- Add `layer` to `voltaPartSchema` in `src/content.config.ts` (RU + EN collections).
- Assign `layer` to all 22 existing parts: `core` (1–4), `extended` (5–12), `market-jobs`
  (13–17), `rat-v2` (18–22).
- Add `causal-kyc` part RU+EN: `part: causal-kyc`, `order: 23`, `layer: causal`, `impact` (3),
  `tools`, `charts`, `github`, result-first `description`.
- Add 1–2 charts for `causal-kyc` to `src/data/charts/volta.json` (e.g. naive pre/post vs DiD
  estimate; parallel-trends / placebo diagnostics). Every conclusion must carry a digit.

**Acceptance:** `bun run build` passes; the schema validates; the new part renders at
`/projects/volta/causal-kyc/` and `/en/projects/volta/causal-kyc/`; `layer` present on 23×2 files.

---

### Phase 2 — Hub restructure

- Apply D10's H2 order to `src/content/projects/volta.md` and its EN twin.
- Add a **`Карта проекта` / `Project map`** section: 23 parts grouped by `layer`, each with its
  result-first description and a link. Rendered from the collection (not hand-written).
- Call `<ChartsSection slug="volta" ids={[...6 ids]} />` on the hub (RU+EN).
- Collapse `Досье` + `Ключевые результаты` into the map; keep the `Слой RAT v2` gate table;
  compress `Рекомендации для бизнеса` (keep the ship/pilot/hold/kill table).
- Remove the `Визуализации` section (PNGs move to their parts).
- Add the demo link to `Документация`.
- Update "22" → "23" everywhere in the hub (RU+EN).

**Acceptance:** hub H2 set matches D10 in order; hub chart count = 6 (grep `id="chart-"` in
`dist/projects/volta/index.html`); no paragraph >500 chars; `bun run audit:content` exits 0;
`bun run build && bun run check` green.

---

### Phase 3 — Parts

- **Skeleton (D11):** normalize 4 files' one-off `Визуализация` into `Данные и метод`; confirm the
  dossier H2 set across 23 RU + 23 EN.
- **Navigation (D7):** add a layer label, prev/next by `order`, and a layer-grouped sibling list
  to `src/pages/projects/volta/[part].astro` and the EN twin.
- **Descriptions (D12):** rewrite all 23 part descriptions as result-first mini-abstracts
  (120–200 chars, first 72 self-contained) — these feed both the map and the part meta.
- **Result-summary block (D12c):** add a `CaseStudy`-style summary to part pages.
- **Visualization (D8/D13):** convert PCA scatter, ROC, k-selection, sensitivity, SHAP-summary
  and anomaly PNGs to native charts; keep SHAP-local as PNG; wire
  `segmentation_silhouette.png` into the `segmentation` part; add value labels + key-finding
  annotation to the SVG chart components.

**Acceptance:** 23/23 parts match the dossier skeleton in order; 0 `## Визуализация` /
`## Visualization` headings remain; every part page renders prev/next and a layer label; Volta
PNG count ≤1; `scatter` used at least once; `bun run test && bun run check` green; Playwright
screenshots of 3 representative part pages show no layout break.

---

### Phase 4 — Entry surfaces & demo

- Redesign the home featured card (`src/pages/index.astro:101–126` + EN twin) to show ≥3 impact
  or `caseStudy` metrics, the demo chip, and the GitHub chip.
- Fix prev/next: replace the local 8-slug `ORDER` in `src/pages/projects/[slug].astro:29` and
  `src/pages/en/projects/[slug].astro:30` with `PROJECT_ORDER` from `src/lib/projects.ts`.
- Remove or wire `ProjectSpotlight.astro` / `HomeBoard.astro` (currently dead).
- Rebuild `public/demos/volta/index.html`: 23 projects, measured test count / coverage (run
  `pytest --collect-only` and coverage in `volta-banking`), synced causal/DiD section; link it
  from the hub.
- Ensure coherent cross-links between the hub/parts and the sibling projects (light touch, D6).

**Acceptance:** featured card shows ≥3 metrics + demo + GitHub; prev/next order equals
`PROJECT_ORDER` (built-output check); demo KPI matches a measured value; the hub contains a
`demos/volta` link; no sibling content file changed beyond `related:`/link lines.

---

### Phase 5 — Verification & documentation

- Full gates: `bun run test`, `bun run check`, `bun run build`, `bun run audit:content`,
  Playwright screenshots of the hub and 3 parts, Lighthouse if the layout changed materially.
- Update `CLAUDE.md`: parts dossier skeleton, the `layer` field, the curated-charts note, the
  new Volta chart count.
- Amend `docs/prd-readability.md` D11 to record the parts exception.
- Update `CONTEXT.md` only if a term changed (e.g. "23 projects").

**Acceptance:** `bun run check` → 0/0/0; `bun run audit:content` exits 0; `bun run build`
page count recorded; screenshots reviewed; `CLAUDE.md` states the parts skeleton and `layer`.

---

## 6. Acceptance metrics

| Metric | Baseline | Target |
|---|---|---|
| Hub chart cards | 34 | **6** |
| Hub H2 sections | 15 | **12** (D10 order) |
| Parts with a `layer` | 0 | **23** |
| Parts exposed | 22 | **23** |
| Parts with prev/next | 0 | **23** |
| Parts deviating from the dossier skeleton | 22 | **0** |
| One-off `Визуализация` headings | 4 | **0** |
| Volta static PNGs in content | 7 (+1 orphan) | **1** (SHAP-local) |
| `scatter` charts used | 0 | **≥1** |
| False published numbers (RFM, FX, causal) | 3 | **0** |
| prev/next order mismatches | RU+EN | **0** |
| Sibling content files rewritten | — | **0** |
| Numeric drift beyond the reconciliation list | n/a | **0** (`audit:content` green) |

---

## 7. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | The restructure silently changes a metric | Phase 0 re-snapshot; `audit:content` after every phase; reconciliation is the only allowed delta |
| R2 | Moving charts to parts loses hub-level evidence | Curated 6 on the hub; every part keeps its own slice via `ids` |
| R3 | `causal-kyc` numbers conflict with the A/B (+6.24pp vs +5.72pp) | Phase 0 resolves the source of truth before the part is written |
| R4 | The `layer` field breaks RU/EN parity | Parity is an explicit acceptance criterion per phase |
| R5 | Native-chart conversion drops precision | Keep raw values in the payload; verify against the source outputs |
| R6 | The demo rebuild overstates test/coverage | Measure from `volta-banking`, never invent |
| R7 | Amending `prd-readability.md` D11 hides an unfinished task | The amendment is explicit and dated; the parts skeleton becomes the documented convention |
| R8 | This PRD goes stale after execution | Phase 5 documents the convention in `CLAUDE.md` |

---

## 8. PENDING — needs the owner

| Item | Why it waits |
|---|---|
| The `causal-kyc` layer placement (new `causal` layer vs folding into `rat-v2`) | D16 proposes a new `causal` layer; confirm at Phase 1 |
| First-72-char legibility of the 23 new part descriptions | Mechanical length is checkable; the hook is **manual** |
| Whether the demo stays as a standalone page or becomes a part | D9 keeps it standalone + hub-linked; revisit if it duplicates the curated charts |
| Whether `CONTEXT.md` needs a terminology update | Depends on whether "23 projects" becomes canonical vocabulary |

---

## 9. Appendix — file inventory

### Content touched

`src/content/projects/volta.md` · `src/content/projects-en/volta.md` ·
`src/content/volta-parts/*.md` (22 → 23) · `src/content/volta-parts-en/*.md` (22 → 23) ·
`src/data/charts/volta.json`

### Code touched

| File | Change |
|---|---|
| `src/content.config.ts` | `layer` on `voltaPartSchema` (RU+EN) |
| `src/pages/projects/volta/[part].astro` + EN twin | layer label, prev/next, grouped sibling list |
| `src/pages/projects/[slug].astro` + EN twin | hub curated `ids`; prev/next via `PROJECT_ORDER` |
| `src/pages/index.astro` + EN twin | featured-card redesign |
| `src/components/charts/*` | value labels, key-finding annotation (D13) |
| `src/components/ProjectSpotlight.astro`, `HomeBoard.astro` | remove or wire (dead code) |
| `public/demos/volta/index.html` | rebuild to 23 projects, measured KPI |
| `public/images/volta/*` | native charts replace PNGs; wire the orphan |
| `src/styles/global.css` | only if the map/part-summary needs it |
| `CLAUDE.md`, `docs/prd-readability.md`, `docs/content-baseline.json` | convention + baseline |

### Source repo (out of the portfolio repo)

`/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/volta-banking` — `README.md`, `presentations/volta_executive_summary.html` (RFM `6` → `7`); `scripts/volta_causal_kyc.py`, `scripts/volta_segmentation.py`, `notebooks/04_segmentation.ipynb`, `scripts/volta_rfm_analysis.py` (stale `+6.24pp` A/B block → `+5.72pp`).

### Verified facts this document relies on

`src/pages/projects/[slug].astro:29,201` · `src/pages/en/projects/[slug].astro:30` ·
`src/components/charts/ChartsSection.astro:18–22,56–60` · `src/lib/charts.ts:11,46` ·
`src/content.config.ts:31–41` · `src/lib/projects.ts:5,14` · `src/pages/index.astro:101–126` ·
`src/components/HeadlineCases.astro:64–133` · `src/components/ProjectCard.astro` ·
`src/content/volta-parts/*.md` · `src/data/charts/volta.json` ·
`volta-banking/scripts/volta_rfm_analysis.py:55–72` · `volta-banking/scripts/volta_fx_sourcing.py` ·
`volta-banking/scripts/volta_causal_kyc.py`.

---

## 10. Execution log

| Phase | Result |
|---|---|
| 0 | **Done 2026-09-20.** RFM `6`→`7`: 10 site edits (`volta.md:138,186`, `projects-en/volta.md:136,184`, `volta-parts/rfm.md:7`, `volta-parts-en/rfm.md:7`, `volta.json:371,372,390,391`) + source (`README.md:34,165,338`, `volta_executive_summary.html:101`, root-cause `volta_rfm_analysis.py:5`). FX `€3M/два порядка`→`€2,7M/~122×`: 4 edits (`fx-sourcing.md:38`, `fx-sourcing-en.md:38`, `volta.json:797,798`). Causal resolved to **+5.72pp** (per `generate_causal_kyc_data.py:18` + `outputs/ab_conversion_comparison.md:9`); fixed the stale `+6.24pp` block in 4 source files (`volta_causal_kyc.py:9`, `volta_segmentation.py:15,930`, `volta_executive_summary.html:61,62,65`, `04_segmentation.ipynb:524`). Baseline re-snapshotted (104 files / 4043 numeric tokens). **Verification:** `audit:content` → 0; `check` → 0/0/0; `build` → 133 pages; source `py_compile` + `.ipynb` JSON OK; no `+6.24pp` / `€716K` / `62.1%` remain. **Scope note:** the PRD listed only the causal docstring; the same stale A/B block lived in 3 more source files — included as the same reconciliation. **Pre-existing & unrelated:** `bun run test` → `tests/lib/metrics.test.ts:39` fails (`portfolio.sqlCases` 25 vs 26 `.sql` cases in the sibling `sql-analytics-case-study`); reproduces with Phase-0 edits stashed. |
| 1 | — |
| 2 | — |
| 3 | — |
| 4 | — |
| 5 | — |
