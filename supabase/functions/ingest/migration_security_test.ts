// Static assertions on the migrations: the claims this schema makes about
// itself ("analytics is unreadable by anon", "views do not bypass RLS") are
// only true while these markers are in the SQL.

import eventsSql from '../../migrations/20261108000000_analytics_events.sql' with { type: 'text' };
import rpcSql from '../../migrations/20261108000100_insert_analytics_events.sql' with { type: 'text' };
import contentSql from '../../migrations/20261108000200_site_content.sql' with { type: 'text' };
import viewsSql from '../../migrations/20261108000300_analytics_views.sql' with { type: 'text' };

const assert = (value: boolean, label: string) => {
  if (!value) throw new Error(label);
};

Deno.test('analytics_events has RLS enabled and zero policies', () => {
  assert(/alter table public\.analytics_events enable row level security/.test(eventsSql), 'RLS missing');
  assert(!/create policy[\s\S]*?analytics_events/.test(eventsSql), 'unexpected policy on analytics_events');
});

Deno.test('the RPC is revoked from anon and granted to service_role', () => {
  assert(/revoke all on function public\.insert_analytics_events/.test(rpcSql), 'revoke missing');
  assert(
    /grant execute on function public\.insert_analytics_events[\s\S]*?to service_role/.test(rpcSql),
    'grant missing',
  );
  assert(/security definer/.test(rpcSql), 'not security definer');
  assert(/set search_path = ''/.test(rpcSql), 'search_path not locked');
});

Deno.test('content tables are readable by anon only through a non-draft policy', () => {
  assert(/grant select on public\.site_projects to anon, authenticated/.test(contentSql), 'projects grant missing');
  assert(/using \(not draft and not private\)/.test(contentSql), 'projects filter missing');
  assert(/using \(not draft\)/.test(contentSql), 'posts filter missing');
});

Deno.test('every view is security_invoker and analytics views are service_role only', () => {
  const views = viewsSql.match(/create or replace view[\s\S]*?as/g) ?? [];
  assert(views.length === 4, `expected 4 views, found ${views.length}`);
  for (const view of views) {
    assert(/security_invoker = true/.test(view), `view without security_invoker: ${view.slice(0, 40)}`);
  }
  assert(/grant select on public\.v_daily_traffic[\s\S]*?to service_role/.test(viewsSql), 'view grant missing');
  assert(!/grant select[\s\S]*?to anon/.test(viewsSql), 'analytics view granted to anon');
});
