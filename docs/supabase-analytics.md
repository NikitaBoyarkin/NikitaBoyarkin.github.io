# Supabase analytics — the second event sink

The site reports every visitor-facing event to two independent stores:
PostHog (the UI it has always had) and a Supabase Postgres project of our own.
This document covers the second one — its schema, what it accepts, how long it
keeps it, and how to read it. The event taxonomy itself stays canonical in
`docs/analytics-events.md`.

Why: PostHog answers "how many people clicked the CV", but its own SQL surface
is the only way to join that against *what content exists*. Owning the rows
means `project_viewed` can be joined to the project table, and a funnel is one
`GROUP BY` rather than an export.

## 1. Shape

```
browser ──sendBeacon(text/plain)──► Edge Function `ingest` ──RPC──► analytics_events
   │                                   (verify_jwt = false, rate-limited)
   └──track()──► PostHog (unchanged)

CI (nightly + push) ──service_role──► site_projects / site_posts
```

`sendBeacon` with a string body sends `text/plain`, which is CORS-safelisted —
so the request carries no preflight. The trade-off is that the client cannot
read the response at all, so `ingest` answers `204` for every outcome a visitor
can cause. Rejections are logged in the function's console, not reported.

Sector split is deliberate: `analytics_events` has **RLS on and zero policies**,
so nothing but `service_role` (the function itself) can read or write it. The
content tables are public read (non-draft, non-private rows), because the same
content already ships as HTML.

## 2. Files

| File | Purpose |
|---|---|
| `supabase/config.toml` | `project_id`, `[functions.ingest] verify_jwt = false` |
| `supabase/migrations/20261108000000_analytics_events.sql` | the event table, indexes, RLS on with zero policies |
| `supabase/migrations/20261108000100_insert_analytics_events.sql` | RPC that does the insert + per-IP rate limit |
| `supabase/migrations/20261108000200_site_content.sql` | `site_projects` / `site_posts`, public read |
| `supabase/migrations/20261108000300_analytics_views.sql` | the four read views |
| `supabase/functions/ingest/` | `index.ts` (env + serve), `handler.ts`, `payload.ts`, `limits.ts`, three offline tests |
| `scripts/sync-supabase-content.mjs` | registry + post frontmatter → content tables |
| `src/lib/ingest.ts` | client: endpoint constant, build-time gate, `sendIngest` |
| `src/components/Ingest.astro` | pageview on load, gated by `INGEST_ENABLED` |

## 3. What an event may carry

Event names are validated by **shape**, not by a frozen list:
`/^[a-z][a-z0-9_]{0,39}$/`. The site has ~40 `data-analytics` names and counting;
an enumerated allowlist would silently drop each new one until somebody
remembered to update it. The shape rule still stops free text from becoming a
metric name.

Properties are an allowlist (`supabase/functions/ingest/limits.ts`):

```
slug, locale, path, surface, tag, section, content_type, depth, results_count,
rank, href, type, domain, theme, persona, lang, source, matched_id,
answer_matched, question_source, track, query, tab, group, talk_id, direction,
graph, node_kind, node_id
```

Anything else is dropped before the insert. Two deliberate exclusions:

- **`outbound_click.url`** — full URLs can carry session tokens and query
  strings; `domain` already answers "where did they go". Keeping the URL would
  make the no-PII claim below false.
- **Free text** — `ask_me_used` sends `matched_id` and `question_source`, never
  the typed question. `search_used.query` is the one free-text field, truncated
  to 100 characters.

Caps: name 60 chars, `session_id` 8–64, `path` 512, strings 300, 24 props per
event, 25 events per request, 120 requests per minute per `ip_hash`.

Bots are filtered by user-agent (`BOT_UA_RE`) and dropped with a `204` before
the insert.

## 4. Retention

**Events are kept indefinitely.** No purge cron, no TTL. The owner's call: a
personal site produces little enough data that a time series across years is
worth more than the storage, and a nightly delete is one more thing that can
silently fail.

Rows are ordered by `client_ts` (the client's clock), not `received_at`;
`received_at` exists for debugging clock skew. Every view uses
`coalesce(client_ts, created_at)` so a row with no client timestamp still lands
on a day.

## 5. Reading it

All four views are `security_invoker = true` and granted to `service_role`
only. A default (definer) view is owned by `postgres` and therefore bypasses the
underlying RLS — an analytics view granted to `anon` would leak every event
despite the table having zero policies. The content views need the invoker's own
SELECT grant, which `20261108000200_site_content.sql` gives to `anon`.

| View | Answers |
|---|---|
| `v_daily_traffic` | pageviews, sessions, distinct visitors, errors per day |
| `v_top_paths_30d` | the 30-day pageview ranking |
| `v_cta_daily` | every non-pageview event per day (the CTA series) |
| `v_project_views` | `project_viewed` per project slug, joined to its title and locale |

Example — projects that get looked at but never opened:

```sql
select p.slug, p.title, count(e.id) as card_clicks
from public.site_projects p
join public.analytics_events e
  on e.event_name = 'project_viewed'
 and e.props->>'slug' = p.slug
 and e.props->>'surface' = 'card'
where e.event_name = 'project_viewed'
  and not exists (
    select 1 from public.analytics_events v
    where v.event_name = 'project_viewed'
      and v.props->>'slug' = p.slug
      and v.props->>'surface' = 'page'
  )
group by 1, 2
order by card_clicks desc;
```

## 6. Deploying

The sink runs on the owner's existing project `geojpakugqlcwyhtnjvv`
(«NikitaBoyarkin's Project», eu-west-1). That project keeps its own tables in
the `analytics` and `experiments` schemas; every object this repository creates
lives in `public`, so the two do not overlap. Deployed 2026-11-08:

```bash
npx supabase@3.0.0 link --project-ref geojpakugqlcwyhtnjvv
npx supabase@3.0.0 db push                           # 4 migrations → public
npx supabase@3.0.0 secrets set IP_SALT="$(openssl rand -hex 32)"
npx supabase@3.0.0 functions deploy ingest --use-api # verify_jwt=false from config.toml
```

The CLI is pinned to `supabase@3.0.0`; the same version runs every command in this document.

Its `supabase_migrations` history carried five legacy versions
(`20260813175326 … 20260813184906`, the `analytics`/`experiments` schema). They
were marked `reverted` so `db push` would run; nothing in those schemas changed.
A push from whichever repository owns them will need the repair undone first
(`--status applied`), otherwise `001`–`005` re-run into existing objects.

`IP_SALT` has no default on purpose: a shared fallback salt makes `ip_hash`
reversible by brute force over the IPv4 space. A missing salt is a
misconfiguration, and `ingest` answers `500` rather than hashing without one.

`src/lib/ingest.ts` carries the project ref directly: `INGEST_ENABLED` is
`true`, so the site sends events. `ANALYTICS_SUPABASE_URL` and
`ANALYTICS_SUPABASE_SERVICE_ROLE_KEY` are repository secrets, so
`sync-analytics-content.yml` writes the content tables instead of skipping.

## 7. Verifying a deploy

1. Grants on the live project: the four views answer, and only `service_role` /
   `postgres` hold privileges on them; `analytics_events` has RLS on with zero
   policies. The local stack was not started for this deploy — to re-check
   offline: `npx supabase@3.0.0 start && npx supabase@3.0.0 db reset`, then `set role anon`.
2. `cd supabase && deno fmt --check && deno lint && deno check functions/ingest/*.ts && deno test --allow-read`.
3. `bun test tests/lib` — includes the payload shape, the `PROJECT_REF` gate,
   "never throws", the property allowlist, and the `query` truncation.
4. `curl -i -X POST …/functions/v1/ingest -H 'content-type: text/plain' --data '{"events":[{"event_name":"pageview",…}]}'`
   → `204`, and one row in `analytics_events`. Send a browser `user-agent`:
   `curl/` matches `BOT_UA_RE`, the event is dropped, and the answer is still
   `204` — indistinguishable from success.
5. Browser: **no** `OPTIONS` in the network panel, one `POST` → `204`; a CTA
   click lands with the same `session_id` as the pageview.
6. After 24 h, compare `v_daily_traffic.pageviews` against PostHog `$pageview`.
   Expect a divergence under 10%; more than that means a bot or local session
   leak, not a broken pipeline.
7. `bun run sync:analytics-content:apply` twice — the second run must report
   the same counts and change nothing (idempotent on `(slug, locale)`).

## 8. Known limits

| Limit | Mitigation |
|---|---|
| A free-tier project can pause; events posted meanwhile are lost | every outcome is `204`, so the client never retries or blocks; a periodic smoke check is the next step |
| Bots and referrer spam can inflate counters | UA filter + 120/min per `ip_hash` |
| `analytics_events` grows forever | small personal-site volume; `(ip_hash, created_at desc)` keeps the rate-limit scan cheap; move to a counter table if it ever matters |
| Duplicate series with PostHog | expected — two independent stores, reconciled in verification step 6 |
| A project deleted from the registry keeps its last `site_projects` row | intentional: events still reference it, and a delete pass would orphan the join |
