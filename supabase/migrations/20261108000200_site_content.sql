-- Portfolio content mirrored into Postgres so the site's projects and posts can
-- be joined against analytics_events with plain SQL.
--
-- The site stays static and never reads these tables at runtime — the content
-- already ships as HTML and public/projects.json. This is an analysis surface,
-- written by scripts/sync-supabase-content.mjs in CI.
--
-- Content is public, so anon gets SELECT on non-draft, non-private rows. That
-- is the only public read in this schema; analytics_events stays at zero
-- policies.

create table if not exists public.site_projects (
  slug        text not null,
  locale      text not null,
  title       text not null,
  description text,
  track       text,
  tools       text[] not null default '{}',
  github      text,
  demo        text,
  private     boolean not null default false,
  draft       boolean not null default false,
  updated_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now(),
  raw         jsonb not null default '{}'::jsonb,

  primary key (slug, locale),
  constraint site_projects_locale_chk check (locale in ('ru', 'en'))
);

create table if not exists public.site_posts (
  slug         text not null,
  locale       text not null,
  title        text not null,
  published_at timestamptz,
  category     text,
  tags         text[] not null default '{}',
  excerpt      text,
  draft        boolean not null default false,
  synced_at    timestamptz not null default now(),
  raw          jsonb not null default '{}'::jsonb,

  primary key (slug, locale),
  constraint site_posts_locale_chk check (locale in ('ru', 'en'))
);

alter table public.site_projects enable row level security;
alter table public.site_posts enable row level security;

create policy site_projects_public_read on public.site_projects
  for select to anon, authenticated
  using (not draft and not private);

create policy site_posts_public_read on public.site_posts
  for select to anon, authenticated
  using (not draft);

-- A policy alone grants nothing: the role still needs table-level SELECT.
grant select on public.site_projects to anon, authenticated;
grant select on public.site_posts to anon, authenticated;
