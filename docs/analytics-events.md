# Analytics events — canonical reference

Canonical event taxonomy for the portfolio, per
`docs/prd-analytics-instrumentation.md` (REQ-A04). The first-class list mirrors
`AnalyticsEventMap` in `src/lib/analytics.ts` — keep the two in sync.

> Naming rule (PRD §4.1): `object_action`, `snake_case`; no identifier in the
> event name — the entity lives in a property.

## 1. First-class events (typed in `AnalyticsEventMap`)

| Event | Properties | Fires when | Where |
|---|---|---|---|
| `project_viewed` | `{ slug, locale, surface? }` | a project page loads, or a project link is clicked | `Analytics.astro` (page, `surface:'page'`), `ProjectCard.astro` / `HeadlineCases.astro` (`surface:'card'`/`'headline'`) |
| `post_read` | `{ slug, locale }` | a blog post page loads | `Analytics.astro` |
| `lang_switched` | `{ from, to, path }` | the RU/EN switch is clicked | `Analytics.astro` (special-cases `data-analytics="lang_switch_*"`) |
| `theme_change` | `{ theme }` | the theme toggle is clicked | `Base.astro` (bundled script) |
| `ask_me_used` | `{ question (≤100 chars), answer_matched, locale }` | a question is submitted in the Ask-me widget | `AskMe.astro` |
| `random_post_click` | `{ slug, path }` | the random-post button is clicked | `BlogFilter.astro` |
| `section_viewed` | `{ section, path }` | an `/about` section enters the viewport at 50% (once per section), or is already above the mid-viewport when the lazy SDK init finishes (lazy-init credit) | `Analytics.astro`, via `[data-analytics-section]` |
| `outbound_click` | `{ domain, url, surface, path }` | a link leaving the site is clicked | `Analytics.astro` (delegated) |
| `search_used` | `{ query, results_count, locale }` | a search with ≥1 result | `SearchBox.astro` (truncated to 100 chars, once per panel) |
| `search_no_results` | `{ query, results_count: 0, locale }` | a search with 0 results | `SearchBox.astro` |
| `read_depth` | `{ content_type, slug, depth, locale }` | scroll crosses 25/50/75/100% (`content_type ∈ {post, case_study, note}`; depth 100 credits at ≤2px from the bottom — elastic scroll) | `Analytics.astro` |
| `filter_applied` | `{ tag, results_count, surface }` | a writing-page filter chip is applied (`surface` is always `'writing'` — `BlogFilter.astro` renders only on writing pages) | `BlogFilter.astro` |
| `projects_track_filter` | `{ track, results_count, locale }` | a project category tab is selected (`track` is the taxonomy key or `all`) | `ProjectBoard.astro` |
| `contact_submit` | `{ locale }` | the contact form was submitted and the Edge Function accepted it | `ContactForm.astro` (only on `res.ok`). **Inert in production** until `PROJECT_REF` in `src/lib/contact.ts` is replaced (`CONTACT_FORM_ENABLED=false`, so the form is not rendered at all) |
| `contact_form_error` | `{ locale, reason }` | a contact-form submission failed (`reason ∈ {validation, rate_limited, server, network}`) | `ContactForm.astro`. **Inert in production** — same reason as `contact_submit` |
| `booking_click` | `{ path }` | the 30-minute booking CTA (`cal.com/lofinibo/30min`) is clicked | `Base.astro` nav rail, `contact.astro` / `en/contact.astro`, via the delegated `[data-analytics]` handler in `Analytics.astro` |

> `booking_click` carries `{ path }`, not `{ locale }`: the delegated handler owns
> every `[data-analytics]` CTA and attaches the same props to all of them. The
> locale is recoverable from the event's URL (`/en/contact/` vs `/contact/`).

### Super properties (registered once per load, PRD §4.2)

| Property | Values |
|---|---|
| `locale` | `ru` \| `en` |
| `audience` | `recruiter` \| `analyst` \| `learner` \| `null` (read from `localStorage['audience']`; no selector UI currently writes it) |
| `theme` | `dark` \| `light` \| `cyberpunk` |
| `prefers_reduced_motion` | boolean |
| `initial_referrer_class` | `linkedin` \| `github` \| `google` \| `direct` \| `other` |
| `landing_path` | string |

## 2. Preserved CTA events (`data-analytics`, frozen names)

These keep their historical names (they are the slider for the "hard naming" case, they have data), and are emitted by the delegated click handler in `Analytics.astro`.

| Event | Where |
|---|---|
| `featured_project`, `featured_demo`, `featured_github` | `index.astro` / `en/index.astro` (hero CTAs) |
| `bento_stack`, `bento_graph`, `bento_notes` | `index.astro` / `en/index.astro` |
| `cv_download_pdf` | every "CV" button: `Base.astro` nav rail + footer, `contact.astro` / `en/contact.astro` |
| `telegram_contact`, `telegram_deeplink`, `telegram_footer` | `contact.astro`, `Base.astro` footer |
| `github_footer`, `linkedin_footer`, `writing_footer` | `Base.astro` footer |
| `value_cta`, `value_github` | `value.astro` / `en/value.astro` |
| `work_with_me_cta`, `whois_cta` | `about.astro` / `en/about.astro` |
| `search_open` | `SearchBox.astro` |
| `ask_me_open` | `AskMe.astro` |
| `linkedin_badge_load` | `LinkedInBadge.astro` |
| `hero_avatar_3d` | `HeroAvatar.astro` (hero avatar interaction) |
| `headline_all_projects`, `headline_demo_<slug>`, `headline_github_<slug>`, `more_project_<slug>` | `HeadlineCases.astro` |
| `project_demo_<slug>`, `project_github_<slug>` | `ProjectCard.astro` |
| `projects_reset` | `ProjectBoard.astro` |
| `game_selected`, `game_started`, `game_over`, `game_win`, `daily_completed`, `best_broken`, `sig_reached`, `experiment_started`, `milestone`, `contact_click` | `public/games/**` |
| `lang_switch_ru`, `lang_switch_en` | `LangSwitch.astro` (mapped to `lang_switched`) |

> Known debt: `project_demo_<slug>`, `project_github_<slug>`, `headline_demo_<slug>`,
> `headline_github_<slug>`, `more_project_<slug>` still embed the slug in the
> event name (PRD §4.1 prefers a property). They are retained because they carry
> history; canonicalizing them is a separate, opt-in step.

> Games hub note: `public/games/index.html` maps card hrefs to the short
> in-game `GAME` keys (`ab-test` → `abtest`, …), so `game_selected` joins with
> in-game events on the same `game` property.

## 3. SDK / auto-captured events

`$pageview`, `$pageleave`, `$web_vitals`, `$autocapture`, `$rageclick`,
`$dead_click` — emitted by `posthog-js`. `$exception` is not yet captured (error
tracking off; PRD Phase A4).

> Layering note: a click on an external CTA emits both the frozen
> `[data-analytics]` event and `outbound_click` (plus `$autocapture`) — up to
> three rows for one click. Dashboards and funnels must count a single layer,
> never sum across them.

## 4. Retired / removed

| Event | Status | Why |
|---|---|---|
| `project_view_<slug>` | retired | replaced by `project_viewed { slug, surface }` (PRD §4.5) |
| `headline_case_<slug>` | retired | replaced by `project_viewed { slug, surface:'headline' }` |
| `case_study_read` | retired | replaced by `read_depth { content_type:'case_study', depth:75 }` |
| `whois_viewed`, `value_viewed`, `work-with-me_viewed` | removed | routes 308-redirect to `/about`; events could never fire again (PRD §4.6) |
| `telegram_board`, `github_board`, `linkedin_board` | removed | `HomeBoard.astro` is imported by no page (PRD §4.6) |
| `hero_cta_click`, `hero_cta_exposure` | doc-only removal | A/B flag deactivated 2026-09-15; code already gone (PRD §4.6) |
| `hero_projects`, `hero_contact` | removed | never wired; `HeroCta.astro` deleted with the A/B test (2026-09-27). Live hero CTAs: `featured_project`, `featured_demo`, `featured_github` |
| `hero_cv`, `cv_footer`, `cv_pdf_footer`, `cv_source_github` | removed | CV unified into one "CV" download button → `cv_download_pdf` (2026-09-19); `/cv/` page deleted |
| `projects_shuffle` | removed | "Shuffle" button deleted with the category-view rewrite (2026-09-21); random order fought `PROJECT_ORDER` |

Historical rows for every retired/removed event stay in PostHog and must not be
deleted (PRD §0 rule 3).
