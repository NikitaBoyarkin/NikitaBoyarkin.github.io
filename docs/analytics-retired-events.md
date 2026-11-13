# Retired and renamed analytics events

The ledger behind `docs/analytics-events.md` §4. It lives in its own file because
a canonical reference should not have to grow with every rename: §1–§3 describe
what the site emits **now**, this file records what it stopped emitting and why.

Historical rows for every retired or removed event stay in PostHog and must not
be deleted (PRD §0 rule 3). `tests/lib/analytics-contract.test.ts` also holds a
retired-names list, so a name cannot quietly come back into `AnalyticsEventMap`.

| Event | Status | Why |
|---|---|---|
| `headline_all_projects`, `headline_demo_<slug>`, `headline_github_<slug>`, `more_project_<slug>` | removed (never fired) | `HeadlineCases.astro` no longer exists in `src/` — the names were documented but had **no emitter**; they appear in PostHog only as historical rows |
| `project_viewed { surface:'headline' }` | retired | same removal — no component sets that surface |
| `bento_graph` | removed | emitted by the old homepage bento; `HomeBoard.astro` is imported by no page |
| `value_viewed`, `whois_viewed`, `work-with-me_viewed` | removed | routes 308-redirect to `/about`; the events could never fire again (PRD §4.6). Historical rows stay in PostHog |
| `project_view_<slug>` | retired | replaced by `project_viewed { slug, surface }` (PRD §4.5) |
| `case_study_read` | retired | replaced by `read_depth { content_type:'case_study', depth:75 }` |
| `telegram_board`, `github_board`, `linkedin_board` | removed | `HomeBoard.astro` is imported by no page (PRD §4.6) |
| `hero_cta_click`, `hero_cta_exposure` | doc-only removal | A/B flag deactivated 2026-09-15; code already gone (PRD §4.6) |
| `hero_projects`, `hero_contact` | removed | never wired; `HeroCta.astro` deleted with the A/B test (2026-09-27). Live hero CTAs: `featured_project`, `featured_demo`, `featured_github` |
| `hero_cv`, `cv_footer`, `cv_pdf_footer`, `cv_source_github` | removed | CV unified into one "CV" download button → `cv_download_pdf` (2026-09-19); `/cv/` page deleted |
| `cv_download_pdf`, `cta_exposure` | removed | the CV was removed from the site on 2026-10-24 (every link, the rail that carried it, the `/cv/` redirect and the robots `Disallow`). Historical rows stay in PostHog |
| `cv_download`, `telegram_hero`, `telegram_header`, `flagship_case` | added, then `cv_download` removed same day | the CV came back on 2026-11-01 (site audit, wave 1) and the button was removed hours later on the owner's call, so `cv_download` is declared-and-retired in the same breath: never emitted in production, never accumulated a series. `telegram_hero` / `telegram_header` are live |
| `flagship_case` | removed | the hero's Volta proof card left the homepage on 2026-11-08 on the owner's call, and the event left `AnalyticsEventMap` with it — a typed event with no emitter is what `tests/lib/analytics-contract.test.ts` fails on. Historical rows stay in PostHog |
| `projects_shuffle` | removed | "Shuffle" button deleted with the category-view rewrite (2026-09-21); random order fought `PROJECT_ORDER` |
| `writing_footer` | removed | the "Статьи" header chip was deleted 2026-10-11 on the owner's call. `/writing/` moved into the drawer's link list (no event, like the other five nav links) and stays reachable from the homepage bento (`bento_writing`) and from post pages |
| `talk_opened` | renamed 2026-11-13 | `talk_open`: одно имя с сестринским `mm-program-page`. Historical rows stay in PostHog |

Historical rows for every retired/removed event stay in PostHog and must not be
deleted (PRD §0 rule 3).
