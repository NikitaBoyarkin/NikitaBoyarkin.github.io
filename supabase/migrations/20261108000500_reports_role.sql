-- Read-only reporting role: gives a local script aggregates without handing it
-- service_role on a database shared with another owner's analytics/experiments.
--
-- v_project_views is security_invoker = true, so SELECT on it also needs SELECT
-- on analytics_events and site_projects. Granting those to a reporting role
-- would expose raw rows (path, session_id, props), so the role reads a definer
-- view instead: it executes as the view owner and returns aggregates only.
--
-- No password here — a secret must not enter git. Set it once from the SQL
-- editor, with the same value you put in .env as REPORTS_DB_PASSWORD:
--   alter role reports with password '<...>';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'reports') then
    create role reports noinherit login;
  end if;
end
$$;

create view public.report_project_views
  with (security_invoker = false)
as
select slug, locale, title, views, last_view
from public.v_project_views;

-- Supabase's default privileges grant new objects to anon/authenticated, so a
-- revoke is required, not redundant: the role must be the only reader.
revoke all on public.report_project_views from public, anon, authenticated;

grant usage on schema public to reports;
grant select on public.report_project_views to reports;
