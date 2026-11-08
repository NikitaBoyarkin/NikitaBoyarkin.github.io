-- Replaces the definer wrapper from 20261108000500_reports_role.sql.
--
-- That version wrapped v_project_views, which is security_invoker = true. A
-- nested invoker view re-checks privileges against the *calling* role, not
-- against the outer view's owner, so `reports` got
-- `permission denied for table site_projects` even though the outer view was
-- security_invoker = false. A definer view has to read the base tables itself.
--
-- Deliberate duplication: the select below mirrors
-- 20261108000400_project_views_fix.sql. Keep the two in sync — v_project_views
-- stays the general-purpose view, this one exists only so a read-only role can
-- see aggregates without SELECT on the raw events.
--
-- RLS is not an obstacle: postgres owns both tables, and RLS does not apply to
-- the table owner.

drop view if exists public.report_project_views;

create view public.report_project_views
  with (security_invoker = false)
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

revoke all on public.report_project_views from public, anon, authenticated;
grant usage on schema public to reports;
grant select on public.report_project_views to reports;
