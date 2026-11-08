-- Rate-limited batch insert for the `ingest` Edge Function.
--
-- Counting and inserting happen in one plpgsql transaction, serialized per
-- ip_hash by an advisory lock: under READ COMMITTED a plain count-then-insert
-- lets N parallel requests read the same count and insert N rows, so the cap
-- holds only for traffic that arrives one request at a time. Same reasoning as
-- insert_contact_message() in portfolio-contact-backend.
--
-- The events arrive as a JSON array because the client uses sendBeacon and one
-- request per interaction would be both chattier and easier to lose on unload.
-- Events beyond the remaining budget are dropped, not rejected: the handler
-- answers 204 for every outcome anyway.
--
-- Thresholds are arguments so RATE_MAX / RATE_WINDOW_MS keep one home
-- (supabase/functions/ingest/limits.ts).

create or replace function public.insert_analytics_events(
  p_events         jsonb,
  p_ip_hash        text,
  p_ua_class       text,
  p_max            integer,
  p_window_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent   integer;
  budget   integer;
  inserted integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_ip_hash, ''), 0));

  select count(*) into recent
  from public.analytics_events
  where ip_hash = p_ip_hash
    and created_at >= now() - make_interval(secs => p_window_seconds);

  budget := greatest(p_max - recent, 0);
  if budget = 0 then
    return 0;
  end if;

  with src as (
    select event_name, session_id, path, locale, props, client_ts
    from jsonb_to_recordset(p_events) as e(
      event_name text,
      session_id text,
      path       text,
      locale     text,
      props      jsonb,
      client_ts  timestamptz
    )
    limit budget
  )
  insert into public.analytics_events
    (event_name, session_id, path, locale, props, ip_hash, ua_class, client_ts)
  select
    src.event_name,
    src.session_id,
    src.path,
    src.locale,
    coalesce(src.props, '{}'::jsonb),
    p_ip_hash,
    p_ua_class,
    src.client_ts
  from src;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

comment on function public.insert_analytics_events(jsonb, text, text, integer, integer) is
  'Insert-up-to-budget for the ingest Edge Function. Locks per ip_hash, counts rows in the window, and inserts the first p_max-minus-recent events of the batch. Returns the number of rows actually inserted; 0 means the quota is spent.';

revoke all on function public.insert_analytics_events(jsonb, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.insert_analytics_events(jsonb, text, text, integer, integer)
  to service_role;
