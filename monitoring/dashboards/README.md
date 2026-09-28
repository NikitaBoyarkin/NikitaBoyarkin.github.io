# PostHog Dashboard Provisioning

Provisions four PostHog dashboards for the portfolio site (project `451732`, Cloud US, `https://us.posthog.com`) from a single stdlib-only Python script. Existing dashboards **1994322 «Рекрутер»** and **2024833 «Портфолио — аналитика»** are left untouched. Dashboard **1660826 «My App Dashboard»** (auto-starter) is slated for deletion — delete it manually in the PostHog UI; this script never deletes or modifies anything.

## Dashboards created

| Dashboard | Tiles |
|---|---|
| «Контент и вовлечение» | post_read by slug; read_depth 50 & 100; search_used vs search_no_results; top search queries (events table); ask_me_used total vs answer_matched=true; random_post_click |
| «RU vs EN» | $pageview by locale; lang_switched; project_viewed by locale; contact CTAs (cv_download_pdf, telegram_contact, booking_click) by locale |
| «Контакт-конверсия 30д» | funnel $pageview "/" → project_viewed → cv_download_pdf; contact CTA trends; outbound_click by domain; $pageview by utm_source |
| «Games» | game_started unique users by game; funnel game_selected → game_started → game_win; daily_completed trend; contact_click by channel |

All tiles are last 30 days, daily interval. Insights use the `query` node format (`TrendsQuery` / `FunnelsQuery` / `EventsQuery`) — the legacy top-level `filters` field is blocked by the API and is not used.

## API key

Create a personal API key in PostHog: **Settings → Personal API keys → + Create key**, with **read + write scopes for insights and dashboards**. Export it before running:

```bash
export POSTHOG_API_KEY="phx_..."   # never commit this value anywhere
```

The script reads `POSTHOG_API_KEY` from the environment only; it never prints or stores the key.

## Usage

```bash
python3 create_dashboards.py            # default: DRY RUN — prints payloads, zero network calls
python3 create_dashboards.py --apply   # actually creates dashboards + insights + tiles
```

Optional environment overrides: `POSTHOG_PROJECT_ID` (default `451732`), `POSTHOG_HOST` (default `https://us.posthog.com`).

## Behavior notes

- **Dry run is the default.** Without `--apply` the script makes zero network calls and prints every JSON payload it would POST.
- **Idempotent on `--apply`.** It first GETs the dashboard list; a dashboard whose name already exists is reported as `exists, skipped`. Re-running never duplicates dashboards.
- **Failures are contained.** Any 4xx/5xx response body is printed to stderr and the run continues to the next object — one bad tile never aborts the whole provisioning. If the initial dashboard listing fails, the run aborts (rather than risk duplicates).
- **Funnel OR-steps.** The contact funnel is encoded with a single event per step (`$pageview "/"` → `project_viewed` → `cv_download_pdf`), because base `FunnelsQuery` does not express OR across events within one step. If per-step OR is needed later, create custom events in PostHog or duplicate the funnel with alternative step events.

## Unverified API shapes (check on first `--apply`)

These could not be verified offline; the first `--apply` run will surface them as printed 4xx bodies if wrong:

1. `dateRange` is encoded as `{"date_from": "-30d", "date_to": null, "explicitDate": true}`. If the API rejects it, try `{"days": 30}`.
2. Tile attach uses `POST /api/projects/{id}/dashboards/{dashboard_id}/tiles/` with `{"insight": <id>}`; fallback (read dashboard → append tile → `PATCH`) may use a different tiles shape.
3. `EventsQuery` filters events via HogQL `where: ["event = 'search_used'"]`.
4. `EventsNode` math `"unique_users"` for unique-user trend series.
5. `breakdown` + `breakdownFilter: {"breakdown_type": "event"}` for event-property breakdowns (`locale`, `slug`, `domain`, `utm_source`, `game`, `channel`).
6. `$pathname` as the property key for the funnel's first step (`"/"`); boolean `answer_matched = true` matching; numeric `depth = 50/100` exact matching.