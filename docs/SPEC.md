# Spec: Personal Portfolio — NikitaBoyarkin.github.io

> Status: **approved (Phase 1 — Specify, 2026-09-20)**. This document is the shared source of
> truth for the project. It describes what the site is, how it is built, how it is verified,
> and what an agent must not break.
>
> Companion documents: `CLAUDE.md` (agent operating guide), `CONTEXT.md` (domain
> glossary), `DESIGN.md` (visual system), `docs/prd-v*.md` (historical PRDs),
> `docs/adr/` (architecture decisions).

## Objective

A **bilingual (RU/EN) static portfolio site** for Nikita Boyarkin, a Data / Product
Analyst (career change from work psychology, PhD). Published as a user GitHub Pages site
at `https://nikitaboyarkin.github.io/` — served from the domain root, no `base` path.

**Primary purpose:** convert recruiters and hiring managers into **contact initiations**,
then move them through the hiring funnel to an offer. The means is quantified proof of
work: real (or reproducible synthetic) analytics case studies, not skill badges.

**Primary audience:** hiring managers and product/analytics leads evaluating a
product-analyst candidate.

**Positioning:** "an experienced analyst with product taste and technical depth" — the
career-change narrative (psychology → analytics) is stated honestly, with experience
backed by CV sections, not asserted in a summary line.

**North Star metric:** recruiter / hiring-manager contacts per month. Two-tier:
`contact` (leading, tracked manually in `docs/contact-log.md`) and `final` / `offer`
(lagging, absolute count). Site click events (`cv_download_pdf`, `github_footer`,
`linkedin_footer`, …) are leading **click** signals, not contact outcomes.

**Traffic gate:** ≥100 unique visits / 90 days. Below it, conversion metrics are
track-only — monitored but not decision-gating.

## Tech Stack

| Layer | Choice | Version / note |
|---|---|---|
| Framework | Astro | `^7.2.9`, `output: "static"`, `build.format: "directory"` |
| Language | TypeScript | `astro/tsconfigs/strict`; tests extend it via `tsconfig.tests.json` |
| Runtime / PKG / tests | Bun | `bun.lock` is the lockfile; `bun test` (bun:test) |
| Content | Astro content collections | Markdown + Zod schemas in `src/content.config.ts` |
| i18n | Astro i18n | `defaultLocale: "ru"`, `locales: ["ru","en"]`, no prefix for default |
| Analytics | PostHog JS | `posthog-js`, inert unless `PUBLIC_POSTHOG_KEY` is set at build |
| UI libs | morphicons, @paper-design/shaders, @oneworks/avatar (patched) | see `patchedDependencies` |
| Build extras | @astrojs/sitemap, @astrojs/rss | sitemap + `rss.xml` |
| Dev / QA | playwright, jsdom, happy-dom, sharp, pngjs | `tests/preload.ts` registers happy-dom |
| Build validation | Python 3 | `scripts/check_site.py` (links, pages, assets in `dist/`) |
| Perf / a11y gate | Lighthouse CI | `bunx @lhci/cli autorun`, config `.lighthouserc.json` |

## Commands

Full commands, from `package.json` and the `Makefile`:

```bash
# Setup
bun install
bun install --frozen-lockfile        # CI (lockfile must not change)

# Dev loop
bun run dev                          # astro dev → http://localhost:4321
bun run build                        # static build → dist/
bun run preview                      # preview the build (LHCI starts this)
bun run serve-dist                   # serve dist/ via Bun.serve

# Correctness gates
bun test                             # lib unit tests (bun:test) — run before commit
bun run coverage                     # coverage report
bun run check                        # astro check + tsc --noEmit -p tsconfig.tests.json
make check                           # python3 scripts/check_site.py   (validates dist/ — build first)

# Content / data invariants
bun run audit:content                # diff every numeric token vs docs/content-baseline.json (exit 1 on drift)
bun run audit:content:snapshot       # accept an intentional numeric change (rewrites the baseline)
bun run volta:map                    # regenerate the Volta hub project map
bun run verify:writing-filter        # Post category taxonomy check

# OG / banner generation
bun run og                           # per-post OG cards
bun run og:home / og:graph           # homepage identity + graph banners
bun run og:cv / og:cv:li / og:cv:cover

# Sync (needs a GitHub token)
bun run sync:gh                      # check drift (exit 1 on hard drift) — runs in CI
bun run sync:gh:apply                # write updated: / private: back to frontmatter
bun run sync:activity                # refresh src/data/github-activity.json

# CV (source of truth is a sibling repo)
bun run cv:pdf                       # copy ../cv/rendercv_output/… → public/CV-Nikita-Boyarkin.pdf

# Lighthouse
bunx @lhci/cli autorun              # uses .lighthouserc.json thresholds
```

## Project Structure

```text
astro.config.mjs        # site, i18n, redirects, sitemap — no base path
CLAUDE.md / CONTEXT.md  # agent guide / domain glossary
DESIGN.md / docs/       # visual system / PRDs, ADRs, baselines, contact log
public/                 # copied as-is: images, og/, fonts/, CV PDF, favicons
src/
  content.config.ts     # Zod schemas: projects(-en), volta-parts(-en), posts(-en)
  content/              # authored Markdown (RU is canonical; EN mirrors)
  components/           # .astro components; charts/ holds chart primitives
  layouts/              # Base.astro (nav, meta, theme, PostHog), Post.astro
  pages/                # RU routes; en/ mirrors the translatable ones
  styles/               # global.css (design tokens + light/dark/cyberpunk), blog.css
  lib/                  # framework-free TS: metrics, brand, path, graph, charts, topics…
  data/                 # generated data (github-activity.json, charts/*.json)
scripts/                # node .mjs generators + python validators + vendored OG fonts
tests/lib/              # bun:test unit + drift-guard tests
tests/preload.ts        # registers happy-dom for the bun test run
.github/workflows/      # deploy.yml, sync-github.yml, github-activity.yml
.claude/hooks/          # contrast-gate.js, portfolio-category-guard.js
```

## Code Style

The repo favors small, framework-free logic in `src/lib/` with unit tests, and thin
`.astro` components that render it. One real snippet beats a paragraph:

```ts
// src/lib/brand.ts — single source of truth; consumers import, never re-declare.
export const BRAND_BLUE: BrandHex = '#1400c3';

/** SVG `points` for a pointy-top hexagon, centred at (cx, cy) with radius r. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const dx = (r * Math.sqrt(3)) / 2;
  return [[cx, cy - r], /* ... */].map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');
}
```

```astro
---
// src/components/CaseStudy.astro — typed props, locale branch, scoped styles.
interface Props { problem: string; approach: string; result: string; metrics?: Metric[]; lang?: 'ru' | 'en'; }
const { problem, approach, result, metrics = [], lang = 'ru' } = Astro.props;
---
<section class="case-study">…</section>
<style>
  .case-study { background: var(--background-secondary); border-radius: var(--radius-lg); }
</style>
```

Conventions:

- **Logics-first, components-thin.** Put testable behaviour in `src/lib/*.ts`; keep `.astro`
  files declarative. Every non-trivial lib module has a matching `tests/lib/*.test.ts`.
- **Single source of truth.** `src/lib/metrics.ts` owns headline numbers; `src/lib/brand.ts`
  owns colours/geometry; `src/content.config.ts` owns schemas; `docs/content-baseline.json`
  owns frozen numeric tokens. Never duplicate a value these own.
- **Internal links go through `withBase()`** (`src/lib/path.ts`). Never hardcode a URL or
  image path in a component.
- **No raw hex** outside `src/lib/brand.ts` (documented scoped exceptions: `theme-color`
  meta, `graph.ts` dataviz palette, `/cv` print styles — see `DESIGN.md`).
- **Styling:** scoped `<style>` blocks using design tokens (`var(--space-*, --radius-*,
  --text-*, --background-*, --border-*)`); no inline style attributes for themeable values.
- **i18n:** every user-facing string branches on `lang`/`isEn`; RU is canonical, EN is an
  independently authored mirror (meaning parity, not literal translation).
- **Comments explain why, not what.** Match the surrounding density — the codebase is
  deliberately commented where a decision is non-obvious.
- **Formatting:** 2-space indent, semicolons, single quotes in `src/**/*.ts`, double quotes
  in `.astro`/`.mjs`. Match the file you are editing.

## Testing Strategy

| Level | Tool | Location | Purpose |
|---|---|---|---|
| Unit / logic | `bun test` (bun:test) | `tests/lib/*.test.ts` | pure functions: graph, charts, metrics, dates, topics, fuzzy, theme |
| Drift guards | `bun test` | `tests/lib/metrics.test.ts`, `brand.test.ts`, `qa-corpus.test.ts` | fail when a source-of-truth value diverges from disk reality |
| Type-check | `astro check` + `tsc` | whole repo | `bun run check` |
| DOM / component | jsdom / happy-dom | `tests/preload.ts` (registered globally) | DOM-dependent logic |
| Integration (built site) | Python 3 | `scripts/check_site.py` (`make check`) | required pages exist, all internal links resolve, referenced images exist |
| Manual / scripted browser checks | Playwright | `scripts/mobile-*.mjs`, `audit-palette-coverage.mjs`, `verify-writing-filter.mjs` | mobile layout screenshots, scroll/kanban checks, palette-coverage audit (there is **no** Playwright test suite under `tests/`) |
| Perf / a11y | Lighthouse CI | `.lighthouserc.json` | perf warn ≥0.85; a11y / best-practices / seo **error** ≥0.95 |

Coverage: available via `bun run coverage`; no hard numeric threshold is enforced. The
**de-facto gate is the drift-guard suite** — a value on the site must equal its real
artifact (a file count, a CV figure, a token in `global.css`). Add a guard whenever you add
a derived claim.

Run order before committing: `bun run build` → `bun test` → `bun run check` → `make check`.

## Boundaries

### Always do

- Run `bun run build`, `bun test`, `bun run check`, and `make check` before committing.
- Keep RU + EN twins in sync (`projects`/`projects-en`, `volta-parts`/`volta-parts-en`,
  `posts`/`posts-en`) and wire `counterpartHref` on both sides when adding a page.
- Use `withBase()` for every internal link / asset path.
- Update `src/lib/metrics.ts` and its comment when a guarded count changes; run
  `bun run volta:map` after adding/renaming a Volta part.
- Put new headline numbers in `src/lib/metrics.ts`, not in a component.
- Prefer `bun run audit:content` to *detect* numeric drift; accept changes only via
  `bun run audit:content:snapshot` when the change is intentional.

### Ask first

- Adding a dependency, or touching `patchedDependencies` / the `patches/` folder.
- Changing `src/content.config.ts` schemas, `astro.config.mjs` (redirects, i18n, `base`).
- Changing brand tokens, LHCI thresholds, nav information architecture, or route paths.
- Adding a new project or post (touches multiple files + the content baseline).
- Any change to `.github/workflows/` or `.claude/hooks/`.

### Never do

- Commit secrets. `.env` holds `PUBLIC_POSTHOG_KEY`/`PUBLIC_POSTHOG_HOST` — never commit it;
  never log the key.
- Re-author or reintroduce a hand-written `/cv/` page — the rendercv YAML in the sibling
  `../cv/` repo is the only CV source; the site ships `public/CV-Nikita-Boyarkin.pdf`.
- Introduce raw brand hexes outside `src/lib/brand.ts` (except the documented scoped
  exceptions).
- Break a drift guard to make a test pass — fix the artifact or the source-of-truth value.
- Convert internal links to absolute URLs, or bypass `withBase()`.
- Push to `master`/`main` without the Pages workflow confirmed enabled
  (`Settings → Pages → Build and deployment → GitHub Actions`).

## Success Criteria

This project is "done" for a change when all of the following hold:

1. `bun run build` succeeds and emits the expected pages to `dist/`.
2. `bun test` is green (all `tests/lib` suites, including drift guards).
3. `bun run check` passes (Astro + tests type-check clean).
4. `make check` passes (built-site links, pages, and assets validate).
5. Lighthouse gate holds: accessibility, best-practices, and SEO ≥0.95; performance ≥0.85.
6. RU and EN remain in parity for any content/page added or changed.
7. No new raw brand hex, no hardcoded internal URL, no duplicated source-of-truth value.
8. `bun run audit:content` reports no unexpected numeric drift (intentional changes
   snapshotted and noted).

## Assumptions I'm making

1. This spec describes the **whole site** as it exists today (onboarding), not a new
   feature. It should be updated, not replaced, when behaviour changes.
2. `CLAUDE.md`, `CONTEXT.md`, `DESIGN.md`, and the PRDs remain authoritative where they
   go deeper; this spec is the entry point and links out rather than duplicating them.
3. `src/` is the only mutable surface for site behaviour; `dist/`, `.astro/`, `.lighthouseci/`,
   `lhci-reports/`, and `src/graphify-out/` are generated and out of scope.
4. The spec belongs in version control under `docs/`, consistent with the existing PRD/ADR
   layout.

## Open Questions

1. **Stale source-of-truth value (live red test).** `src/lib/metrics.ts:43` says
   `sqlCases: 25`, but the sibling `../sql-analytics-case-study/cases/` holds **26** `.sql`
   files (`26_realdata_repeat_concentration.sql`, added 2026-09-19), so
   `tests/lib/metrics.test.ts:37` fails. Verified: **the site copy is already correct** —
   `src/content/projects/sql.md` and its EN twin describe "26 SQL cases: 25 synthetic + 1
   real-data", and only `metrics.ts` is stale. Fix = bump `sqlCases` to 26 and its comment
   (site copy needs no change). Ask-first only because it is a source-of-truth edit.
2. **`CapabilitiesGrid.astro` is dead code and its doc is stale.** Verified: `docs/adr/0001`
   (status `accepted`) + `CONTEXT.md` say the grid was removed from the homepage; the
   component has **no imports** (the only hit is a stale comment in `src/lib/metrics.ts:2`);
   `DESIGN.md` line 94 ("CapabilitiesGrid remains…") is the stale claim. Options: delete the
   orphan component and correct `DESIGN.md` + the `metrics.ts` comment, or leave both. Deleting
   is a code change → ask first.
3. **`value` / `whois` IA — resolved, confirm anyway.** Verified: no `whois.astro` page exists
   (`/whois/` is a redirect-only legacy collapse into `/about/#who`), and `src/pages/value.astro`
   is live with a nav entry. The current nav set (Projects / About / **Value** / Notes) is
   therefore internally consistent — no stale redirect found. Flagging only to confirm it is
   the intended final IA.
4. **Coverage threshold.** Do we want to pin a minimum coverage number for `src/lib/`, and if
   so, what value?
5. **Spec scope drift.** Should future feature work append dated sections here, or continue as
   standalone `docs/prd-*.md` documents that link back to this spec?
6. **Remaining homepage-orphan components (deferred).** Beyond `CapabilitiesGrid` (Open Q2), four
   more components have zero imports and no route: `Manifesto`, `TopicMap`, `ProjectTimeline`,
   `CollaborationFormats`. (`HomeBoard`, `Testimonials`, `AudienceBar` are already deleted;
   `AskMe` and `MaterialStrip` are live.) Deferred out of the Q2 cleanup by decision 2026-09-20 —
   decide in a later pass whether to sweep them.
