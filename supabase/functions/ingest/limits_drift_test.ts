// Holds supabase/functions/ingest/limits.ts against the CHECK constraints in
// the migration. Editing one without the other turns this red instead of
// shipping drift silently.

import eventsSql from '../../migrations/20261108000000_analytics_events.sql' with { type: 'text' };
import { EVENT_NAME_MAX, PATH_MAX, PROPS, SESSION_MAX, SESSION_MIN } from './limits.ts';

const assertEquals = <T>(actual: T, expected: T, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const limitOf = (column: string, sql = eventsSql): number => {
  const match = sql.match(new RegExp(`char_length\\(${column}\\) between \\d+ and (\\d+)`));
  if (!match) throw new Error(`no upper bound for ${column}`);
  return Number(match[1]);
};

Deno.test('event name cap matches the table CHECK', () => {
  assertEquals(limitOf('event_name'), EVENT_NAME_MAX, 'event_name max');
});

Deno.test('path cap matches the table CHECK', () => {
  assertEquals(limitOf('path'), PATH_MAX, 'path max');
});

Deno.test('session bounds match the table CHECK', () => {
  assertEquals(limitOf('session_id'), SESSION_MAX, 'session max');
  const min = eventsSql.match(/char_length\(session_id\) between (\d+) and/);
  assertEquals(Number(min?.[1]), SESSION_MIN, 'session min');
});

Deno.test('outbound_click.url is not an accepted prop', () => {
  assertEquals((PROPS as readonly string[]).includes('url'), false, 'url in PROPS');
});
