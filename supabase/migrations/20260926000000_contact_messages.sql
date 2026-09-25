-- Inbound contact-form submissions.
--
-- RLS is enabled with ZERO policies on purpose: anon/authenticated can neither
-- read nor write, so a direct PostgREST insert — bypassing the honeypot and the
-- rate limit in the `contact` Edge Function — is impossible. Only service_role
-- (the function) writes here.
--
-- The CHECK constraints mirror the length caps in supabase/functions/contact
-- and src/lib/contact.ts. They are the last line of defence, not the first.

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text,
  contact    text not null,
  message    text not null,
  company    text,
  source     text not null default 'direct',
  locale     text not null default 'ru',
  ip_hash    text,
  status     text not null default 'new',

  constraint contact_messages_contact_len check (char_length(contact) between 3 and 200),
  constraint contact_messages_message_len check (char_length(message) between 5 and 4000),
  constraint contact_messages_name_len    check (name is null or char_length(name) <= 120),
  constraint contact_messages_company_len check (company is null or char_length(company) <= 160),
  constraint contact_messages_source_chk  check (source in ('direct', 'linkedin', 'hh', 'telegram', 'github', 'referral', 'other')),
  constraint contact_messages_locale_chk  check (locale in ('ru', 'en')),
  constraint contact_messages_status_chk  check (status in ('new', 'read', 'replied', 'archived'))
);

alter table public.contact_messages enable row level security;

-- Newest-first listing in the dashboard and in scripts/sync-contact-log.mjs.
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- Backs the per-IP rate limit lookup in the Edge Function.
create index if not exists contact_messages_ip_hash_created_at_idx
  on public.contact_messages (ip_hash, created_at desc);
