# Analytics events — canonical reference

Canonical event taxonomy for the portfolio, per
`docs/prd-analytics-instrumentation.md` (REQ-A04). The first-class list mirrors
`AnalyticsEventMap` in `src/lib/analytics.ts` — keep the two in sync.

> Naming rule (PRD §4.1): `object_action`, `snake_case`; no identifier in the
> event name — the entity lives in a property.

Every event also lands in the Supabase sink next to PostHog — schema, property
allowlist and retention: `docs/supabase-analytics.md`.

## 1. First-class events (typed in `AnalyticsEventMap`)

| Event | Properties | Fires when | Where |
|---|---|---|---|
| `project_viewed` | `{ slug, locale, surface? }` | a project page loads, or a project link is clicked | `Analytics.astro` (page, `surface:'page'`), `ProjectCard.astro` (`surface:'card'`), `ProjectList.astro` (`surface:'list'`), `ProjectTable.astro` (`surface:'table'`), `ProjectViews.astro`'s fresh lens (`surface:'fresh'`); an unscoped `[data-analytics-project]` click falls back to `surface:'unknown'`. `surface:'headline'` is retired — see §4 |
| `post_read` | `{ slug, locale }` | a blog post page loads | `Analytics.astro` |
| `lang_switched` | `{ from, to, path }` | the RU/EN switch is clicked | `Analytics.astro` (special-cases `data-analytics="lang_switch_*"`) |
| `theme_change` | `{ theme }` | the theme toggle is clicked | `Base.astro` (bundled script) |
| `ask_me_used` | `{ matched_id, answer_matched, locale, question_source }` | a question is submitted in the Ask-me widget. `matched_id` is the corpus pair id or `null`; `question_source` is `typed` or `chip`. **No free text is sent** — the typed question stays in the browser | `AskMe.astro` |
| `random_post_click` | `{ slug, path }` | the random-post button is clicked | `BlogFilter.astro` |
| `section_viewed` | `{ section, path }` | an `/about` section enters the viewport at 50% (once per section), or is already above the mid-viewport when the lazy SDK init finishes (lazy-init credit). On `/about` the section now enters the viewport when its **tab becomes active** — including via a `#anchor` deep link — and sections inside inactive tabs are **not** emitted at page load | `Analytics.astro`, via `[data-analytics-section]` |
| `outbound_click` | `{ domain, url, surface, path, link }` | a link leaving the site is clicked. `link` is `host+path` (the sibling site narrows its own to `social:` / `cta:` / `portfolio:` slugs), so a cross-site tile groups on `domain` | `Analytics.astro` (delegated) |
| `search_used` | `{ query, results_count, locale, surface }` | a search with ≥1 result (`surface ∈ {header, explorer, glossary, hero, talks}`) | `SearchBox.astro` (truncated to 100 chars, once per distinct query), `ExplorerApp.astro` (`surface:'explorer'`, once per distinct query), `GlossaryFilter.astro` (`surface:'glossary'`), `TalksAnalytics.astro` (`surface:'talks'`, once per settled query after 800 ms idle) |
| `search_no_results` | `{ query, results_count: 0, locale, surface }` | a search with 0 results (`surface` as on `search_used`) | `SearchBox.astro`, `ExplorerApp.astro`, `GlossaryFilter.astro`, `TalksAnalytics.astro` |
| `search_result_click` | `{ query, rank, href, type, locale, surface }` | a search result is opened (`surface ∈ {header, explorer}`; `rank` is 1-based; modified clicks — new tab, download — are not counted) | `SearchBox.astro`, `ExplorerApp.astro` |
| `read_depth` | `{ content_type, slug, depth, locale }` | scroll crosses 25/50/75/100% (`content_type ∈ {post, case_study, note}`; depth 100 credits at ≤2px from the bottom — elastic scroll) | `Analytics.astro` |
| `filter_applied` | `{ tag, results_count, surface }` | a filter chip is applied — `surface` is `'writing'` (`BlogFilter.astro`), `'glossary'` (`GlossaryFilter.astro`), `'explorer'` (`ExplorerApp.astro`, `tag` shaped `facet:value`) or `'talks'` (`TalksAnalytics.astro`, `tag` shaped `day:<id>`, `day:all` or `reset`) | `BlogFilter.astro`, `GlossaryFilter.astro`, `ExplorerApp.astro`, `TalksAnalytics.astro` |
| `projects_track_filter` | `{ track, results_count, locale }` | a project category tab is selected (`track` is the taxonomy key or `all`) | `ProjectBoard.astro` and `ProjectList.astro` (the list carries the same tabs on `/colleague/`; the two never render together — one category means one series in PostHog) |
| `contact_submit` | `{ locale }` | the contact form was submitted and the Edge Function accepted it | `ContactForm.astro` (only on `res.ok`). **Inert in production** until `PROJECT_REF` in `src/lib/contact.ts` is replaced (`CONTACT_FORM_ENABLED=false`, so the form is not rendered at all). This is the contact form, not the analytics ingest sink — that one is live (see `docs/supabase-analytics.md`) |
| `contact_form_error` | `{ locale, reason }` | a contact-form submission failed (`reason ∈ {validation, rate_limited, server, network}`) | `ContactForm.astro`. **Inert in production** — same reason as `contact_submit` |
| `contact_page_view` | `{ locale }` | `/contact/` or `/en/contact/` loads — the funnel step `$pageview` alone could not name | `Analytics.astro` (page-load dispatch, once per load) |
| `booking_click` | `{ path, surface? }` | the booking CTA (`cal.com/lofinibo/bored-call-me`) is clicked. The contact page passes `surface:'contact_cta'` | `contact.astro` / `en/contact.astro`, via the delegated `[data-analytics]` handler in `Analytics.astro` |
| `contact_page_click` | `{ path, surface? }` | a link that opens the **contact page** (not the booking page) is clicked. `surface` names the placement: `nav` (the drawer's contact button — the only non-footer entry on a closed drawer), `footer`, `about_links` (the link row under `/about`), `case_next_step` (end of a project case), `volta_part_next_step` (end of a Volta chapter), `post_next_step` (end of a post), `projects_index` / `writing_index` (end of a catalog page), `role_hr_contact` / `role_manager_contact` / `role_colleague_contact` (end of a role landing) | `Base.astro` (drawer CTA + footer button), `content/about/{ru,en}.mdx` (link row), `NextStep.astro` (mounted by `projects/[slug].astro`, `projects/volta/[part].astro`, `projects/index.astro`, `writing/[...page].astro`, `RoleLanding.astro`, their EN twins and `Post.astro`), via `[data-analytics]` |
| `persona_selected` | `{ persona, lang, source }` | a persona is chosen (`source ∈ {gate, switch, header, menu}` — `header`/`menu` are `NavRoles`'s bar/drawer variants) | `NavRoles.astro`, `RoleSwitch.astro` |
| `library_tile` | `{ path }` | a library tile is clicked | `ReadingBlock.astro`, via `[data-analytics]` |
| `source_external` | `{ path }` | the "source ↗" link of a library entry is clicked. Currently **inert**: no library entry carries `url:`, so the link never renders | `ReadingBlock.astro`, `library/[slug].astro` (RU + EN), via `[data-analytics]` |
| `linkedin_contact` | `{ path }` | the LinkedIn CTA on the contact page is clicked (the contact page's LinkedIn channel, separate from `linkedin_footer`) | `contact.astro` / `en/contact.astro`, via `[data-analytics]` |
| `telegram_header` | `{ path }` | the labelled Telegram button in the top bar is clicked — separate from `telegram_footer` on the icon chip beside it, so the readable action and the recognisable one stay two series | `Base.astro` (top bar), via `[data-analytics]` |
| `telegram_hero` | `{ path }` | the homepage hero's Telegram CTA is clicked | `HomeNewTab.astro` (hero, `/` and `/en/`), via `[data-analytics]` |
| `bento_now` | `{ path }` | the «Сейчас»/«Now» bento cell's link to `/about/#now` is clicked — on the colleague landing (the homepage cell was removed 2026-11-04) | `NowCard.astro` (`variant="cell"`), via `[data-analytics]` |
| `tab_selected` | `{ tab, group, locale }` | a section tab is opened by click, arrow keys or a hash deep link. `group` names the tablist, so `/talks/`'s page tabs (`talks`), its twelve track tabs (`talks:tracks`) and its eleven theme tabs (`talks:themes`) stay three series. The panel open at page load is the baseline, not a choice, and is never emitted | `TalksAnalytics.astro`, only for `SectionTabs` roots that carry `data-analytics-group` (`/talks/`, `/en/talks/`) |
| `talk_open` | `{ talk_id, track_id, track, source, locale }` | a talk detail opens — `source` is the placement the click came from: `program`, `track`, `theme`, `graph`, `deeplink` (a shared `#t<id>` landing) or `other`. Modified clicks (new tab) are not counted. Name shared with the sister site `mm-program-page`. Join across sites on `talk_id`; break down tracks by `track_id` (the numeric id from the feed, identical in both languages). `track` is only a label and is English on `/en/talks/`, so it is not a key | `TalksAnalytics.astro`, driven by `TalkCard.astro`'s dialog |
| `talk_card_nav` | `{ direction, talk_id, locale }` | prev/next inside the talk dialog; `talk_id` is the talk moved **to** | `TalksAnalytics.astro`, driven by `TalkCard.astro` |
| `graph_node_click` | `{ graph, node_kind, node_id, locale }` | a node of a `ProjectGraph` instance that opted in is clicked or activated with Space. `graph` is the instance `idPrefix` (`talks-overview`, `talks-track-<slug>`), `node_id` the payload id (`talk:277`, `track:avito`, `theme:ai`, `event:program`), `node_kind` its prefix. A press that ended a drag is not counted; the external `event:program` node may lose its event when the browser navigates before the SDK attaches | `ProjectGraph.astro`, opt-in via the `analytics` prop (`/talks/`) |

> **`/talks/` layering.** A click on a talk node in a graph emits both
> `graph_node_click` (the graph was used) and `talk_open` (the content was
> opened); a click on a *track* node emits `graph_node_click` plus **two**
> `tab_selected` rows — the page tablist opens the tracks panel and the nested
> track tablist selects that track. Count one layer per question and never sum
> `tab_selected` across groups.

> `booking_click` carries `{ path, surface? }`, not `{ locale }`: the delegated
> handler owns every `[data-analytics]` CTA and attaches the same props to all of
> them (the contact page's `surface` is `contact_cta`). The locale is recoverable
> from the event's URL (`/en/contact/` vs `/contact/`).

> **Placements.** Any `[data-analytics]` element may also carry
> `data-analytics-surface="<placement>"`; the delegated handler then adds
> `surface` to the event props. `contact_page_click` is the event that uses it
> most: `nav`, `footer`, `about_links`, `case_next_step`,
> `volta_part_next_step`, `post_next_step`, `projects_index`, `writing_index`,
> `role_hr_contact`, `role_manager_contact`, `role_colleague_contact`. The three
> contact-page CTAs
> (`booking_click`, `telegram_deeplink`, `linkedin_contact`) carry
> `surface:'contact_cta'`. The mechanism was introduced for the desktop CTA rail
> (`surface:'home_rail'`), retired with the CV on 2026-10-24, and sat unused until
> 2026-10-31. Add the attribute to any new CTA whose exposure you intend to
> count.

### Super properties (registered once per load, PRD §4.2)

| Property | Values |
|---|---|
| `site` | `portfolio`; сестринский `mm-program-page` регистрирует своё значение, так два сайта не складываются в одну серию |
| `locale` | `ru` \| `en` |
| `audience` | `hr` \| `manager` \| `colleague` \| `null` (read from `localStorage['audience']`; written by `HeroGate.astro`, `RoleSwitch.astro`, `NavRoles.astro`) |
| `theme` | `dark` \| `light` \| `cyberpunk` |
| `prefers_reduced_motion` | boolean |
| `initial_referrer_class` | `linkedin` \| `github` \| `google` \| `direct` \| `other` \| `own-site` |
| `initial_referrer_path` | string \| `null` — путь на источнике, только у `own-site` (переход с `/mm-program-page/`) |
| `landing_path` | string |
| `first_utm_{source,medium,campaign,content,term}` | string \| `null` (first-touch `?utm_*`; sessionStorage, fallback localStorage, written once) |
| `visit_utm_{source,medium,campaign,content,term}` | string \| `null` (this tab's `?utm_*`; sessionStorage, first tagged page of the visit) |

Values are captured verbatim — normalization belongs to link building, not to the client.

> **Межсайтовая воронка (2026-11-13).** Два сайта в одном проекте: разделять
> только по `site`. Переход из `mm-program-page` виден по `visit_utm_source`
> либо по `own-site` + `initial_referrer_path` (вставленная ссылка, back-nav);
> раньше второй случай читался как `github`. Тайлы — дашборд 07, см.
> `monitoring/dashboards/README.md`.

## 2. Preserved CTA events (`data-analytics`, frozen names)

These keep their historical names (they are the slider for the "hard naming" case, they have data), and are emitted by the delegated click handler in `Analytics.astro`.

| Event | Where |
|---|---|
| `featured_project`, `featured_demo`, `featured_github` | `RoleLanding.astro` — **colleague role pages only** (`/colleague/`, `/en/colleague/`). The homepage hero does not render them |
| `bento_stack` | `StackCard.astro` (via `RoleLanding`) — every role landing **except `manager`** (`hr` + `colleague`, RU + EN); `RoleLanding.astro` gates it with `role !== 'manager'` |
| `bento_notes`, `bento_shelf`, `bento_writing` | `RoleLanding.astro` — colleague role pages (`bento_notes` RU only) |
| `telegram_deeplink`, `telegram_footer`, `telegram_header`, `telegram_hero` | `contact.astro`, `Base.astro` nav chips, `HomeNewTab.astro` hero. There is **no** `telegram_contact` event — dashboards must OR these four |
| `linkedin_contact`, `linkedin_footer` | `contact.astro`, `Base.astro` nav chips |
| `github_footer`, `linkedin_footer` | `Base.astro` nav chips (moved out of the footer 2026-10-10; the `_footer` suffix is kept so the PostHog series does not split) |
| `value_cta`, `work_with_me_cta`, `whois_cta` | `about/{ru,en}.mdx` via `TelegramCta.astro`, in the `/about` tab panels — `value_cta` → `#value`, `work_with_me_cta` → `#work`, `whois_cta` → `#stack` |
| `value_github` | `ValueOffers.astro` on `/about#value` |
| `search_open` | `SearchBox.astro` |
| `ask_me_open` | `AskMe.astro` |
| `hero_avatar_3d` | `HeroAvatar.astro` (hero avatar interaction) |
| `project_demo_<slug>`, `project_github_<slug>` | `ProjectCard.astro`, `ProjectTable.astro` (the table's GitHub column) |
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

The ledger of retired and renamed events moved to
[`docs/analytics-retired-events.md`](analytics-retired-events.md), so this file
stays a description of what the site emits now. Historical rows stay in PostHog
and must not be deleted (PRD §0 rule 3).
