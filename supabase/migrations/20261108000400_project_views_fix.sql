-- Replaces v_project_views from 20261108000300_analytics_views.sql:53-63.
--
-- Two defects in the previous definition:
--   1. the join had no locale predicate, so a ru event also matched the en row
--      of the same slug — every view was counted twice and each row held both
--      locales' traffic;
--   2. Volta chapters are stored as `volta-<part>` but the site sends
--      `slug = 'volta'` for every chapter page (Analytics.astro:137 captures
--      only the first path segment), so all 46 chapter rows matched nothing.
--
-- Chapters are now attributed from `path` (indexed by
-- analytics_events_path_created_at_idx), while the `volta` row keeps counting
-- every chapter as a rollup.
--
-- Column names, order and types are unchanged, so `create or replace` keeps the
-- existing revoke/grant from 20261108000300_analytics_views.sql:83-86.

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
 and e.locale = p.locale
 and case
       when p.slug like 'volta-%'
         then e.props->>'slug' = 'volta'
          and e.path ~ ('^/(en/)?projects/volta/' || substr(p.slug, 7) || '(/|$)')
       else e.props->>'slug' = p.slug
     end
group by p.slug, p.locale, p.title;
