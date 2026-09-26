# PRD — Content Readability (Projects, Articles, Project Descriptions)

| Field | Value |
|---|---|
| Status | Phases 0–4 executed 2026-09-18 (see §10). |
| Date | 2026-09-18 |
| Owner | Nikita Boyarkin |
| Scope | `src/content/**` copy + structure; one typographic measure; incidental link/parity fixes. No redesign. |
| Relates to | `docs/prd-v6.md` (consolidation & credibility). This PRD does not supersede it and does not re-open its goals. |
| Deliverable | This document, then phased edits to content with mechanical acceptance checks. |

---

## 0. How to read this document

This is an **execution PRD**. Its job is to turn the readability decisions taken on 2026-09-18 into
work with verifiable acceptance criteria.

Three rules apply:

1. **Numbers are frozen.** Every metric token — %, p-value, €, Z, N, pp, K, M — must survive the
   rewrite byte-for-byte in value. A rewrite changes *presentation*, never *content*. The drift audit
   (§5, Phase 0) enforces this mechanically. **Exception: the `description:` field (D20) is the subject
   of Phase 1 and is excluded from the frozen set**; bodies, `impact`, `caseStudy`, `faq`, titles and
   `excerpt` remain frozen.
2. **Every task carries an acceptance criterion that fails when the task is not done.** Where a
   criterion cannot be checked mechanically, it says so explicitly and is marked manual.
3. **Evidence classes are marked.** `[V]` verified by reading the file. `[I]` inferred from verified
   evidence. `[NV]` not verified.

**Precondition — Phase 0 must run before Phase 1.** Without the baseline snapshot, "no number drift"
cannot be evaluated.

---

## 1. Context

### 1.1 What the audit found `[V]`

Audited on 2026-09-18 by direct read of all content files.

| Surface | Files | Finding |
|---|---|---|
| `src/content/projects/` | 17 RU | **14/17 `description:` are English above a Russian body.** Only `games`, `sales-calls`, `scrolly` are on-language |
| `src/content/projects-en/` | 17 EN | descriptions EN, bodies EN — no language mismatch; but 5 files have lost `caseStudy`/`demo` present in RU |
| `src/content/volta-parts/` | 4 RU | **4/4 `description:` are English above a Russian body** |
| `src/content/volta-parts-en/` | 4 EN | descriptions byte-identical to the RU files' |
| `src/content/posts/` | 24 RU | structurally sound, but 3 posts lack `## Кратко`; closing section named 4 different ways; 4 posts carry paragraphs >500 chars |
| `src/content/posts-en/` | 2 EN | clean doka translations |

**10 distinct H2 skeletons** across the 34 project files. Every body ends with `## Documentation`; every
body opens with `## Business Context` (English) **except** `volta` (`## Дело`). `Hypothesis` is absent
from 7 projects that have no hypothesis. One-off sections exist in a single project each (`Modules`,
`Games`, `Pipeline`, `Pages`, `Архитектура`, `Модель безопасности (RLS)`, `Что показывает дашборд`).

**Description spread:** 156–331 characters, no target. The longest (`ab`, 331) is a comma-list of every
method in the toolkit.

### 1.2 Why the descriptions matter beyond the card `[V]`

`description` is a single field consumed by **six** surfaces with **no server-side truncation**:

| Consumer | Location | Constraint |
|---|---|---|
| Project card `<p>` | `ProjectCard.astro:41` | full text shown |
| Project page meta | `packages/projects/[slug].astro` → `Base.astro:91` | Google shows ~155 chars |
| `og:description` / `twitter:description` | `Base.astro:124,131` | ~200 chars readable |
| Home featured card | `pages/index.astro:117` | full text |
| `MaterialStrip` | `components/MaterialStrip.astro:51,72` | **truncated at 72 chars + `…`** |
| JSON-LD `Article.description` | `packages/projects/[slug].astro:69` | machine-read (AI search) |

**Consequence:** a description must be legible in its first 72 characters, self-contained by ~155, and
≤ ~200 to avoid an awkward clamp. The current `volta` description (318 chars) opens
"End-to-end neobank analytics narrative — 17 projects across 12 analytical domains + Market & Jobs:…"
— its first 72 chars carry no result and no number.

### 1.3 What is already fine `[V]`

Typography is **not** the problem and is out of scope except one item:

- Post prose measure is `65ch`, centred, `line-height 1.7` (`src/styles/blog.css:212`).
- Heading sizes, spacing scale, `text-wrap: balance` are all in place.
- Post bodies are never walls of text — every one of the 24 has 5–11 H2 headings; `InnerTOC` builds a
  runtime TOC from them and rebuilds automatically when headings change.
- No cross-page anchor links exist in content, so changing headings breaks no inbound anchors. The only
  anchor links are inside `cohort-retention-guide.md`'s manual `## Содержание`, which is regenerated
  against the same headings.

---

## 2. Problem statements

### P1 — Off-language descriptions on Russian pages `[V]`

14/17 RU project files and 4/4 RU volta-parts render an **English** description on a **Russian** page.
A Russian recruiter's first, 72-char impression of `volta`, `ab`, `causal`, `churn`, `cohort`, `rfm`,
`sql`, `supabase`, `posthog` and others is an English comma-list.

### P2 — No description standard `[V]`

Descriptions range 156–331 chars; some open with the outcome (`volta` opens with a narrative wrapper),
some with a method list (`ab`), some with a bare category (`rfm`: "RFM analysis of bank clients to
segment users by…"). None is written result-first. There is no rule, so there is no consistency.

### P3 — Ten skeletons; a reader re-learns the page every time `[V]`

A hiring manager scanning three projects sees `Business Context → Hypothesis → Data & Method → Insight
→ Impact → Documentation` on one, `Business Context → Data & Method → Run → Insight → Impact →
Documentation` on the next, and `Дело → Улика №1…Вердикт` on the flagship. English headings sit inside
Russian bodies, which is itself a readability defect.

### P4 — Dense blocks that hide the finding `[V]`

Specific `[V]` offenders: `volta.md` `## Data & Method` (four numbered mega-paragraphs of raw stats,
including SRM p=1.00 and a 9/11→4/11 comparison in one sentence); `causal.md` "оговорка о честности"
(one ~70-word sentence); `sql.md` `## Insight` (five findings in one paragraph); `churn.md` and
`causal.md` `## Data & Method` (6–7 dense bullets + 2 tables before any insight). In posts,
`feature-impact-analysis` has a 297-char mean paragraph; `first-value-moment-activation` has 8
paragraphs over 400 chars.

### P5 — Incidental drift in the twin files `[V]`

| Drift | Files |
|---|---|
| EN `related` / body links point at **RU routes** | `projects-en/causal.md`, `cohort.md`, `python.md`, `rfm.md`, `site.md`, `volta.md` |
| RU has `caseStudy`/`demo`; EN twin lost it | `bot` (caseStudy + demo), `sql` (caseStudy), `volta` (demo), `cohort` (demo), `rfm` (demo) |

The repo's own rule is "keep RU and EN in sync" (`CLAUDE.md`). These are violations of an existing rule,
not new work — but they live in the files this PRD touches, so they are fixed here (D7).

---

## 3. Goals and non-goals

### 3.1 Goals

| ID | Goal | Measure |
|---|---|---|
| G1 | Every project + volta-part description is on-language (RU Cyrillic on RU pages) | grep on `^description:` |
| G2 | Every description follows the spec: result-first, 120–200 chars, first 72 self-contained | char count `[V]`; first-72 legibility manual |
| G3 | One skeleton across the 16 non-volta projects and all volta-parts; `volta` narrative + TL;DR | H2 in-order subset check |
| G4 | No post paragraph >500 chars; every post has a `## Кратко`; one closing-section name for links | script/spot-check |
| G5 | Zero numeric drift across the whole rewrite | `bun run audit:content` exits 0 |
| G6 | P5 drift repaired: no EN file links a RU route; RU/EN parity restored | grep |

### 3.2 Non-goals — explicitly out of scope

- **Visual redesign.** Type, palette, themes, layout are set (see `docs/prd-v6.md` D2). Do not restyle.
- **Post rewriting for substance.** Long posts are not shortened and stubs are not expanded. Only
  paragraph splitting, the `Кратко` addition, and the closing-section rename.
- **Project body rewrite from scratch.** Structure and presentation change; claims and numbers do not.
- **New projects or posts.** Same set in, same set out.
- **Fixing `site.md`'s subject matter.** It is edited only as one of the 17 descriptions/bodies.
- **Removing jargon from technical sections.** Jargon policy applies to the plain register only (§4 D9).
- **`description` field split.** The field stays single-purpose; the spec must satisfy all six consumers.

---

## 4. Decisions taken (2026-09-18)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Two registers.** Descriptions/cards + page TL;DR = recruiter register. Body from `Данные и метод` = technical register. | A hiring manager reads 10–20 s; a peer reads the method. One register would under-serve both |
| D2 | **Two axes: copy + structure.** Typography untouched except D16. | The survey shows typography is already correct; the defects are language, consistency, and density |
| D3 | **Three phases**, in order: descriptions → project bodies → posts. | Descriptions are the highest-visibility, lowest-risk change and validate the workflow |
| D4 | **Both languages.** RU is primary; EN mirrors and keeps parity. | RU is the site default; `CLAUDE.md` mandates twin files |
| D5 | **Depth = restructure + rewrite for clarity, preserving every number and claim.** | The value is readability, not new content. Numbers are frozen (rule 0.1) |
| D6 | **One shared skeleton for the 16 non-volta projects + volta-parts; `volta` stays narrative with a TL;DR.** | Consistency for scanning; the flagship narrative is a deliberate asset worth keeping |
| D7 | **Fix P5 in the same pass** (EN→RU links, parity gaps), listed separately from copy edits. | The files are open anyway; mixing them silently would blur the audit trail |
| D8 | **Deliverable is an execution PRD in the repo**, at `docs/prd-readability.md`. | Lives with the code and the build; ships in the same PR as the edits |
| D9 | **Register boundary:** plain in description + card + a page-opening TL;DR; technical from `Данные и метод` onward. | Gives the recruiter an exit ramp without diluting the method |
| D10 | **Jargon policy:** keep hiring keywords (`A/B-тест`, `retention`, `SQL`, `Python`, `LTV`); gloss or move exotics (`CUPED`, `mSPRT`, AUUC/Qini, `ship-gate`, Bonferroni). | Keywords carry SEO and recruiter recognition; exotics are noise in a 72-char window |
| D11 | **Skeleton:** RU `Контекст → Гипотеза (опц.) → Данные и метод → Что нашли (опц.) → Эффект → Документация`; EN `Context → Hypothesis (opt.) → Data & Method → Findings (opt.) → Impact → Documentation`. The four core sections are required; `Гипотеза` and `Что нашли` appear only when the project has that content. | Five slots cover every current body; existing one-off sections fold under `Данные и метод`. English headings leave Russian bodies. `Что нашли` is optional because toolkit/demo projects (`ab`, `games`, `sales-calls`) carry their results inside `Данные и метод` + `Эффект` and a separate findings section would duplicate them. **Amended 2026-09-20** by `docs/prd-volta-structure.md` (D11): `volta-parts` use the **dossier skeleton** instead — RU `Контекст → Данные и метод → Выводы → Рекомендации → Документация`; EN `Context → Data & Method → Findings → Recommendations → Documentation`. The 22 pre-existing parts were already 100% uniform on it; renaming 66 headings to satisfy the project skeleton had no reader benefit. **Amended 2026-09-26:** the skeleton becomes **STAR** — RU `Ситуация → Задача → Действия → Результат → Ограничения → Документация`, EN `Situation → Task → Actions → Result → Limitations → Documentation` (`Obsidian/Z-core/STAR method.md`). `volta-parts` use the same skeleton plus a retained `Рекомендации` / `Recommendations`; the `volta` hub keeps its own D10 order. Applied to 80 content files; bound by `tests/lib/content-skeleton.test.ts` |
| D12 | **Description spec:** 1–2 sentences, result + number first, 120–200 chars, first 72 self-contained. | Satisfies all six consumers in §1.2 at once |
| D13 | **RU and EN descriptions authored independently** (meaning parity, not a word-for-word translation). | Literal translations of a 12-character-budgeted line read as machine output |
| D14 | **`volta` TL;DR** heading `## Итог в 30 секундах` (EN `## The 30-second version`), 4 bullets, existing numbers only. | Gives the flagship a scannable entry without losing its narrative |
| D15 | **Posts:** rename only the **links** section (`## Ресурсы` → `## Ссылки`; `## Результат` → `## Выводы`); keep `## Выводы`/`## Заключение` as conclusions; add `## Кратко` to the 3 posts lacking it; split paragraphs >500 chars. | "Conclude" and "reference" are different sections; a single rename would erase conclusions |
| D16 | **Project prose gets the `65ch` measure** (currently `.container 800px`). One rule only. | Consistency with posts; the only typographic change in scope |
| D17 | **PRD path `docs/prd-readability.md`**, matching the lowercase `prd-*` family. | Consistent with `docs/prd.md` … `docs/prd-v6.md` |
| D18 | **Drift audit is a standalone script, not wired into `make check`.** `scripts/content-drift-audit.mjs` + `bun run audit:content`; baseline committed; run manually at Phase 0 and after every phase. | Wiring it into `make check` would fail CI on every legitimate content PR; the audit's job is to gate a rewrite, not every edit |
| D19 | **After execution, document the skeleton convention in `CLAUDE.md`** (and `CONTEXT.md` if terminology is affected). | A convention nobody can look up will drift back |
| D20 | **The drift audit excludes the `description:` field.** Bodies, `impact`, `caseStudy`, `faq`, titles and `excerpt` stay frozen. | Phase 1 rewrites descriptions to D12's result-first 120–200-char spec, which necessarily changes which narrative numbers appear there. Freezing the field would forbid the very edit D12 mandates. Consistency between a description's numbers and the frozen body numbers is checked manually |

---

## 5. Work plan

### Phase 0 — Baseline and guard

#### S0.1 — Write `scripts/content-drift-audit.mjs`

Standalone Node ESM script (repo convention: `scripts/*.mjs`). Extracts every numeric token from
`src/content/**/*.md` (fenced code blocks stripped, `description:` excluded per D20, markdown
ordered-list markers stripped as formatting, thousands separators and intra-number spaces
normalized), and compares against a committed baseline.

- `bun run audit:content:snapshot` → writes `docs/content-baseline.json`
- `bun run audit:content` → diffs current content against the baseline; **exit 1** on any added or
  removed numeric token, printing the per-file deltas

**Acceptance:** script exists; `bun run audit:content:snapshot` produces `docs/content-baseline.json`;
a second `bun run audit:content` exits 0; a changed body number flips it to exit 1 while a changed
`description` does not.

#### S0.2 — Capture the baseline

Run `bun run audit:content:snapshot` on the **unmodified** content. Commit `docs/content-baseline.json`.

**Acceptance:** baseline file committed before any content edit; `git log` shows it precedes the first
content change.

---

### Phase 1 — Descriptions (all 42 project/volta-part files, both languages)

Rewrite `description:` in all 17 RU + 17 EN projects and 4 RU + 4 EN volta-parts to D12's spec.

Order suggestion: `volta` first (flagship, sets the pattern), then the 16, then volta-parts.

**Acceptance:**
- Every RU file's `description` contains Cyrillic characters; every EN file's does not `[V]`
- Every description is 120–200 characters `[V]`
- The first 72 characters carry the outcome and at least one number where the project has one — **manual**
- `bun run audit:content` exits 0 (no metric lost from frontmatter)
- `bun run build && bun run check` green

---

### Phase 2 — Project bodies (structure + density)

Apply D11's skeleton to the 16 non-volta projects and all volta-parts (RU + EN). Fold the existing
one-off sections into `Данные и метод`. Break the D4/P4 dense blocks. Add `volta`'s TL;DR (D14). Fix P5
in the same pass (D7).

**Order suggestion:** one project end-to-end (RU+EN) as a template, get it reviewed, then the rest.

**Acceptance:**
- Every non-volta project body's H2 set is an in-order subset of `Контекст → Гипотеза? → Данные и метод → Что нашли? → Эффект → Документация` (the four core sections required; `Гипотеза` and `Что нашли` present only where the project has that content); `volta` keeps its narrative plus the TL;DR `[V]`
- No project body contains a paragraph over ~500 characters `[V]`
- `rg "Business Context|Data & Method|Insight|Impact>" src/content/projects src/content/volta-parts`
  returns **no English headings inside RU files** `[V]`
- No `related:` or body link in `src/content/projects-en/**` points at a `/posts/` or `/projects/` RU
  route — all EN links resolve under `/en/` `[V]`
- RU/EN frontmatter parity for `caseStudy` and `demo` on `bot`, `sql`, `volta`, `cohort`, `rfm` `[V]`
- Project prose renders at a `65ch` measure `[V]`
- `bun run audit:content` exits 0; `bun run build && bun run check` green

> **Superseded 2026-09-26:** the skeleton named in the first bullet above (and the `rg` pattern in the third) was replaced by **STAR** — see the D11 amendment and §10. The remaining bullets still hold.

---

### Phase 3 — Posts

Apply D15 to the 24 RU posts (and the 2 EN posts for the closing-section name, which already use
`Links` — no change expected there).

**Acceptance:**
- `## Ресурсы` absent; `## Ссылки` used for link lists; `## Выводы`/`## Заключение` retained as
  conclusions; `telegram-reporting-bot` closes with `## Выводы` `[V]`
- `## Кратко` present in `bayesian-ab-testing`, `data-analyst-portfolio-checklist`,
  `telegram-reporting-bot` `[V]`
- No post paragraph exceeds ~500 characters `[V]`
- `cohort-retention-guide`'s manual `## Содержание` matches its current headings `[V]`
- `bun run audit:content` exits 0; `bun run build && make check` green

---

### Phase 4 — Document the convention

Add the skeleton and description spec to `CLAUDE.md` under the content-collections section. Update
`CONTEXT.md` only if a term changed.

**Acceptance:** `CLAUDE.md` states the skeleton, the description spec, and the drift-audit command.

---

## 6. Acceptance metrics

| Metric | Baseline | Target |
|---|---|---|
| G1 — off-language descriptions | 18 (14 projects + 4 volta-parts) | **0** |
| G2 — descriptions outside 120–200 chars | 42 (unbounded) | **0** |
| G3 — distinct skeletons (non-volta) | 9 | **1** |
| G4 — posts with a prose paragraph >500 chars (lists/code/tables excluded) | 4 | **0** |
| G4 — posts missing `## Кратко` | 3 | **0** |
| G4 — distinct names for the links section | 3 (`Ссылки`/`Ресурсы`/`Ссылки`-via-`Результат`) | **1** |
| G5 — numeric drift | n/a | **0** (`audit:content` green) |
| G6 — EN files linking RU routes | 6 | **0** |
| G6 — RU/EN parity gaps on `caseStudy`/`demo` | 5 | **0** |

---

## 7. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | A rewrite silently changes a metric | Phase 0 drift guard; `audit:content` runs after every phase |
| R2 | Result-first descriptions drop SEO keywords | D10 keeps hiring keywords; verify meta is still keyword-dense |
| R3 | Skeleton flattens a project whose structure carried meaning (`volta`, `games`) | `volta` is exempt; one-off sections fold *under* `Данные и метод`, not deleted |
| R4 | 42-file sweep drifts between RU and EN | Parity check is an explicit acceptance criterion per phase |
| R5 | Description rewrite breaks OG images generated from text | `bun run build` + `make check` after Phase 1; OG generator reads title/hero, verify |
| R6 | The audit's numeric regex over- or under-captures | Under-capture is the real risk; regex is deliberately greedy and strips only fenced code. False positives are acceptable and human-reviewed |
| R7 | This PRD becomes stale after execution | Phase 4 documents the convention; the PRD is dated and scoped |
| R8 | Editing `site.md` changes the description of this very site | Expected; treated as one of the 17 |

---

## 8. PENDING — needs the owner

| Item | Why it waits |
|---|---|
| First-72-char legibility judgement for each description | Mechanical length is checkable; "does this hook a recruiter" is not |
| Sign-off on the template project after Phase 2's first file | Sets the pattern for the remaining 15 |
| Whether `CONTEXT.md` needs a terminology update (Phase 4) | Depends on whether the rewrite introduces or retires a term |
| External deep links to the retired heading anchors (`#данные-и-метод` → `#действия`, `#выводы` → `#результат`, `#context` → `#situation`) | Heading anchors are derived from the heading text, so the STAR amendment changes every fragment URL. The repo holds no hardcoded anchors (checked: `InnerTOC.astro` slugifies the live DOM at runtime, nothing links to a `#` fragment in content); only off-site links are affected — the owner decides whether to add redirects |

---

## 9. Appendix — file inventory

### `src/content/projects/**` (17 RU + 17 EN, same slug list)

`ab`, `bot`, `causal`, `churn`, `cohort`, `games`, `garden`, `posthog`, `python`, `rfm`, `sales-calls`,
`scrolly`, `site`, `sql`, `streamlit`, `supabase`, `volta`.

Skeleton applies to all except `volta` (D6).

### `src/content/volta-parts/**` (4 RU + 4 EN)

`ab`, `funnel`, `retention`, `segmentation`.

### `src/content/posts/**` (24 RU)

`ab-calibration-simulation`, `analyst-interview-cases`, `analyst-proactivity`, `bayesian-ab-testing`,
`churn-uplift-discount`, `cohort-retention-guide`, `cohort-triangles-retention`,
`dashboards-that-dont-lie`, `data-analyst-portfolio-checklist`, `eda-python-template`,
`feature-impact-analysis`, `first-value-moment-activation`, `github-actions-automation`,
`north-star-metric-conflicts`, `payment-failures-revenue`, `product-analyst-collaboration`,
`reproducible-data-pipelines`, `rfm-segmentation-practical`, `sql-window-functions`,
`streamlit-dashboard-prototype`, `telegram-reporting-bot`, `unit-economics-ltv`,
`user-journey-path-analysis`, `volta-neobank-case-study`.

### `src/content/posts-en/**` (2 EN)

`ab-calibration-simulation`, `cohort-triangles-retention`.

### Code touched

| File | Change |
|---|---|
| `src/styles/global.css` | project prose `65ch` measure (D16) |
| `CLAUDE.md` | document skeleton + description spec + audit command (Phase 4) |
| `CONTEXT.md` | only if terminology changes (Phase 4) |
| `docs/content-baseline.json` | created by S0.2 |
| `package.json` | `audit:content`, `audit:content:snapshot` scripts (S0.1) |

### Verified facts this document relies on

Paths: `src/content.config.ts` (schemas), `src/components/ProjectCard.astro:41`,
`src/components/MaterialStrip.astro:51,72`, `src/components/CaseStudy.astro`,
`src/pages/projects/[slug].astro:69,114`, `src/layouts/Base.astro:91,124,131`,
`src/styles/blog.css:212`, `src/components/InnerTOC.astro`.

---

## 10. Execution log (2026-09-18)

| Phase | Result |
|---|---|
| 0 | `docs/prd-readability.md`, `scripts/content-drift-audit.mjs`, `docs/content-baseline.json` created; `audit:content` / `audit:content:snapshot` wired in `package.json`. Two scope refinements recorded: `description:` excluded from the frozen set (D20); markdown ordered-list markers stripped as formatting. |
| 1 | All **42** descriptions (17+17 projects, 4+4 volta-parts) rewritten to the 120–200-char result-first spec — verified on-language (RU Cyrillic / EN Latin) and in range; frontmatter diff limited to the `description:` line. |
| 2 | **16** projects + **8** volta-parts moved to the shared skeleton; `volta` kept its narrative and gained the `Итог в 30 секундах` / `The 30-second version` TL;DR; all RU English headings removed; no prose paragraph >500 chars. Incidental (D7): 9 EN files with `/en/`-prefixed `related:` fixed to the locale-neutral form; RU/EN `caseStudy`/`demo` parity restored for `bot`, `sql`, `volta`, `cohort`, `rfm`; the 4 `volta` body links made relative (they were missing the base path and pointed at RU routes). |
| 3 | Links section normalised (`## Ресурсы` → `## Ссылки` incl. the manual TOC; `## Результат` → `## Выводы`); `## Кратко` added to `bayesian-ab-testing`, `data-analyst-portfolio-checklist`, `telegram-reporting-bot`; every post prose paragraph >500 chars split — **0** remain. |
| 4 | Skeleton, description spec, frozen-numbers rule and the `related:` convention documented in `CLAUDE.md`. |
| 5 | **Done 2026-09-26 — STAR amendment.** All **80** content files moved to STAR: 17 RU + 17 EN projects (including both `volta` hubs) and 23 RU + 23 EN volta-parts. Rename map: `Задача`→`Ситуация` / `Goal`→`Situation` (projects), `Контекст`→`Ситуация` / `Context`→`Situation` (parts); `Данные и метод`→`Действия` / `Data & Method`→`Actions`; `Выводы`→`Результат` / `Findings`→`Result`. A new `## Задача` / `## Task` was authored in every one of the 80 (1–2 sentences, first person, goal + ownership, no digits). Docs updated: `CLAUDE.md`, `README.md`, `docs/prd-volta-structure.md` D10/D11. Mechanism: `tests/lib/content-skeleton.test.ts` (10 tests) — **proven to fail** on an off-skeleton heading and on a digit inside `Задача`. |

**Verification:** `bun run audit:content` exits 0; `bun run build` → 98 pages; `bun run check` → 0 errors/warnings; G3 skeleton (in-order subset) 0 failures; G4 (Кратко, links naming, prose >500) pass; G6 `related:`/parity pass.

**Baseline re-snapshots (intentional, per D20):** `volta` TL;DR repeats existing numbers plus the heading token `30`; EN `bot`/`sql` gained their RU-parity `caseStudy` numbers. No file lost a numeric token at any point.

**STAR amendment (2026-09-26) verification:** `bun test tests/lib` 220 pass / 0 fail; `bun run check` 0 errors (126 files); `bun run build` 135 pages; `bun run audit:content` no drift. The baseline was **already red at HEAD** before this work — pre-existing `updated:` drift in `site`, `rfm` and `ab` (+ EN twins), introduced by `sync:gh:apply` and committed without re-snapshotting. It was re-snapshotted first (11 lines), so the green run above measures the STAR edits, not that repair.

