# Analytics events — canonical reference

Canonical event taxonomy for the portfolio, per
`docs/prd-analytics-instrumentation.md` (REQ-A04). The first-class list mirrors
`AnalyticsEventMap` in `src/lib/analytics.ts` — keep the two in sync.

> Naming rule (PRD §4.1): `object_action`, `snake_case`; no identifier in the
> event name — the entity lives in a property.

## 1. First-class events (typed in `AnalyticsEventMap`)

| Event | Properties | Fires when | Where |
|---|---|---|---|
| `project_viewed` | `{ slug, locale, surface? }` | a project page loads, or a project link is clicked | `Analytics.astro` (page, `surface:'page'`), `ProjectCard.astro` (`surface:'card'`), `ProjectList.astro` (`surface:'list'`); an unscoped `[data-analytics-project]` click falls back to `surface:'unknown'`. `surface:'headline'` is retired — see §4 |
| `post_read` | `{ slug, locale }` | a blog post page loads | `Analytics.astro` |
| `lang_switched` | `{ from, to, path }` | the RU/EN switch is clicked | `Analytics.astro` (special-cases `data-analytics="lang_switch_*"`) |
| `theme_change` | `{ theme }` | the theme toggle is clicked | `Base.astro` (bundled script) |
| `ask_me_used` | `{ question (≤100 chars), answer_matched, locale }` | a question is submitted in the Ask-me widget | `AskMe.astro` |
| `random_post_click` | `{ slug, path }` | the random-post button is clicked | `BlogFilter.astro` |
| `section_viewed` | `{ section, path }` | an `/about` section enters the viewport at 50% (once per section), or is already above the mid-viewport when the lazy SDK init finishes (lazy-init credit). On `/about` the section now enters the viewport when its **tab becomes active** — including via a `#anchor` deep link — and sections inside inactive tabs are **not** emitted at page load | `Analytics.astro`, via `[data-analytics-section]` |
| `outbound_click` | `{ domain, url, surface, path }` | a link leaving the site is clicked | `Analytics.astro` (delegated) |
| `search_used` | `{ query, results_count, locale, surface }` | a search with ≥1 result (`surface ∈ {header, glossary}`) | `SearchBox.astro` (truncated to 100 chars, once per panel) and `GlossaryFilter.astro` (both `surface:'glossary'`) |
| `search_no_results` | `{ query, results_count: 0, locale, surface }` | a search with 0 results | `SearchBox.astro`, `GlossaryFilter.astro` |
| `read_depth` | `{ content_type, slug, depth, locale }` | scroll crosses 25/50/75/100% (`content_type ∈ {post, case_study, note}`; depth 100 credits at ≤2px from the bottom — elastic scroll) | `Analytics.astro` |
| `filter_applied` | `{ tag, results_count, surface }` | a filter chip is applied — `surface` is `'writing'` (`BlogFilter.astro`) or `'glossary'` (`GlossaryFilter.astro`) | `BlogFilter.astro`, `GlossaryFilter.astro` |
| `projects_track_filter` | `{ track, results_count, locale }` | a project category tab is selected (`track` is the taxonomy key or `all`) | `ProjectBoard.astro` and `ProjectList.astro` (the list carries the same tabs on `/colleague/`; the two never render together — one category means one series in PostHog) |
| `contact_submit` | `{ locale }` | the contact form was submitted and the Edge Function accepted it | `ContactForm.astro` (only on `res.ok`). **Inert in production** until `PROJECT_REF` in `src/lib/contact.ts` is replaced (`CONTACT_FORM_ENABLED=false`, so the form is not rendered at all) |
| `contact_form_error` | `{ locale, reason }` | a contact-form submission failed (`reason ∈ {validation, rate_limited, server, network}`) | `ContactForm.astro`. **Inert in production** — same reason as `contact_submit` |
| `booking_click` | `{ path }` | the 30-minute booking CTA (`cal.com/lofinibo/30min`) is clicked | `contact.astro` / `en/contact.astro`, via the delegated `[data-analytics]` handler in `Analytics.astro` |
| `persona_selected` | `{ persona, lang, source }` | a persona is chosen (`source ∈ {gate, switch, header, menu}` — `header`/`menu` are `NavRoles`'s bar/drawer variants) | `NavRoles.astro`, `RoleSwitch.astro` |
| `library_tile` | `{ path }` | a library tile is clicked | `ReadingBlock.astro`, via `[data-analytics]` |
| `source_external` | `{ path }` | the "source ↗" link of a library entry is clicked. Currently **inert**: no library entry carries `url:`, so the link never renders | `ReadingBlock.astro`, `library/[slug].astro` (RU + EN), via `[data-analytics]` |
| `linkedin_contact` | `{ path }` | the LinkedIn CTA on the contact page is clicked (the contact page's LinkedIn channel, separate from `linkedin_footer`) | `contact.astro` / `en/contact.astro`, via `[data-analytics]` |

> `booking_click` carries `{ path }`, not `{ locale }`: the delegated handler owns
> every `[data-analytics]` CTA and attaches the same props to all of them. The
> locale is recoverable from the event's URL (`/en/contact/` vs `/contact/`).

> **Placements.** Any `[data-analytics]` element may also carry
> `data-analytics-surface="<placement>"`; the delegated handler then adds
> `surface` to the event props. No placement uses it today — the only one was the
> desktop CTA rail (`surface:'home_rail'`), retired with the CV on 2026-10-24.
> Add the attribute to any new CTA whose exposure you intend to count.

### Super properties (registered once per load, PRD §4.2)

| Property | Values |
|---|---|
| `locale` | `ru` \| `en` |
| `audience` | `hr` \| `manager` \| `colleague` \| `null` (read from `localStorage['audience']`; written by `HeroGate.astro`, `RoleSwitch.astro`, `NavRoles.astro`) |
| `theme` | `dark` \| `light` \| `cyberpunk` |
| `prefers_reduced_motion` | boolean |
| `initial_referrer_class` | `linkedin` \| `github` \| `google` \| `direct` \| `other` |
| `landing_path` | string |

## 2. Preserved CTA events (`data-analytics`, frozen names)

These keep their historical names (they are the slider for the "hard naming" case, they have data), and are emitted by the delegated click handler in `Analytics.astro`.

| Event | Where |
|---|---|
| `featured_project`, `featured_demo`, `featured_github` | `RoleLanding.astro` — **colleague role pages only** (`/colleague/`, `/en/colleague/`). The homepage hero does not render them |
| `bento_stack` | `StackCard.astro` (via `RoleLanding`) — all six role pages |
| `bento_notes`, `bento_shelf`, `bento_writing` | `RoleLanding.astro` — colleague role pages (`bento_notes` RU only) |
| `telegram_contact`, `telegram_deeplink`, `telegram_footer` | `contact.astro`, `Base.astro` nav chips |
| `github_footer`, `linkedin_footer` | `Base.astro` nav chips (moved out of the footer 2026-10-10; the `_footer` suffix is kept so the PostHog series does not split) |
| `value_cta`, `work_with_me_cta`, `whois_cta` | `about/{ru,en}.mdx` via `TelegramCta.astro` on `/about#value` |
| `value_github` | `ValueOffers.astro` on `/about#value` |
| `search_open` | `SearchBox.astro` |
| `ask_me_open` | `AskMe.astro` |
| `hero_avatar_3d` | `HeroAvatar.astro` (hero avatar interaction) |
| `project_demo_<slug>`, `project_github_<slug>` | `ProjectCard.astro` |
| `projects_reset` | `ProjectBoard.astro` |
| `game_selected`, `game_started`, `game_over`, `game_win`, `daily_completed`, `best_broken`, `sig_reached`, `experiment_started`, `milestone`, `contact_click` | `public/games/**` |
| `lang_switch_ru`, `lang_switch_en` | `LangSwitch.astro` (mapped to `lang_switched`) |

> Known debt: `project_demo_<slug>` and `project_github_<slug>` still embed the
> slug in the event name (PRD §4.1 prefers a property). They are retained because
> they carry history; canonicalizing them is a separate, opt-in step. The old
> `headline_*` / `more_project_*` family was **never wired** — see §4.

> Games hub note: `public/games/index.html` maps card hrefs to the short
> in-game `GAME` keys (`ab-test` → `abtest`, …), so `game_selected` joins with
> in-game events on the same `game` property.

## 3. SDK / auto-captured events

`$pageview`, `$pageleave`, `$web_vitals`, `$autocapture`, `$rageclick`,
`$dead_click`, `$exception` — emitted by `posthog-js`. Exception autocapture is
on since 12.10.2026 (`capture_exceptions: true` in `Analytics.astro` plus
`autocapture_exceptions_opt_in` on the project; closes PRD Phase A4).

> Layering note: a click on an external CTA emits both the frozen
> `[data-analytics]` event and `outbound_click` (plus `$autocapture`) — up to
> three rows for one click. Dashboards and funnels must count a single layer,
> never sum across them.

### Known capture losses (and what is done about them)

The SDK is lazy: it loads on the first `pointerdown` / `keydown` / `scroll` /
`touchstart`, and on idle (fallback 1200 ms). That creates two windows:

| Window | What can be lost | Status |
|---|---|---|
| A capture that *causes* a navigation (the "random post" button sets `window.location`) before the SDK attaches | the click event, because the pre-attach buffer dies with the page | **fixed 2026-10-18** — `whenAnalyticsReady()` waits (bounded, 150 ms) for the attach and navigates anyway if analytics never loads |
| A plain `<a href>` click that is the very first interaction, when the chunk is slower than the gap between `pointerdown` and the browser's navigation | the same buffer loss; navigation belongs to the browser, so it cannot be delayed without hijacking links | **accepted** — mitigated only by the `pointerdown` trigger (usually 50–150 ms of head start). Do not build a metric on a single first-click event |
| A visitor who bounces before idle init (no interaction at all) | `$pageview` and the load-time custom events | **mitigated** — idle fallback lowered from 3500 ms to 1200 ms on 2026-10-18 |

## 4. Retired / removed

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
| `cv_download_pdf`, `cta_exposure` | removed | the CV was removed from the site on 2026-10-24 (every link, the rail that carried it, the `/cv/` redirect and the robots `Disallow`). Historical rows stay in PostHog; re-adding a CV needs both events back |
| `projects_shuffle` | removed | "Shuffle" button deleted with the category-view rewrite (2026-09-21); random order fought `PROJECT_ORDER` |
| `writing_footer` | removed | the "Статьи" header chip was deleted 2026-10-11 on the owner's call. `/writing/` moved into the drawer's link list (no event, like the other five nav links) and stays reachable from the homepage bento (`bento_writing`) and from post pages |

Historical rows for every retired/removed event stay in PostHog and must not be
deleted (PRD §0 rule 3).
