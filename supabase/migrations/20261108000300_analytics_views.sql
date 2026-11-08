-- Read-side views for the Supabase dashboard and ad-hoc SQL.
--
-- Every view is security_invoker = true. A default (definer) view is owned by
-- postgres and therefore bypasses the underlying table's RLS — an analytics
-- view granted to anon would leak every event despite analytics_events having
-- zero policies. The content views need the invoker's own SELECT grant, which
-- 20261108000200_site_content.sql gives to anon; the analytics views are
-- granted to service_role only.

create or replace view public.v_daily_traffic
  with (security_invoker = true)
as
select
  date_trunc('day', coalesce(client_ts, created_at))                          as day,
  count(*) filter (where event_name = 'pageview')                             as pageviews,
  count(distinct session_id) filter (where event_name = 'pageview')           as sessions,
  count(distinct ip_hash)                                                     as visitors,
  count(*) filter (where event_name = 'error')                                as errors
from public.analytics_events
group by 1;

create or replace view public.v_top_paths_30d
  with (security_invoker = true)
as
select
  path,
  count(*)                    as pageviews,
  count(distinct session_id)  as sessions
from public.analytics_events
where event_name = 'pageview'
  and coalesce(client_ts, created_at) >= now() - interval '30 days'
group by path
order by pageviews desc;

create or replace view public.v_cta_daily
  with (security_invoker = true)
as
select
  date_trunc('day', coalesce(client_ts, created_at))  as day,
  event_name,
  count(*)                                            as clicks
from public.analytics_events
where event_name not in ('pageview', 'error')
group by 1, 2;

-- Project views per slug: joins the page/click events (props->>'slug') to the
-- synced project titles, so the dashboard shows names rather than slugs.
create or replace view public.v_project_views
  with (security_invoker = true)
as
select
  p.slug,
  p.locale,
  p.title,
  count(e.id)          as views,
  max(e.created_at)    as last_view
from public.site_projects p
left join public.analytics_events e
  on e.event_name = 'project_viewed'
 and e.props->>'slug' = p.slug
group by p.slug, p.locale, p.title;

revoke all on public.v_daily_traffic, public.v_top_paths_30d, public.v_cta_daily, public.v_project_views
  from public, anon, authenticated;
grant select on public.v_daily_traffic, public.v_top_paths_30d, public.v_cta_daily, public.v_project_views
  to service_role;
