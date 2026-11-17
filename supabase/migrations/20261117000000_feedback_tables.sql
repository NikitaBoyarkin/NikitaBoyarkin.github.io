-- Feedback 360: anonymous responses and invite tokens.
--
-- RLS is enabled with ZERO policies on both tables: neither `anon` nor
-- `authenticated` can read or write through PostgREST. The `feedback` Edge
-- Function is the only writer, under service_role. That is also what keeps the
-- invite `label` (a person's name and company) out of the browser's reach.
--
-- Caps below are the single source of truth: src/lib/feedback.ts and
-- supabase/functions/feedback/payload.ts mirror them, and limits_drift_test.ts
-- compares the three. Editing one without the others turns the suite red.

create table public.feedback_invites (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  -- sha256(raw token). The raw token exists only in the URL the owner sends;
  -- a leaked table yields no working invite links.
  token_hash    text not null unique check (char_length(token_hash) = 64),
  role          text not null check (role in ('hr', 'manager', 'colleague', 'other')),
  -- Private note ("Аня, Яндекс"). Never exported, never exposed to the browser.
  label         text not null check (char_length(label) between 1 and 200),
  max_responses int not null default 3 check (max_responses between 1 and 10),
  active        bool not null default true
);

create table public.feedback_responses (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role       text not null check (role in ('hr', 'manager', 'colleague', 'other')),
  source     text not null check (source in ('open', 'invited')),
  invite_id  uuid null references public.feedback_invites (id) on delete set null,
  answers    jsonb not null check (pg_column_size(answers) <= 8192),
  signature  text null check (char_length(signature) <= 120),
  locale     text not null check (locale in ('ru', 'en')),
  -- sha256(ip + FEEDBACK_IP_SALT). A distinct salt from ingest is deliberate:
  -- a shared one would join a feedback answer to analytics_events by ip_hash.
  ip_hash    text not null
);

alter table public.feedback_invites enable row level security;
alter table public.feedback_responses enable row level security;

create index feedback_responses_created_at_idx on public.feedback_responses (created_at);
create index feedback_responses_ip_idx on public.feedback_responses (ip_hash, created_at);
create index feedback_invites_token_idx on public.feedback_invites (token_hash);
