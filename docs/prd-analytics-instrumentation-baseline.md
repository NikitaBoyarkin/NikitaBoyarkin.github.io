# Baseline — Analytics Instrumentation (A0.1)

| Field | Value |
|---|---|
| Status | Complete — precondition for `docs/prd-analytics-instrumentation.md` |
| Date | 2026-09-19 |
| PostHog project | `451732` (org `NBxHive`, host `us.posthog.com`) |
| Data window | Event counts / referrer mix: last 30 days (2026-08-20 → 2026-09-19). Funnels per their saved range. |
| Source | Live PostHog queries (HogQL + `insight-query`). Every number below is reproducible from the Query section. |

> Every figure is `[V]` (verified by a live query run on 2026-09-19). Where a
> saved artifact disagrees with the code, that is called out in §5.

---

## 1. Event counts (30 days)

`SELECT event, count() AS events, uniq(person_id) AS users FROM events WHERE timestamp >= now() - INTERVAL 30 DAY GROUP BY event ORDER BY events DESC`

| Event | Events | Users |
|---|---|---|
| `$pageview` | 1191 | 66 |
| `$autocapture` | 298 | 34 |
| `$web_vitals` | 285 | 48 |
| `$pageleave` | 244 | 42 |
| `project_viewed` | 128 | 18 |
| `post_read` | 39 | 7 |
| `value_viewed` | 18 | 6 |
| `eng_analytics_test_census` | 16 | 1 |
| `whois_viewed` | 14 | 9 |
| `lang_switched` | 12 | 4 |
| `work-with-me_viewed` | 11 | 5 |
| `hero_cta_exposure` | 11 | 6 |
| `$scout_report_edited` | 8 | 2 |
| `bento_graph` | 6 | 5 |
| `$rageclick` | 6 | 4 |
| `featured_project` | 6 | 6 |
| `$feature_flag_called` | 6 | 6 |
| `$experiment_exposure` | 6 | 6 |
| `hero_cv` | 5 | 5 |
| `hero_projects` | 4 | 3 |
| `project_view_rfm` | 3 | 3 |
| `bento_stack` | 3 | 3 |
| `bento_notes` | 3 | 3 |
| `project_github_volta` | 3 | 2 |
| `project_view_sales-calls` | 3 | 3 |
| `cv_pdf_footer` | 3 | 2 |
| `project_view_supabase` | 2 | 2 |
| `$scout_report_emitted` | 2 | 1 |
| `project_view_volta` | 2 | 1 |
| `game_selected` | 1 | 1 |
| `project_view_ab` | 1 | 1 |
| `project_view_sql` | 1 | 1 |
| `linkedin_footer` | 1 | 1 |
| `project_github_sql` | 1 | 1 |
| `project_view_ml` | 1 | 1 |
| `project_github_ab` | 1 | 1 |
| `project_github_bot` | 1 | 1 |
| `cv_footer` | 1 | 1 |
| `cv_download_pdf` | 1 | 1 |
| `analysis_completed` | 1 | 1 |
| `project_github_streamlit` | 1 | 1 |
| `project_view_streamlit` | 1 | 1 |
| `$recording_observed` | 1 | 1 |
| `case_study_read` | 1 | 1 |
| `project_github_supabase` | 1 | 1 |
| `github_footer` | 1 | 1 |

### Readings

- **Dead events are still emitting.** `whois_viewed` (14), `value_viewed` (18),
  `work-with-me_viewed` (11) still fire — the routes 308-redirect to
  `/about/#…`, but events fired *before* the redirect are inside the window.
  Corrected after the redirect lands, they must trend to zero (REQ-A05).
- **Attribution is still slug-in-name.** `project_view_<slug>` variants
  (`project_view_volta`, `project_view_rfm`, …) are all present; the canonical
  `project_viewed` (128) runs in parallel. This is the P2/§4.5 problem.
- **Only one depth event all month.** `case_study_read` = 1. `read_depth`
  (REQ-A09) has no baseline; the retired event is effectively unused.
- **A/B residual.** `hero_cta_exposure` / `$experiment_exposure` /
  `$feature_flag_called` = 6–11 from the deactivated `hero_cta_variant` flag.
  `hero_cta_click` is **absent** from the schema — the flag's code no longer
  exists (P6 confirmed).

---

## 2. Funnels

### 2.1 Saved `j35OMv7Z` — "Portfolio funnel: Visit → Project → Contact" (as saved, 90d)

Steps: `$pageview` → `project_viewed` → `work-with-me_viewed`.

| Metric | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| Person count | 72 | 15 | 3 |
| Conversion | 100% | 20.83% | **4.17%** |
| Avg. time | — | 38s | 17h 45m |
| Median time | — | 30s | 11m 51s |

> **The saved funnel's final step is a dead event.** Its "conversion" is
> historical only; after the redirect it can never increment. Its description
> itself says: *"Baseline before instrumentation improvements."* This is the
> artifact REQ-A13 must reconcile.

### 2.2 Saved `zlXsA98W` — "Funnel: рекрутер → контакт" (as saved, 30d)

Steps: `$pageview` `$pathname = /Personal_Projects.github.io/` → `$pageview`
`$pathname contains /projects/` → contact group (11 events incl. `hero_cv`).

| Metric | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| Person count | 53 | 19 | 4 |
| Conversion | 100% | 35.85% | **7.55%** |
| Avg. time | — | 1m 57s | 4m 14s |
| Median time | — | 56s | 3m 39s |

> Step 1 is anchored on the **old base path** `/Personal_Projects.github.io/`.
> The repo was renamed to a user Pages site and the base removed on
> **2026-09-18** (§4). From 2026-09-19 this funnel reads **0** on step 1.
> This is a stale artifact, not a traffic collapse.

### 2.3 Corrected funnel (live events, 30d, computed)

Steps: `$pageview` → `project_viewed` → contact group
(`cv_download_pdf`, `cv_pdf_footer`, `cv_footer`, `cv_source_github`, `hero_cv`,
`telegram_contact`, `telegram_deeplink`, `telegram_footer`, `linkedin_footer`,
`github_footer`).

| Metric | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| Person count | 66 | 15 | 4 |
| Conversion | 100% | 22.73% | **6.06%** |
| Avg. time | — | 33s | 4m 18s |
| Median time | — | 19s | 4m 56s |

> This is the honest current baseline for the funnel G3 wants to instrument
> (`visit → project/case study → CV → contact`): **6.06%** over 30 days.
> `linkedin_hero` / `github_hero` / `telegram_header` were **excluded** — they
> are dead or never existed (P6), so they contribute 0 and only mislead.

---

## 3. Referrer mix (30 days, `$pageview`)

`SELECT coalesce(nullIf(properties.$referring_domain,''),'$direct') AS referrer, count() AS pv, uniq(person_id) AS users FROM events WHERE event='$pageview' AND timestamp >= now() - INTERVAL 30 DAY GROUP BY referrer`

| Referrer | Pageviews | Users |
|---|---|---|
| `nikitaboyarkin.github.io` | 954 | 30 |
| `$direct` | 145 | 54 |
| `github.com` | 81 | 8 |
| `www.linkedin.com` | 9 | 6 |
| `www.google.com` | 1 | 1 |
| `localhost:4322` | 1 | 1 |

### Readings

- **Self-referral dominates** (`nikitaboyarkin.github.io`, 954) — internal
  navigation, not acquisition. Any referrer chart must exclude it.
- **`$direct` is the largest true acquisition bucket** (54 users) — larger than
  GitHub by users, though GitHub sends more pageviews per user (81 pv / 8 users).
- **LinkedIn is ~0** (9 pv / 6 users, 30d) despite being a stated distribution
  channel (CONTEXT.md *Distribution loop*).
- **`localhost:4322`** is dev leakage — one event; the local guard
  (`Analytics.astro` hostname check) should have caught it, so this is likely
  from an old build. Worth a one-line note in the review ritual (already listed
  in `analytics-review.md:57`).
- **`$initial_referring_domain` is not captured in this project.** A query for
  it returned a taxonomy warning; only `$referring_domain` (per-event) exists.
  → REQ-A03's `initial_referrer_class` and `landing_path` must be computed
  **client-side, first-touch, in `sessionStorage`**; they cannot be read from
  PostHog defaults. PRD §4.2 already assumes this, but the reason is now explicit.

---

## 4. Traffic gate & the base-path cutover

| Metric | Value |
|---|---|
| Unique visitors (90d) | **72** (Aug 14 → Sep 18) |
| Pageviews (90d) | 1382 |
| Traffic gate (CONTEXT.md) | ≥100 uniq./90d — **not reached** → funnel stays track-only |

**Base-path cutover (breaking, verified from `$pathname`):**

| Pathname prefix | Pageviews (30d) | Last seen |
|---|---|---|
| `/Personal_Projects.github.io/*` | ~1290 | 2026-09-18 17:20 |
| `/*` (domain root) | 9 | 2026-09-18 18:30 → |

The site moved from a project Pages path to the user Pages domain root on
2026-09-18. Any saved artifact, doc, or funnel that filters on
`/Personal_Projects.github.io/` is now dead. `zlXsA98W` is the first casualty.

---

## 5. Orphan events resolved (PRD §12 → this section, not "§13")

The PRD's §12 sends the reader to a "§13" that does not exist. Both orphans are
now explained:

| Event | Verdict | Evidence |
|---|---|---|
| `eng_analytics_test_census` (16 events, 1 user) | **External scheduled job**, not from this repo. Fires daily at 09:45 with `distinct_id = eng_analytics_census:NikitaBoyarkin/Personal_Projects.github.io`, no `$current_url`. | `[V]` live rows 2026-09-03 → 09-18. No source in `NikitaBoyarkin.github.io/**`. |
| `analysis_completed` (1 event, 2026-08-28) | **Cross-project token leak.** Fired by the Telegram bot, which uses the **same PostHog project token** as the site. | `[V]` source: `telegram_bot/src/handlers/analysis.py:262`; token comparison: portfolio `.env` ≡ `telegram_bot/.env` (same `phc_…`). |

**Data-hygiene consequence:** the Telegram bot writes its own events
(`analysis_completed`, `analysis_error`, …) into the portfolio project, so
event counts are not site-only. A0.1 recommends either a separate PostHog
project for the bot, or an `app: telegram_bot` super property so site funnels
can exclude it. This is **out of the instrumentation PRD's scope** (no product
surface change) but must be recorded before any funnel number is trusted.

---

## 6. Corrections to the PRD (found while establishing the baseline)

These are `[V]` and change what some tasks can assume. They are **not**
executed here — they are inputs to Phases A1–A3.

1. **P4/P5 "the home audience selector … emits no event" is stale — there is no
   audience selector in the source at all.** `git log -S 'audience-bar'` shows it
   was removed in `2fc37de` (consolidate pages). What remains is
   `Base.astro:167-177` (the inline script that *reads* `localStorage['audience']`
   and sets `data-audience`) plus the dead CSS in `global.css`.
   → REQ-A07's `audience_selected` has **no UI to fire from**. Either the
   selector is re-introduced (a product change — out of scope per §3.2) or the
   event is dropped and the super property (§4.2) always reads `null`.
2. **Audience values disagree between PRD and code.** Code accepts
   `recruiter | analyst | learner` (`Base.astro:172`); PRD §4.2 specifies
   `recruiter | peer | curious | null`. Any super-property implementation must
   pick one; the code's values are what existing `localStorage` holds.
3. **Both saved funnels are live** (re-verified 2026-10-18): `j35OMv7Z` is
   `$pageview → project_viewed → cv_download_pdf` (all three events fire), and
   `zlXsA98W` step 1 filters `$pathname` `exact /` — the old base path is gone.
   The only real defect left was `zlXsA98W` step 3, whose contact OR-group still
   carried three retired events (`hero_cv`, `cv_footer`, `cv_pdf_footer` —
   removed from the code on 2026-09-19, see `analytics-events.md`); they were
   dropped on 2026-10-18, leaving `cv_download_pdf`, `telegram_footer`,
   `linkedin_footer`, `github_footer`. REQ-A13's "add breakdowns" work is still
   open; the funnels themselves no longer need rewriting.
4. **`$initial_referring_domain` does not exist** (§3). The first-touch
   classifier is a client-side concern; no server-side backfill is possible.
5. **PRD §12 points at a non-existent §13.** Section 5 above closes it.
6. **Non-site events land in the portfolio project** (backlog, 2026-10-18). Live query over 30d:
   `$ai_generation` 6501, `$ai_span` 5964, `$ai_trace` 183 — LLM-observability traces, last seen
   2026-10-11 — plus `eng_analytics_test_census` (30, 2026-10-18) and `$scout_report_edited` (3).
   None of it is portfolio traffic, so any "all events" view is misleading. Next step: find which
   tooling posts to project `451732` and route it elsewhere, or filter these events out of the saved
   insights. Not fixed here — it is a source-side problem, not a dashboard one.

---

## 7. Reproduce this baseline

Run against project `451732`:

```sql
-- 1. event counts, 30d
SELECT event, count() AS events, uniq(person_id) AS users
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY event ORDER BY events DESC LIMIT 100;

-- 2. referrer mix, 30d
SELECT coalesce(nullIf(properties.$referring_domain, ''), '$direct') AS referrer,
       count() AS pv, uniq(person_id) AS users
FROM events
WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY referrer ORDER BY pv DESC LIMIT 50;

-- 3. traffic gate, 90d
SELECT uniq(person_id) AS unique_visitors, count() AS pageviews
FROM events
WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 90 DAY;
```

Funnels: `insight-query j35OMv7Z`, `insight-query zlXsA98W`; corrected funnel via
`query-funnel` with the series in §2.3.

---

## 8. Links

- [Funnel j35OMv7Z](https://us.posthog.com/project/451732/insights/j35OMv7Z)
- [Funnel zlXsA98W](https://us.posthog.com/project/451732/insights/zlXsA98W)
- [Dashboard «Рекрутер»](https://us.posthog.com/project/451732/dashboard/1994322)
- PRD: `docs/prd-analytics-instrumentation.md`
