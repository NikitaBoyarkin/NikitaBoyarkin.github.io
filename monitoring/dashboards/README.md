# PostHog Dashboard Provisioning

Provisions PostHog dashboards for the portfolio site (project `451732`, Cloud US, `https://us.posthog.com`) from a single stdlib-only Python script.

Two sets live in the script:

| Set | Flag | Created | What it is |
|---|---|---|---|
| v1 | `--only v1` | 2026-09-28 | «Контент и вовлечение», «RU vs EN», «Контакт-конверсия 30д», «Games». Kept for reference; **partly dead** (below). |
| **v2** (default) | `--only v2` | 2026-10-18 | «01 · Трафик и источники», «02 · Воронка: визит → проект → контакт», «03 · Проекты и контент», «04 · Персоны и CTA», «05 · Здоровье аналитики». Every tile verified to return data. |

## v2 dashboards (created 2026-10-18)

| Dashboard | id | Tiles |
|---|---|---|
| [01 · Трафик и источники](https://us.posthog.com/project/451732/dashboard/2226427) | 2226427 | pageviews/visitors weekly; top paths; referring domains; first-touch class; `$session_entry_utm_source`; devices; browsers |
| [02 · Воронка: визит → проект → контакт](https://us.posthog.com/project/451732/dashboard/2226417) | 2226417 | visit→project→contact funnel; **home(/, /en/, legacy base)**→project→contact funnel; time-to-convert; home→/projects/; contact CTAs weekly; outbound domains |
| [03 · Проекты и контент](https://us.posthog.com/project/451732/dashboard/2226420) | 2226420 | top projects; `project_viewed` by surface; top posts; `read_depth` by depth and by content type; `/about` sections; filters by surface; search by surface (see note); library tiles |
| [04 · Персоны и CTA](https://us.posthog.com/project/451732/dashboard/2226421) | 2226421 | gate views vs unique visitors; persona choice; gate→choice funnel; choice by source; RU/EN pageviews; language switches; theme |
| [05 · Здоровье аналитики](https://us.posthog.com/project/451732/dashboard/2226422) | 2226422 | per-event volume + last-seen (HogQL); **expected-but-dead events (HogQL, re-synced from the repo)**; all-events daily; junk events from own pipelines; Web Vitals p75 by path; rageclicks by path; JS exceptions; games funnel |

Design rules the v2 set follows:

- **Every tile is verified against live data before it ships.** `verify_tiles.py` runs each tile's query through `POST /api/projects/{id}/query/`; `verify_dashboards.py` re-runs the queries *as stored on the dashboards* after creation. Both are read-only.
- **One layer per metric.** A click on an external CTA emits a frozen `[data-analytics]` event **and** `outbound_click` **and** `$autocapture` — counting two layers double-counts.
- **`$session_entry_utm_source`, not `utm_source`.** The plain property is present on only a fraction of `$pageview` rows (801 vs 148 in 90 days); the session-entry property is the complete one.
- **The homepage has three identities.** `/` (current), `/en/` (English), `/Personal_Projects.github.io/` (legacy base, still the top path in the data). Any home-scoped funnel must OR all three — the v1 funnel scope of `$pathname = "/"` silently dropped them.

### Known-empty tile (by design)

«Поиск: попадания и пустые» in dashboard 03 is **intentionally empty**: `search_used` / `search_no_results` have zero rows in 90 days, i.e. nobody opens the site search. The tile is the place that will show the first search ever made; it is not a broken query.

### The dead-event detector (dashboard 05)

«Ожидаемые, но мёртвые события (90д)» is the anti-rot tile. Its event list is **generated from the repo**, not typed by hand: `AnalyticsEventMap` keys in `src/lib/analytics.ts`, the §1–§2 tables of `docs/analytics-events.md`, and the games bundle's hardcoded names. The tile is marked `dynamic=True`, so `--apply` compares the stored SQL with the freshly generated one and `PATCH`es the insight when they differ — adding or renaming an event and re-running keeps the detector honest.

On 2026-10-18 it reported **32 of 54 declared events with zero rows in 90 days**. The zeroes sort to the top, and they mean one of three things — the tile description says which:

- not deployed yet (`surface` on the search events),
- deliberately inert (`contact_submit` / `contact_form_error` — `CONTACT_FORM_ENABLED=false`),
- dead code or a dead feature (`headline_*` before they were removed, games events before they shared the site's `distinct_id`).

Read it before trusting any other tile: a zero here means the dashboard that depends on that event is empty for a reason.

## Dead weight in the v1 set (audited 2026-10-18)

| Object | Status | Why |
|---|---|---|
| «Games» dashboard (2142405) | **all 4 tiles dead** | `game_selected` had 1 row in 90 days; the games bundle used `persistence: 'memory'`, so each game screen minted a fresh anonymous `distinct_id` and its events never joined the site session. Fixed in code 2026-10-18 (`localStorage+cookie` + a pre-init buffer); dashboard 05 tile «Игровой хаб» is the replacement to watch. |
| «Контент и вовлечение» (2142402) | **4 of 6 tiles dead** | `search_used`, `search_no_results`, `ask_me_used`, `random_post_click` all have zero rows in 90 days. `post_read` and `read_depth` tiles are alive. |
| «RU vs EN» (2142403) | alive, partly redundant | 2 of its 4 tiles restate «Портфолио — аналитика» (2024833) and the contact dashboard (2142404). |
| «Контакт-конверсия 30д» (2142404) | alive, thin; 1 wrong key | `$pageview` by plain `utm_source` should be `$session_entry_utm_source`; the funnel scoped home to `/` only. Both corrected in dashboard 02. |
| «Рекрутер» (1994322) | alive, thin | Its funnel (11015002) has the same `/`-only home scope; kept because the weekly ritual links to it. |

Nothing here deletes or edits a v1 object — the script only creates, so the historical dashboards stay as they are.

## The v1 set (2026-09-28, for reference)

Existing dashboards **1994322 «Рекрутер»** and **2024833 «Портфолио — аналитика»** are left untouched. Dashboard **1660826 «My App Dashboard»** (auto-starter) is slated for deletion — delete it manually in the PostHog UI; this script never deletes or modifies anything.

| Dashboard | Tiles |
|---|---|
| «Контент и вовлечение» | post_read by slug; read_depth 50 & 100; search_used vs search_no_results; top search queries (events table); ask_me_used total vs answer_matched=true; random_post_click |
| «RU vs EN» | $pageview by locale; lang_switched; project_viewed by locale; contact CTAs (telegram_contact, booking_click) by locale |
| «Контакт-конверсия 30д» | funnel $pageview "/" → project_viewed → booking_click; contact CTA trends; outbound_click by domain; $pageview by utm_source |
| «Games» | game_started unique users by game; funnel game_selected → game_started → game_win; daily_completed trend; contact_click by channel |

All v1 tiles are last 30 days, daily interval. Insights use the `query` node format (`TrendsQuery` / `FunnelsQuery` / `EventsQuery`) — the legacy top-level `filters` field is blocked by the API and is not used.

## API key

Create a personal API key in PostHog: **Settings → Personal API keys → + Create key**, with **read + write scopes for insights and dashboards**. Export it before running:

```bash
export POSTHOG_API_KEY="phx_..."   # never commit this value anywhere
```

The script reads `POSTHOG_API_KEY` from the environment only; it never prints or stores the key.

## Usage

```bash
python3 create_dashboards.py            # default: DRY RUN — prints payloads, zero network calls
python3 create_dashboards.py --only v2 --apply   # v2 set (default --only v2)
python3 create_dashboards.py --only v1 --apply   # the 2026-09-28 set
python3 create_dashboards.py --only all --apply  # both

# Read-only verification of what exists in PostHog (no writes):
python3 verify_tiles.py        # every v2 tile's query against live data
python3 verify_dashboards.py   # the same, but reading the queries back off the dashboards
```

`verify_dashboards.py` prints one line per tile: `ok`, `EMPTY` (query returns nothing) or `THIN` (returns rows, but the underlying events number fewer than `VOLUME_FLOOR = 10` in the window). `THIN` is not a bug — it is the volume rule from `docs/analytics-dead-events.md` made executable: at 5–27 unique visitors a week, a tile under 10 events per quarter cannot carry a conclusion, and should be read as "no signal yet" rather than "a number".

Optional environment overrides: `POSTHOG_PROJECT_ID` (default `451732`), `POSTHOG_HOST` (default `https://us.posthog.com`).

## Behavior notes

- **Dry run is the default.** Without `--apply` the script makes zero network calls and prints every JSON payload it would POST.
- **Idempotent per tile, not just per dashboard.** On `--apply` it lists dashboards, then for a dashboard that already exists it reads the attached insights and skips any tile whose name is already there. Re-running after a partial failure (the API drops connections intermittently) fills only the gaps — it never appends a second copy of a tile.
- **A failed tile read aborts that dashboard, it does not look "empty".** `existing_tiles` returns `None` (not `{}`) when the GET fails; the dashboard is skipped and reported. Treating a dropped connection as "no tiles" is what duplicated all nine tiles of dashboard 03 on 2026-10-18 before this was fixed; the duplicates were soft-deleted.
- **`dynamic=True` tiles are re-synced, the rest are skipped.** Use it for tiles whose query is generated from the repo (see the dead-event detector below).
- **Failures are contained and reported.** Any 4xx/5xx body goes to stderr, the run continues, and the exit code is non-zero when something failed — so a partial run is visible instead of silent. If the initial dashboard listing fails, the run aborts (rather than risk duplicates).
- **Funnel OR-steps.** A step that is "any of these events" is a `GroupNode` with `operator: "OR"` — that is how the contact step covers Telegram / LinkedIn / GitHub / cal.com, and how the home step covers `/`, `/en/` and the legacy base.
- **HogQL tiles are `DataTableNode`.** A top-level `DataTableNode` wrapping `HogQLQuery` is accepted; wrapping it in `InsightVizNode` is not (400: no `DataTableNode` tag).

## Verified API shapes (2026-10-18)

All of the following were confirmed against `us.posthog.com` — the v1 notes below are kept because they record what the first run checked, and the corrections are what the v2 builders use:

1. `dateRange` is `{"date_from": "-90d", "date_to": null, "explicitDate": true}` (v1) and `{"date_from": "-90d", "explicitDate": false}` (v2, matching what the API stores back).
2. **Tile attach**: `POST …/dashboards/{id}/tiles/` does **not** exist (404) and PATCHing the dashboard's `tiles` list returns 200 while changing nothing. The working route is `PATCH /insights/{insight_id}/ {"dashboards": [id]}`.
3. **Deleting an insight**: `DELETE /insights/{id}/` returns **405**; soft delete is `PATCH /insights/{id}/ {"deleted": true}`.
4. **HogQL**: a bare `HogQLQuery` or a top-level `DataTableNode` wrapping it both work; `InsightVizNode` with a `DataTableNode` source is rejected.
5. **All-events series**: `{"kind": "EventsNode", "event": null}` counts every event including SDK ones.
6. **Breakdowns**: `breakdownFilter.breakdowns` (array of `{type, property}`) is what current insights store; two breakdowns are allowed; `trendsFilter.display` accepts `ActionsLineGraph | ActionsTable | ActionsPie | ActionsBar`.
7. **Funnel steps**: a `GroupNode` with `operator: "OR"` works as a step; `funnelsFilter.funnelVizType: "time_to_convert"` works.
8. `EventsQuery` (v1 builder, still used by the v1 set) filters via HogQL `where: ["event = 'search_used'"]` and uses `after` rather than `dateRange`.
9. **Updating an insight**: `PATCH /insights/{id}/ {"query": …}` returns 200 and round-trips the query unchanged (verified 2026-10-18) — this is what the `dynamic` tile sync uses.
10. **HogQL CTE + `arrayJoin` + `LEFT JOIN`** works: `WITH expected AS (SELECT arrayJoin([…]) AS event), agg AS (…) SELECT … FROM expected LEFT JOIN agg ON …`. That is how the dead-event detector compares a static list against live data in one query.