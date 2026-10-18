# PRD — Analytics Instrumentation (PostHog Data Collection)

| Field | Value |
|---|---|
| Status | Draft — ready for execution |
| Date | 2026-09-19 |
| Owner | Nikita Boyarkin |
| Scope | PostHog data collection only: main site (`src/**`) + static games arcade (`public/games/**`) + PostHog project settings/artifacts. No visual redesign, no content rewrite, no new product surface. |
| Relates to | `docs/prd-v6.md` (signal consolidation), `docs/analytics-review.md` (weekly review ritual), `docs/cta-inventory.md` (CTA→event inventory). This PRD supersedes none of them; it reconciles their stale parts. |
| Trigger | Explicit request: "improve data collection with PostHog" — the funnel that must be measurable (visit → project/case study → CV → contact) is only partially instrumented. |
| Deliverable | This document, then phased code + PostHog changes with mechanical acceptance checks. |

---

## 0. How to read this document

This is an **execution PRD**. Its job is to turn the instrumentation decisions taken on 2026-09-19 into
work with verifiable acceptance criteria.

Four rules apply:

1. **Evidence classes are marked.** `[V]` verified by direct read of a file or a live PostHog query ·
   `[I]` inferred from verified evidence · `[NV]` not verified. Never upgrade `[I]` to `[V]` in a report.
2. **Every task carries an acceptance criterion that fails when the task is not done.** If a task
   cannot be checked mechanically, it says so explicitly.
3. **Existing event names are frozen.** Historical PostHog data and the saved insights listed in §1.4
   depend on them. This PRD adds and canonicalizes; it does not rename anything that already has data.
   The only exceptions are events that provably never fire (§2.1, §4.4).
4. **Collection, not reporting.** The output is trustworthy data plus a reconciled set of saved
   artifacts. New product features (flag-gated experiments, surveys) are out of scope (§11).

### Precondition — capture the baseline first

**Task A0.1 must run before any other task.** Without a baseline snapshot of the current events and
funnel conversion, none of the goals in §3 can be evaluated and no change can be attributed.

---

## 1. Context

### 1.1 Current state — main site `[V]`

PostHog is loaded as a bundled `posthog-js` module (not the CDN snippet) from
`src/components/Analytics.astro`, mounted in `<head>` via `src/layouts/Base.astro:431`.
The whole component is inert when `PUBLIC_POSTHOG_KEY` is unset (`Analytics.astro:20`).

Init config, verbatim (`Analytics.astro:93-101`):

```js
posthog.init(import.meta.env.PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2026-05-30',
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: true,
  session_recording: { maskAllInputs: true },
});
```

Local development is guarded (`Analytics.astro:25-30`): requests from `localhost` / `127.0.0.1` /
`::1` / `0.0.0.0` never init. The browser reports an IPv6 loopback hostname in brackets
(`[::1]`), so the guard matches that form too. The SDK is handed to the canonical module via
`attachPosthog(posthog)` at `Analytics.astro:105`; components other than `Analytics.astro` call
`track()` from `src/lib/analytics.ts` rather than reaching for the global.

Project token and host come from build-time env: `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`
(`.env.example:5-9`); in CI they are repo secrets (`.github/workflows/deploy.yml:144-146`). The build
also injects them into the games drift check (`deploy.yml:94`).

### 1.2 Current state — games arcade `[V]`

`public/games/` is served verbatim (not processed by Astro). Each of 10 SVG games plus the hub
(`public/games/index.html`) embeds its own inline copy of the PostHog CDN loader, with the production
token **hardcoded in 11 files** — deliberate, see REQ-A12. Until 2026-10-18 the games init omitted
`defaults`, `session_recording` and `persistence`; it now mirrors the site:

```js
window.posthog.init(PH_KEY, {
  api_host: PH_HOST,
  defaults: '2026-05-30',
  persistence: 'localStorage+cookie',
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: true,
  capture_exceptions: true,
  session_recording: { maskAllInputs: true },
});
```

Two differences from the site remain, both accepted: the games still load `array.js` from
`us-assets.i.posthog.com` (the site bundles `posthog-js`), so games pages pay a third-party
request; and `persistence: 'localStorage+cookie'` sets the first-party `ph_<token>_posthog` cookie for
365 days — the same posture as the main site, which §11 keeps deliberately. Game state is unaffected
either way: streaks and best scores use the games' own `lsGet`/`lsSet` helpers, not PostHog persistence.

Note on severity `[V]`: PostHog masks session-replay inputs by default
(<https://posthog.com/docs/session-replay/privacy> — "As any input element is highly likely to contain
sensitive text, we mask these by default"). The games config was therefore a **parity and hygiene**
problem, not a live privacy breach. The stricter `persistence: 'memory'` option was considered and
rejected on 2026-10-18 (see §5.12) in favour of site parity, so games and site share one attribution
posture.

### 1.3 Current state — PostHog project `[V]`

Live query of `system.information_schema` / event schema on 2026-09-19:

| Fact | Value |
|---|---|
| Project | `451732` (org `NBxHive`), host `us.posthog.com` |
| Products enabled | session replay, heatmaps |
| Error tracking | **not enabled** — no `$exception` events in the schema |
| `$web_vitals` | flowing (LCP/INP/CLS/FCP spread across events) |
| `$rageclick` | observed |
| Auto-captured attribution | `utm_source`/`utm_medium`/`utm_campaign` captured on `$pageview` (`analytics-review.md:31`) |
| Deploy isolation | deploy runs only `if: github.event_name == 'push'` (`deploy.yml:53,88`) — PR/preview traffic never reaches production, so no preview pollution problem exists `[V]` |

### 1.4 Current state — saved artifacts `[V]`

Dashboards — **13 non-deleted** on 2026-10-18 (`system.dashboards`), seven deleted:

| id | Name | Tiles | Note |
|---|---|---|---|
| `2226417` | 02 · Воронка: визит → проект → контакт | 6 | `DASHBOARDS_V2` |
| `2226420` | 03 · Проекты и контент | 9 | `DASHBOARDS_V2` |
| `2226421` | 04 · Персоны и CTA | 8 | `DASHBOARDS_V2` |
| `2226422` | 05 · Здоровье аналитики | 7 | `DASHBOARDS_V2` |
| `2226427` | 01 · Трафик и источники | 8 | `DASHBOARDS_V2` |
| `1994322` | Рекрутер | 3 | legacy; hosts `zlXsA98W` |
| `2024833` | Портфолио — аналитика | 5 | still `primary_dashboard` |
| `2128846` | LLM — расход и токены | 4 | |
| `2142402` | Контент и вовлечение | 6 | legacy; restates V2 `03` |
| `2142403` | RU vs EN | 4 | legacy; restates V2 `04` |
| `2142404` | Контакт-конверсия 30д | 4 | legacy; restates V2 `02` |
| `2142405` | Games | 4 | legacy |
| `2226380` | AI observability default | 9 | auto-created by PostHog 2026-10-18 |

Deleted: `1660826` (My App Dashboard), `1994271`, `1994281`, `1994283`, `1994296`, `1994298`,
`1994304`. The four legacy `2142402`–`2142405` dashboards are deletion candidates.

Funnels and key insights:

| id | short_id | Name |
|---|---|---|
| `11919159` | `j35OMv7Z` | Portfolio funnel: Visit → Project → Contact |
| `11015002` | `zlXsA98W` | Funnel: рекрутер → контакт |
| `11498265` | `nh91WEuw` | GitHub profile → portfolio: pageviews by section (utm_campaign) |
| `11015004` | `paamYLb5` | Откуда пришли |
| `11444467` | `RuErUFto` | Top posts — post_read |
| `11444441` | `jCtk3Yl7` | Top projects — project_viewed |
| `11272834` | `QPtsvkv1` | Portfolio Funnel: Shuffle → View → Read → Theme (tutorial artifact) |

### 1.5 What is actually emitted today `[V]`

Explicit `posthog.capture()` calls:

| Event | Properties | Where |
|---|---|---|
| `project_viewed` | `{slug, locale}` | `Analytics.astro:61` |
| `post_read` | `{slug, locale}` | `Analytics.astro:68` |
| `${page}_viewed` → `whois_viewed` / `value_viewed` / `work-with-me_viewed` | `{locale}` | `Analytics.astro:76` |
| `case_study_read` | `{slug, locale}` at ≥75% scroll | `Analytics.astro:97` |
| `lang_switched` | `{from, to, path}` | `Analytics.astro:115` |
| `<data-analytics value>` (delegated) | `{path}` | `Analytics.astro:124` |
| `theme_change` | `{theme}` | `Base.astro:276` |
| `ask_me_used` | `{question, answer_matched, locale}` | `AskMe.astro:187` |
| `random_post_click` | `{slug, path}` | `BlogFilter.astro:262` |

Delegated `data-analytics` names (~30 static + 7 dynamic templates) are catalogued in
`docs/cta-inventory.md`; dynamic ones embed the slug in the event name
(`project_view_<slug>`, `project_github_<slug>`, `headline_case_<slug>`, `more_project_<slug>`).

Games emit `game_started`, `game_over`, `game_win`, `daily_completed`, `best_broken`,
`sig_reached`, `experiment_started`, `milestone`, `game_selected`, `contact_click` (`[V]`, per SVG).

---

## 2. Problem statements

### P1 — Events that provably never fire `[V]`

`Analytics.astro:74-79` emits `whois_viewed` / `value_viewed` / `work-with-me_viewed` for routes
that now **308-redirect to `/about/#…`** (`astro.config.mjs:22-32`). The event names, however, still
appear in the live PostHog schema from before the redirects — so they read as "tracked" while
collecting nothing now. `HomeBoard.astro` carries `telegram_board` / `github_board` /
`linkedin_board`, but the component is **imported by no page**, so those never fire either.

### P2 — No single source of truth for events `[V]`

Event names are string literals spread across ~15 files, half of them via `data-analytics`
attributes, with no type, no schema and no shared definition. Nothing fails at build time when a name
is misspelled, and a new event can silently diverge from the ones around it.

### P3 — Silent no-op failure mode `[V]`

`theme_change`, `ask_me_used` and `random_post_click` reach the SDK once the lazy `start()` at
`Analytics.astro:93` has run, behind the `IS_LOCAL` guard at `Analytics.astro:29`. If that guard
skips (no key, or local development), every one of those calls silently does nothing.

Build-time variant: a missing `PUBLIC_POSTHOG_KEY` renders no analytics at all, also silently.
`scripts/check_site.py` (`check_analytics`) now fails the build when the key is set in the
environment but no analytics chunk reaches `dist/`.

### P4 — The hiring funnel has holes `[I]`, grounded in §1.5

- **Attribution is coarse.** PostHog captures referring domain and UTM natively, but there is no
  normalized first-touch class (`linkedin` / `github` / `google` / `direct` / `other`), and the review
  doc (`analytics-review.md:27-31`) treats referrers as a manual reading exercise.
- **Audience selector is invisible.** The home audience selector writes `localStorage['audience']`
  and `data-audience` (`Base.astro:165-177`) but emits **no event** — segmentation data exists in the
  DOM and is thrown away.
- **Section views on `/about` are invisible.** The personal-layer content now lives as anchors
  (`#whois`, `#work-with-me`, `#now`); nothing records which section a visitor actually reached —
  the very signal the dead `*_viewed` events were meant to carry.
- **Outbound clicks are not distinguished.** Autocapture catches clicks, but there is no explicit
  `outbound_click` with a normalized `domain`, so "which external destination did they leave for"
  is not directly queryable.

### P5 — Content engagement is measured only for case studies `[V]`

`scroll-depth.ts` measures one thing: 75% on a case study (`CASE_STUDY_READ_DEPTH = 0.75`).
Posts, notes and topic pages have no depth signal at all. Site search emits `search_open` but never
what was searched or whether it returned anything. `BlogFilter.astro` emits `random_post_click` but
not which filter was applied.

### P6 — Documentation is ahead of the code `[V]`

`docs/cta-inventory.md:9,35,48` and `docs/prd-v4.md:56` describe `hero_cta_click` /
`hero_cta_exposure`. Neither exists in code (the A/B was removed; `docs/analytics-review.md:37`
confirms the flag was deactivated 2026-09-15). `analytics-review.md:45-49` lists `linkedin_hero`,
`github_hero`, `telegram_header` — the first two are gone and the third never existed. A reviewer
following the docs is measuring events that do not exist.

### P7 — No client-side error visibility `[V]`

Error tracking is off at the project level and `capture_exceptions` is not set in code, so rendering
errors on the static site are invisible. Two orphan events are present in the live schema with no
source in the repo — `eng_analytics_test_census` and `analysis_completed` `[V]`; see §13.

---

## 3. Goals and non-goals

### 3.1 Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | One typed source of truth for events | `src/lib/analytics.ts` exists; `bun run check` passes with no untyped capture calls left (§5.1) |
| G2 | Zero silent no-op captures | code has no bare `window.posthog.capture` outside the module (§5.2) |
| G3 | The hiring funnel is fully instrumented | funnel `visit → project/case study → CV → contact` breakable down by `audience` and `initial_referrer_class` in one saved insight (§5.7) |
| G4 | Content engagement is measurable per content type | `read_depth` present for posts and case studies; `search_used` / `filter_applied` present (§5.8–5.10) |
| G5 | Client errors are captured | `$exception` events visible in PostHog within 24h of deploy (§5.11) |
| G6 | Games and site collect under the same rules | games init matches site init; token has one source (§5.12) |
| G7 | Dead code and stale docs are gone | no `*_viewed` for redirected routes; `cta-inventory.md` / `analytics-review.md` contain no event absent from code (§5.5, §5.15) |
| G8 | Saved artifacts reflect reality | dashboards/funnels in §1.4 reference only live events and carry the new breakdowns (§5.13) |

### 3.2 Non-goals

- No redesign, no content rewrite, no new page or UI surface.
- No cookie banner, no consent-management platform, no `cookieless_mode` (see §11 for rationale).
- No `identify()` / person-level identity (see §11).
- No new experiments, feature flags, surveys or cohorts.
- No changes to `monitoring/**` (Prometheus/Grafana exporter) or `BeaconMetrics.astro`.

---

## 4. Event taxonomy (canonical)

### 4.1 Naming rules

`object_action`, `snake_case`. No identifier in the event name — the entity goes in a property
(this is what retires `project_view_<slug>`). Properties are `snake_case` and typed.

### 4.2 Super properties (registered once, attached to every event)

| Property | Source | Values |
|---|---|---|
| `locale` | path (`/en/…`) | `ru` \| `en` |
| `audience` | `localStorage['audience']` | `hr` \| `manager` \| `colleague` \| `null` — from `AUDIENCES` (`src/lib/projects.ts:24`); the `recruiter`/`peer`/`curious` literals in this section's earlier drafts never shipped |
| `theme` | `localStorage` / `data-theme` | `dark` \| `light` \| `cyberpunk` |
| `prefers_reduced_motion` | `matchMedia` | boolean |
| `initial_referrer_class` | first-touch, normalized | `linkedin` \| `github` \| `google` \| `direct` \| `other` |
| `landing_path` | first-touch pathname | string |

`posthog.register()` registers these and persists them. `initial_utm_*` is **not** re-implemented —
PostHog already captures UTM on `$pageview` (`analytics-review.md:31`) `[V]`. The genuine additions
are the normalized `initial_referrer_class` and the first-touch `landing_path`.

### 4.3 Events — preserved unchanged

`$pageview`, `$pageleave`, `$web_vitals`, `$autocapture`, `$rageclick`, `$dead_click` (SDK);
`project_viewed`, `post_read`, `lang_switched`, `theme_change`, `ask_me_used`, `random_post_click`;
all existing `data-analytics` names catalogued in `cta-inventory.md`; all game events in §1.2.

### 4.4 Events — new

| Event | Properties | Fires when |
|---|---|---|
| `audience_selected` | `{audience, path}` | visitor picks an audience (site + any future surface) |
| `section_viewed` | `{section, path}` | `/about` anchor section (`whois`, `work-with-me`, `now`) enters viewport 50% (IntersectionObserver, once per section per load) |
| `outbound_click` | `{domain, url, surface, path}` | click on a link leaving the site (`domain` = hostname, not full URL where avoidable) |
| `search_used` | `{query, results_count, locale}` | search submitted with ≥1 result |
| `search_no_results` | `{query, results_count: 0, locale}` | search submitted with 0 results |
| `read_depth` | `{content_type, slug, depth, locale}` | `content_type ∈ {post, case_study, note}`, `depth ∈ {25, 50, 75, 100}`, at most one event per threshold per page load |
| `filter_applied` | `{tag, results_count, surface}` | writing/notes tag filter applied (`surface ∈ {writing, notes}`) |

### 4.5 Events — canonicalized (old name stops, history stays)

| Retired emission | Canonical replacement | Reason |
|---|---|---|
| `project_view_<slug>` (`ProjectCard.astro:56`) | `project_viewed {slug, surface}` | slug belongs in a property, not the name |
| `case_study_read` (`Analytics.astro:97`) | `read_depth {content_type:'case_study', depth:75}` | one depth signal for all content types |

Historical `project_view_<slug>` and `case_study_read` data remains in PostHog and must not be deleted.

### 4.6 Events — removed (provably dead)

| Event | Where | Why |
|---|---|---|
| `whois_viewed`, `value_viewed`, `work-with-me_viewed` | `Analytics.astro:74-79` | routes 308-redirect to `/about` |
| `telegram_board`, `github_board`, `linkedin_board` | `HomeBoard.astro` | component is imported by no page |

`hero_cta_click` / `hero_cta_exposure` are removed from **docs** only — already absent from code.

---

## 5. Requirements

Every requirement below is verifiable. `§6` turns them into phased tasks.

### 5.1 REQ-A01 — Central typed analytics module

New `src/lib/analytics.ts` exports a typed event map, a `track()` function, and a super-properties
registrar. All site instrumentation goes through it.

**Acceptance:** `src/lib/analytics.ts` exists; `bun run check` passes; `rg "posthog\.capture" src/`
returns matches only inside `src/lib/analytics.ts` and `src/components/Analytics.astro`.

### 5.2 REQ-A02 — No silent no-op

`track()` is a no-op **only** when PostHog was never initialised, and in that case it warns once in
dev (`import.meta.env.DEV`). Components must not read `window.posthog` directly.

**Acceptance:** `rg "window\.posthog" src/` returns no matches outside `Analytics.astro`; a unit test
asserts `track()` before init does not throw and does not dispatch.

### 5.3 REQ-A03 — Super properties registered once

On init, `registerSuperProperties()` sets every property in §4.2 exactly once per session, reading
`locale`, `audience`, `theme`, `prefers_reduced_motion` from the DOM/localStorage and first-touch
attribution from `sessionStorage` (fallback `localStorage`), computed once.

**Acceptance:** unit tests cover the attribution classifier
(`linkedin.com`→`linkedin`, `github.com`→`github`, `google.*`→`google`, empty→`direct`, other→`other`)
and first-touch persistence (second call does not overwrite the stored value).

### 5.4 REQ-A04 — Taxonomy documented

New `docs/analytics-events.md` is the canonical reference: every event, its properties, its type, and
where it fires. It is generated/maintained by hand but must match `src/lib/analytics.ts`.

**Acceptance:** every name in `docs/analytics-events.md` exists in the event map and vice versa; a
reviewer can diff the two lists mechanically.

### 5.5 REQ-A05 — Dead events removed

`Analytics.astro:74-79` deleted; `HomeBoard` analytics calls removed (component file left as-is —
it may be WIP).

**Acceptance:** `rg "whois_viewed|value_viewed|work_with_me_viewed|_board'" src/` returns no matches;
after deploy, no new `*_viewed` events appear in the PostHog live schema for 7 days.

### 5.6 REQ-A06 — Project events canonicalized

`ProjectCard.astro` and `HeadlineCases.astro` emit `project_viewed {slug, surface}`; the
`project_view_<slug>` / `headline_case_<slug>` emissions stop.

**Acceptance:** `rg "project_view_" src/` matches only `project_viewed`; the existing insight
`Top projects — project_viewed` (`jCtk3Yl7`) still returns data after deploy.

### 5.7 REQ-A07 — Funnel signals added

`audience_selected`, `section_viewed`, `outbound_click` implemented per §4.4.

**Acceptance:** each event appears in PostHog Live Activity when the corresponding interaction is
performed manually on the deployed site (checklist §8); a `section_viewed` with `section:'whois'`
fires when the `/about#whois` anchor is scrolled into view.

### 5.8 REQ-A08 — Search signals added

`search_used` / `search_no_results` emit from `SearchBox.astro`.

**Acceptance:** searching a real term produces `search_used` with a non-zero `results_count`;
searching `zzzzz` produces `search_no_results`. No raw query string is longer than 100 chars (truncated).

### 5.9 REQ-A09 — Read depth generalized

`scroll-depth.ts` gains a threshold list and a generic `contentType(path)` helper; `read_depth` fires
per threshold. `case_study_read` stops being emitted.

**Acceptance:** `scroll-depth.ts` unit tests cover each threshold and each content type; a `post`
page emits `read_depth {content_type:'post'}` at 25/50/75/100; an existing case-study page emits
`read_depth {content_type:'case_study'}` at 75 (parity with the retired `case_study_read`).

### 5.10 REQ-A10 — Filter signal added

`BlogFilter.astro` emits `filter_applied {tag, results_count, surface}` when a filter is applied.

**Acceptance:** clicking a topic chip emits `filter_applied` with the chip's tag and the rendered
result count.

### 5.11 REQ-A11 — Error tracking enabled

`capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true }` added to
the site init; Error Tracking enabled in PostHog project settings.

**Acceptance:** a deliberately thrown error on a preview/manual test page produces a `$exception` in
PostHog (verified once, then reverted); the Error Tracking product shows the issue grouped.

### 5.12 REQ-A12 — Games config parity + single-source token

**Resolved 2026-10-18 — decision: keep the literal token.** `public/games/*` (11 files) keep the
production token hardcoded. The original plan (`__PH_KEY__` placeholder + a postbuild injector into
`dist/games/*`) was rejected because it would empty out the `deploy.yml:88-107` drift check — the only
mechanism binding those hardcoded literals to the `PUBLIC_POSTHOG_KEY` secret. Removing the literals
would leave a guard that loops over nothing and passes silently, so a rotated key could misroute
traffic with a green build. Keeping the literal keeps the secret as single source of truth.

What was done instead:

- Init aligned with the site: `defaults: '2026-05-30'`, `persistence: 'localStorage+cookie'`,
  `capture_pageview`, `capture_pageleave`, `autocapture`, `capture_exceptions: true`,
  `session_recording: { maskAllInputs: true }`.
- **Decision 2026-10-18: site parity, not `persistence: 'memory'`.** No consent gate exists anywhere in
  the repo and `localStorage+cookie` sets `ph_<token>_posthog` for 365 days, so `memory` would have been
  the stricter option — but the funnel is the primary goal and §11 already accepts cookie persistence
  for the site, so games and site share one attribution posture instead of diverging. Game state is
  unaffected — streaks and best scores use the games' own `lsGet`/`lsSet` localStorage helpers, not
  PostHog persistence.

**Acceptance:** the `deploy.yml:88-107` drift check passes (`rc=0` across 11 files);
`rg "localStorage\+cookie" public/games/` matches 11 files; the games init options match the ones
listed in §1.2.

### 5.13 REQ-A13 — Artifacts reconciled

Funnels `j35OMv7Z` and `zlXsA98W` and dashboard `1994322` reference only live events and gain
`audience` / `initial_referrer_class` breakdowns where useful; `My App Dashboard` (`1660826`) deleted;
the tutorial artifact `QPtsvkv1` reviewed and removed if obsolete.

**Acceptance:** every saved insight's query references an event present in `docs/analytics-events.md`;
an alias `old_event` OR `new_event` is used where a funnel must bridge rename history
(`case_study_read` OR `read_depth`).

### 5.14 REQ-A14 — Unit tests

New `tests/lib/analytics.test.ts` (module, super-props, attribution classifier) and extended
`tests/lib/scroll-depth.test.ts`.

**Acceptance:** `bun run test` passes; coverage of `src/lib/analytics.ts` and `src/lib/scroll-depth.ts`
includes every exported function.

### 5.15 REQ-A15 — Docs reconciled

`docs/cta-inventory.md` and `docs/analytics-review.md` updated: `hero_cta_*`, `linkedin_hero`,
`github_hero`, `telegram_header` removed; new events and the new funnel breakdowns documented; the
review ritual points at the canonical events.

**Acceptance:** `rg "hero_cta_click|hero_cta_exposure|linkedin_hero|github_hero|telegram_header" docs/`
returns no matches.

---

## 6. Tasks

Phases are ordered; a later phase's acceptance check assumes the earlier ones passed. `A0` is a
precondition.

### Phase A0 — Baseline (precondition)

| Task | Work | Acceptance |
|---|---|---|
| A0.1 | Snapshot current production numbers into `docs/prd-analytics-instrumentation-baseline.md`: event counts per name (30d), funnel `j35OMv7Z` conversion, referrer mix. | File exists with a dated table; numbers reproducible from a saved PostHog query. |

### Phase A1 — Module and migration

| Task | Work | Acceptance |
|---|---|---|
| A1.1 | Create `src/lib/analytics.ts` (event map, `track()`, `registerSuperProperties()`, attribution classifier). | REQ-A01, REQ-A02, REQ-A03 pass. |
| A1.2 | Migrate `Analytics.astro` page-type events and the delegated-click handler to `track()`. | `rg "posthog\.capture" src/` matches only `analytics.ts` + `Analytics.astro`. |
| A1.3 | Migrate `Base.astro:276` (`theme_change`), `AskMe.astro:187`, `BlogFilter.astro:262`. | REQ-A02 passes; each still fires in Live Activity. |

### Phase A2 — New signals and canonicalization

| Task | Work | Acceptance |
|---|---|---|
| A2.1 | `audience_selected`, `section_viewed`, `outbound_click`. | REQ-A07 passes. |
| A2.2 | `search_used`, `search_no_results` in `SearchBox.astro`. | REQ-A08 passes. |
| A2.3 | Generalize `scroll-depth.ts`; emit `read_depth`. | REQ-A09 passes. |
| A2.4 | `filter_applied` in `BlogFilter.astro`. | REQ-A10 passes. |
| A2.5 | Canonicalize project events. | REQ-A06 passes. |

### Phase A3 — Cleanup

| Task | Work | Acceptance |
|---|---|---|
| A3.1 | Remove dead events (§4.6). | REQ-A05 passes. |
| A3.2 | Write `docs/analytics-events.md`. | REQ-A04 passes. |

### Phase A4 — Error tracking

| Task | Work | Acceptance |
|---|---|---|
| A4.1 | Add `capture_exceptions` to site init. | REQ-A11 code half. |
| A4.2 | Enable Error Tracking in PostHog project settings. | REQ-A11 product half (`$exception` observed once). |

### Phase A5 — Games

| Task | Work | Acceptance |
|---|---|---|
| A5.1 | **Rejected** 2026-10-18 — keeps the literals so the `deploy.yml` drift check stays meaningful. Instead: `persistence: 'localStorage+cookie'` + site-parity init across all 11 files. | `rg "localStorage\+cookie" public/games/` matches 11 files; drift check green. |
| A5.2 | **Dropped** — no postbuild injector while the literal token stays. | n/a |

### Phase A6 — PostHog artifacts

| Task | Work | Acceptance |
|---|---|---|
| A6.1 | Reconcile funnels and dashboard; add breakdowns. | REQ-A13 passes. |
| A6.2 | Delete `My App Dashboard`; review `QPtsvkv1`. | Dashboard list contains no auto-starter artifact. |

### Phase A7 — Tests and docs

| Task | Work | Acceptance |
|---|---|---|
| A7.1 | `tests/lib/analytics.test.ts`; extend `scroll-depth.test.ts`. | REQ-A14 passes; `bun run test` green. |
| A7.2 | Update `cta-inventory.md`, `analytics-review.md`. | REQ-A15 passes. |
| A7.3 | Run `bun run check` and `make check`; full pass. | Both commands exit 0. |

---

## 7. PostHog project-side changes

| Change | How | Reversible |
|---|---|---|
| Enable Error Tracking | Project settings (or MCP) | yes |
| Delete `My App Dashboard` (`1660826`) | MCP / UI | yes (recoverable) |
| Edit funnels `j35OMv7Z`, `zlXsA98W`, dashboard `1994322` | MCP / UI | yes (do not delete) |
| Review `QPtsvkv1` tutorial funnel | MCP / UI | recommend delete if unused |

Not changing: replay/heatmap product toggles (already on), `respect_dnt`, cookie persistence
(see §11), retention settings.

---

## 8. Verification checklist (post-deploy, manual)

Run once after the first deploy that contains Phases A1–A3. Each line is pass/fail.

1. Load `/` → `$pageview` with `locale`, `initial_referrer_class`, `landing_path` present.
2. Pick an audience → `audience_selected`.
3. Open `/about`, scroll to the `#whois` anchor → `section_viewed {section:'whois'}`.
4. Click an external LinkedIn/GitHub link → `outbound_click {domain}`.
5. Search a real term → `search_used {results_count>0}`; search `zzzzz` → `search_no_results`.
6. Open a post, scroll to bottom → `read_depth` at 25/50/75/100.
7. Apply a topic filter → `filter_applied {tag, results_count}`.
8. Open a project card link → `project_viewed {slug, surface}` (no `project_view_<slug>`).
9. Toggle theme → `theme_change`; switch language → `lang_switched`.
10. No new `whois_viewed` / `value_viewed` / `work-with-me_viewed` events.
11. Thrown test error → `$exception` in Error Tracking (once, then reverted).

---

## 9. Rollout

- Order: A0 → A1 → A2 → A3 → A4 → A5 → A6 → A7.
- Deploy gate: `bun run check`, `bun run test`, `make check`, Lighthouse CI (unchanged).
- One PR or a small series; A0's baseline file lands first so the change is attributable.
- Rollback: revert the PR. PostHog artifact edits are separately reversible; no event history is
  deleted except the artifacts named in §7.

---

## 10. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Canonicalizing `project_view_<slug>` breaks `Top projects` insight | medium | REQ-A06 acceptance explicitly re-queries the insight post-deploy |
| Funnel breaks across `case_study_read`→`read_depth` | medium | use `old OR new` alias in the funnel (§5.13) |
| Super-property registration runs after early events | low | register before first page-view capture; unit-tested |
| Games postbuild misses a file | low | script iterates `dist/games/*` and fails loudly if the token is absent from output |
| Silent no-op regresses | low | REQ-A02 forbids direct `window.posthog`; test asserts warning path |
| New events add noise to existing dashboards | low | new events are additive; dashboard edits are scoped in A6.1 |

---

## 11. Out of scope (explicit)

- **Consent banner / consent platform.** A personal portfolio; a banner harms the very conversion the
  funnel measures. Revisit only if a legal requirement appears.
- **`cookieless_mode`.** Would improve privacy but costs cross-session attribution — the funnel is
  the primary goal, so cookie persistence stays.
- **`respect_dnt`.** Deprecated signal with false positives.
- **`identify()` / person profiles.** No PII is collected on the site; anonymous + super properties is
  sufficient for segmentation.
- **`monitoring/**` and `BeaconMetrics.astro`.** Separate first-party contour, disabled by default.
- **Surveys, feature flags, experiments, cohorts.** No new product surface.
- **Server-side analytics.** Static site, no server to instrument.

---

## 12. Open items

| Item | Status |
|---|---|
| `eng_analytics_test_census` — in the live schema, no source in the repo | `[V]` **explained 2026-10-18**: 46 events / 1 user over 90d, still flowing. Not the site — a separate pipeline writing into project `451732`; already grouped by the V2 tile «Мусорные события (свои пайплайны)». Keep |
| `analysis_completed` — in the live schema, no source in the repo | `[V]` **explained 2026-10-18**: one event, fired 2026-08-28. One-off; no action |
| `hero_cta_exposure` — historical data present, code removed | `[V]` leave historical data; remove only doc references (A7.2) |
| PostHog retention window for `$ai_*` / LLM events | not relevant to this site; ignore |
| 13 live dashboards vs. the 3 documented above | `[V]` 2026-10-18 — §1.4 now lists all 13; the legacy `2142402`–`2142405` set restates V2 and is a deletion candidate |
| 36 of 38 V2 insights carry `filterTestAccounts: false` | `[V]` 2026-10-18 — `test_account_filters_default_checked` is `null`, so every V2 tile mixes the owner's own traffic with visitors'. Fix: default-check the cohort filter in project settings toggles, or set it per insight |
| V2 tiles re-reference dead contact events | `[V]` 2026-10-18 — dashboards `02` (`See7a8LO`, `UlWlIfFB`, `SlwlMAdv`) use `telegram_contact` / `telegram_deeplink` / `linkedin_contact`, which `zlXsA98W` had explicitly dropped on 2026-10-12. Reconcile to `telegram_footer` / `linkedin_footer` / `github_footer` / `cv_download_pdf` |
| `$exception` = 0 / 90d despite `capture_exceptions: true` and `autocapture_exceptions_opt_in: true` | `[NV]` 2026-10-18 — tile `AwMIg6fH` «Ошибки JS» (`2226422`) is structurally empty. Needs a live throw-test to separate "no errors occurred" from "errors are not ingested" |
