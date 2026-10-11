# Portfolio analytics report — 2026-10-12

**Source:** PostHog project `451732` (`nikitaboyarkin.github.io`), live HogQL queries.
**Window:** last 90 days (2026-07-14 → 2026-10-12) unless stated otherwise.
**Scope:** site events only. `$ai_*` LLM-observability events (75% of all rows in the
project) are excluded — see *Data quality* below.

---

## 1. Executive summary

| Metric (90d) | Value |
|---|---|
| Unique visitors | **242** |
| Sessions | 446 |
| Pageviews | 2 163 |
| Site events | 4 148 |
| Home → Project → Contact funnel | 94 → 20 → 6 (**6.4 %**) |
| Returning visitors (≥2 weeks) | 7 / 237 (**3.0 %**) |
| Traffic gate (≥100 unique / 90d) | **PASSED** — decisions allowed |

The site crossed the traffic gate: 242 unique visitors over 90 days means conversion
metrics are no longer track-only. The dominant story of the window is the
**repository rename** — traffic migrated from the old project path to the new user-site
root mid-September (see §3).

---

## 2. Traffic trend (weekly pageviews)

| Week | Pageviews | People |
|---|---|---|
| 2026-08-10 | 57 | 5 |
| 2026-08-17 | 340 | 6 |
| 2026-08-24 | 296 | 7 |
| 2026-08-31 | 110 | 5 |
| 2026-09-07 | 281 | 27 |
| 2026-09-14 | 439 | 41 |
| 2026-09-21 | 145 | 16 |
| 2026-09-28 | 165 | 10 |
| **2026-10-05** | **322** | **140** |
| 2026-10-12 | 8 | 1 *(partial week)* |

The week of **2026-10-05** is a step change: 140 distinct people in one week versus
single digits in August. This is the highest-reach week in the window and the point
where the site started getting broad (non-returning) traffic.

---

## 3. Repository rename — old vs new path

`$pathname` shows two path shapes because the repo was renamed from
`Personal_Projects.github.io` (project site, prefixed paths) to
`NikitaBoyarkin.github.io` (user site, root paths):

| Month | Old path (`/Personal_Projects.github.io/*`) | New path (`/…`) |
|---|---|---|
| 2026-08 | 695 | 5 |
| 2026-09 | 686 | 339 |
| 2026-10 | **6** | **432** |

The cutover happened in September; October is effectively 100 % new-path. Old links
still drove ~half of September traffic before dying off. This rename is the root cause
of the previously broken funnels (fixed 2026-10-12, see §10).

### Top pages (90d)

| Path | Views | People |
|---|---|---|
| `/Personal_Projects.github.io/` *(legacy)* | 628 | 64 |
| `/` | 289 | 38 |
| `/Personal_Projects.github.io/graph/` *(legacy)* | 100 | 9 |
| `/Personal_Projects.github.io/projects/` *(legacy)* | 79 | 15 |
| `/Personal_Projects.github.io/writing/` *(legacy)* | 67 | 6 |
| `/en/` *(legacy)* | 51 | 10 |
| `/projects/` | 47 | 4 |
| `/projects/volta/` | 47 | 5 |
| `/contact/` *(legacy)* | 38 | 2 |
| `/about/` | 34 | 7 |

---

## 4. Content engagement

### Top projects (`project_viewed`)

| Slug | Views | People |
|---|---|---|
| **volta** | 106 | 10 |
| posthog | 19 | 7 |
| ab | 18 | 6 |
| sales-calls | 14 | 7 |
| sql | 13 | 3 |
| cohort | 11 | 5 |
| supabase | 9 | 3 |

`volta` is the flagship by a wide margin (5× the next project). Since 16.09 the featured
slot must point to a public repo — Volta qualifies and is carrying the surface.

### Top posts (`post_read`)

| Slug | Reads | People |
|---|---|---|
| rfm-segmentation-practical | 6 | 1 |
| analyst-interview-cases | 6 | 4 |
| cohort-retention-guide | 6 | 2 |
| bayesian-ab-testing | 5 | 2 |
| product-analyst-collaboration | 4 | 3 |
| payment-failures-revenue | 4 | 2 |

Post reads are low-volume (max 6 reads). Content is read by a handful of people —
normal for a portfolio at this traffic level, but not yet a distribution channel.

### Read depth

| Depth | Events | People |
|---|---|---|
| 25 % | 12 | 5 |
| 50 % | 9 | 5 |
| 75 % | 6 | 4 |
| 100 % | 2 | 2 |

Read depth falls off monotonically — readers who start tend to stop around the halfway
point. Small sample (5 people), so directional only.

---

## 5. Conversion funnel — Home → Project → Contact

Person-level, 90 days. "Home" = `/` or legacy `/Personal_Projects.github.io/`.

| Step | People | Step conv. | Overall |
|---|---|---|---|
| Home | 94 | — | 100 % |
| Project viewed | 20 | 21.3 % | 21.3 % |
| Contact (CV / Telegram / LinkedIn / GitHub / booking) | 6 | 30.0 % | **6.4 %** |

The big drop is **home → project (79 % loss)**. Once someone opens a project, they
convert to contact at a healthy 30 %. The leverage is in the home surface, not the
project pages.

### Contact events (90d)

| Event | Count | People |
|---|---|---|
| outbound_click | 12 | 7 |
| hero_cv | 5 | 5 |
| github_footer | 4 | 3 |
| linkedin_footer | 4 | 3 |
| cv_pdf_footer | 3 | 2 |
| telegram_footer | 2 | 1 |
| cv_download_pdf | 2 | 2 |
| booking_click | 2 | 2 |
| cv_footer | 1 | 1 |

---

## 6. Acquisition — referring domains

| Domain | Views | People |
|---|---|---|
| nikitaboyarkin.github.io | 1 578 | 44 *(internal navigation)* |
| `$direct` | 405 | **209** |
| github.com | 143 | 13 |
| linkedin.com (www + android) | 32 | 19 |
| google.com | 2 | 2 |
| bing.com | 1 | 1 |
| yandex.ru | 1 | 1 |
| localhost:4322 | 1 | 1 *(dev leak)* |

**Direct dominates (209 of 237 visitors).** GitHub and LinkedIn are the only meaningful
external referrers. Search is negligible. One `localhost:4322` pageview leaked past the
`IS_LOCAL` guard — worth a look, but immaterial (1 view).

---

## 7. Language split

| Locale | Pageviews | People |
|---|---|---|
| *(unset)* | 1 385 | 73 |
| ru | 730 | 131 |
| en | 48 | 39 |

`locale` is missing on 64 % of pageviews — autocaptured `$pageview` fires before the
`locale` super-property is registered. **RU dominates the tagged traffic (15:1).**
Language switches: 14 events.

---

## 8. Engagement surfaces

| Event | Count | People |
|---|---|---|
| section_viewed | 103 | 8 |
| persona_gate_view | 46 | 5 |
| theme_change | 18 | 3 |
| lang_switched | 14 | 5 |
| featured_project | 10 | 7 |
| bento_graph | 6 | 5 |
| persona_selected | 4 | 1 |

Search, Ask-me and the games hub produced **zero** qualifying events in 90 days
(`search_used`, `ask_me_used`, `random_post_click`, `game_started`, `game_win`,
`daily_completed` are absent from the taxonomy). Their dashboard tiles are empty because
the features are unused, not because instrumentation is broken.

---

## 9. Core Web Vitals (LCP p75)

| Path | LCP p75 | CLS p75 | Samples |
|---|---|---|---|
| `/` | 916 ms | 0.00 | 57 |
| `/about/` | 612 ms | 0.00 | 8 |
| `/Personal_Projects.github.io/` *(legacy)* | 1 412 ms | 0.001 | 146 |

New-path LCP is comfortably in the "good" band (< 2.5 s). The legacy path is slower but
is being retired.

---

## 10. Data quality & cleanup applied 2026-10-12

### Noise identified

| Source | Volume (90d) | Note |
|---|---|---|
| `$ai_generation` + `$ai_span` + `$ai_trace` + summaries | **12 808 events (75 %)** | LLM-observability from a single bot (`distinct_id: vault_…`) writing to the same project token |
| eng_analytics_test_census | 39 | test event, 1 person |
| $scout_report_edited | 11 | internal |
| Dead events in history | — | `whois_viewed`, `value_viewed`, `work-with-me_viewed`, `hero_cta_exposure`, `cta_exposure` |

### Changes made (PostHog project 451732)

1. **Repaired 4 insights** that referenced dead events / the stale repo path:
   - `11919159` Portfolio funnel: Visit → Project → Contact — step 3 `work-with-me_viewed` → `cv_download_pdf`
   - `11015002` Funnel: рекрутер → контакт — path `/Personal_Projects.github.io/` → `/`; 5 dead contact events → live ones (`telegram_footer`, …)
   - `12276372` Контактные события по locale — `telegram_contact` → `telegram_footer`
   - `12276384` Тренды контактных CTA — `telegram_contact` → `telegram_footer`, dropped dead `contact_submit`
2. **Deleted 2 junk insights:** `11272834` (wizard tutorial, dead `projects_shuffle`) and `12162242` (unnamed, stale-path funnel).
3. **Enabled exception tracking:** project `autocapture_exceptions_opt_in = true` + client `capture_exceptions: true` (`src/components/Analytics.astro`).
4. **Isolated the LLM bot:** added `distinct_id = vault_fb7dfd7799c4a438` to cohort `341410 "Internal / Test users"`.
5. **Removed the auto-starter dashboard** `1660826 "My App Dashboard"`; set `primary_dashboard → 2024833 "Портфолио — аналитика"`.

---

## 11. Recommendations

1. **Attack home → project (79 % loss).** The home surface, not project pages, is the
   bottleneck. Test stronger project entry points above the fold.
2. **Split the LLM token off this project.** The bot is now filtered via the test cohort,
   but the correct fix is a separate PostHog project — the shared token will keep
   polluting project-wide counts otherwise.
3. **Fix `locale` coverage.** 64 % of pageviews have no locale because the super-property
   registers after `$pageview`. Set locale earlier (or enrich `$pageview`) to make RU/EN
   reporting trustworthy.
4. **Lean into GitHub → portfolio.** GitHub is the only real external source (143 views,
   13 people). LinkedIn is second. Direct dominates — invest in channels that create
   named referrers.
5. **Retire the legacy path.** `/Personal_Projects.github.io/*` still accounts for 628
   pageviews; a redirect from old paths would consolidate reporting and lift LCP.
6. **Re-check empty tiles.** Search / Ask-me / games dashboards show zeros; either the
   features need surfacing or the tiles should be trimmed to avoid dead dashboards.
