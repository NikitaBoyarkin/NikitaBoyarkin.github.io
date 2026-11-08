-- Site analytics events: pageviews, CTA/click events and JS errors.
--
-- RLS is enabled with ZERO policies on purpose: anon/authenticated can neither
-- read nor write, so a direct PostgREST insert cannot bypass the `ingest` Edge
-- Function's allowlist, bot filter and rate limit. Only service_role writes.
--
-- Retention is indefinite by decision — no purge job. Order by client_ts; the
-- row is written on receipt, so received_at is the debugging clock and
-- created_at is the server's wall clock at insert.

create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  received_at timestamptz not null default now(),
  client_ts   timestamptz,
  event_name  text not null,
  session_id  text,
  path        text not null,
  locale      text,
  props       jsonb not null default '{}'::jsonb,
  ip_hash     text,
  ua_class    text,

  constraint analytics_events_name_len    check (char_length(event_name) between 1 and 60),
  constraint analytics_events_session_len check (session_id is null or char_length(session_id) between 8 and 64),
  constraint analytics_events_path_len    check (char_length(path) between 1 and 512),
  constraint analytics_events_locale_chk  check (locale is null or locale in ('ru', 'en')),
  constraint analytics_events_props_obj   check (jsonb_typeof(props) = 'object'),
  constraint analytics_events_ua_chk      check (ua_class is null or ua_class in ('human', 'bot', 'unknown'))
);

alter table public.analytics_events enable row level security;

-- Dashboard listings and the daily-traffic view.
create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_created_at_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_path_created_at_idx
  on public.analytics_events (path, created_at desc);

-- Backs the per-IP rate-limit lookup in the `ingest` Edge Function.
create index if not exists analytics_events_ip_hash_created_at_idx
  on public.analytics_events (ip_hash, created_at desc);
