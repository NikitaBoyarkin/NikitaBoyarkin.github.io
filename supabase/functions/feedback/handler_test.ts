// Offline tests for the feedback handler: no server, no Deno.env, no network —
// every branch is driven through the injected `deps`, so the rate-limit and
// invite logic is exercised without a database.

import { type Deps, type Env, handleFeedback } from './handler.ts';

const ENV: Env = { supabaseUrl: 'https://example.supabase.co', serviceRole: 'service-role-key', ipSalt: 'salt' };

const assertEquals = <T>(actual: T, expected: T, label: string) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
};
const assert = (value: boolean, label: string) => {
  if (!value) throw new Error(label);
};

const ANSWERS = { task: 'a', helps: 'b', friction: 'c', gap: 'd' };

interface Recorder {
  rows: Record<string, unknown>[];
  invites: string[];
  counts: string[];
}

function deps(overrides: Partial<Deps> = {}, rec: Recorder = { rows: [], invites: [], counts: [] }): Deps {
  return {
    lookupInvite: (tokenHash) => {
      rec.invites.push(tokenHash);
      return Promise.resolve(null);
    },
    countRecentByIp: (ipHash) => {
      rec.counts.push(ipHash);
      return Promise.resolve(0);
    },
    insertResponse: (row) => {
      rec.rows.push(row);
      return Promise.resolve();
    },
    ...overrides,
  };
}

function req(body: unknown, headers: Record<string, string> = {}, method = 'POST'): Request {
  return new Request('https://example.supabase.co/functions/v1/feedback', {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: method === 'GET' || method === 'OPTIONS' ? undefined : JSON.stringify(body),
  });
}

const ok = (extra: Record<string, unknown> = {}) => ({ role: 'hr', answers: ANSWERS, ...extra });

Deno.test('OPTIONS answers 204 with the site origin', async () => {
  const res = await handleFeedback(req(null, {}, 'OPTIONS'), ENV, deps());
  assertEquals(res.status, 204, 'status');
  assertEquals(res.headers.get('access-control-allow-origin'), 'https://nikitaboyarkin.github.io', 'origin');
});

Deno.test('GET is not allowed', async () => {
  const res = await handleFeedback(req(null, {}, 'GET'), ENV, deps());
  assertEquals(res.status, 405, 'status');
});

Deno.test('a filled honeypot answers 200 and inserts nothing', async () => {
  const rec: Recorder = { rows: [], invites: [], counts: [] };
  const res = await handleFeedback(req(ok({ website: 'http://spam.example' })), ENV, deps({}, rec));
  assertEquals(res.status, 200, 'status');
  assertEquals(rec.rows.length, 0, 'rows');
});

Deno.test('a valid open answer inserts role from the form, source open, no invite', async () => {
  const rec: Recorder = { rows: [], invites: [], counts: [] };
  const res = await handleFeedback(req(ok()), ENV, deps({}, rec));
  assertEquals(res.status, 200, 'status');
  assertEquals(rec.rows.length, 1, 'rows');
  assertEquals(rec.rows[0].role, 'hr', 'role');
  assertEquals(rec.rows[0].source, 'open', 'source');
  assertEquals(rec.rows[0].invite_id, null, 'invite_id');
  assert(/^[0-9a-f]{64}$/.test(String(rec.rows[0].ip_hash)), 'ip_hash is 64 hex');
  assertEquals(rec.rows[0].answers, { task: 'a', helps: 'b', friction: 'c', gap: 'd', more: '' }, 'answers');
});

Deno.test('a valid token wins over the form: role from the invite, source invited', async () => {
  const rec: Recorder = { rows: [], invites: [], counts: [] };
  const res = await handleFeedback(
    req(ok({ token: 'rawtoken', role: 'hr' })),
    ENV,
    deps({
      lookupInvite: (hash) => {
        rec.invites.push(hash);
        return Promise.resolve({ id: 'i1', role: 'manager', maxResponses: 3, used: 1 });
      },
    }, rec),
  );
  assertEquals(res.status, 200, 'status');
  assertEquals(rec.rows[0].source, 'invited', 'source');
  assertEquals(rec.rows[0].role, 'manager', 'role');
  assertEquals(rec.rows[0].invite_id, 'i1', 'invite_id');
  assert(rec.invites[0] !== 'rawtoken', 'the raw token never goes to the table');
});

Deno.test('an unknown token is treated as an open answer', async () => {
  const rec: Recorder = { rows: [], invites: [], counts: [] };
  const res = await handleFeedback(req(ok({ token: 'stale' })), ENV, deps({}, rec));
  assertEquals(res.status, 200, 'status');
  assertEquals(rec.rows[0].source, 'open', 'source');
  assertEquals(rec.rows[0].invite_id, null, 'invite_id');
});

Deno.test('an exhausted invite answers 429 and inserts nothing', async () => {
  const rec: Recorder = { rows: [], invites: [], counts: [] };
  const res = await handleFeedback(
    req(ok({ token: 'rawtoken' })),
    ENV,
    deps({
      lookupInvite: () => Promise.resolve({ id: 'i1', role: 'hr', maxResponses: 3, used: 3 }),
    }, rec),
  );
  assertEquals(res.status, 429, 'status');
  assertEquals(rec.rows.length, 0, 'rows');
});

Deno.test('the hourly cap holds at ten: ten is refused, nine passes', async () => {
  const ten = await handleFeedback(req(ok()), ENV, deps({ countRecentByIp: () => Promise.resolve(10) }));
  assertEquals(ten.status, 429, 'tenth');
  const rec: Recorder = { rows: [], invites: [], counts: [] };
  const nine = await handleFeedback(req(ok()), ENV, deps({ countRecentByIp: () => Promise.resolve(9) }, rec));
  assertEquals(nine.status, 200, 'ninth');
  assertEquals(rec.rows.length, 1, 'rows');
});

Deno.test('a failing rate-limit query lets the answer through (fail-open)', async () => {
  const rec: Recorder = { rows: [], invites: [], counts: [] };
  const res = await handleFeedback(
    req(ok()),
    ENV,
    deps({
      countRecentByIp: () => Promise.reject(new Error('boom')),
    }, rec),
  );
  assertEquals(res.status, 200, 'status');
  assertEquals(rec.rows.length, 1, 'rows');
});

Deno.test('a browser without JS gets an HTML thank-you', async () => {
  const res = await handleFeedback(req(ok(), { accept: 'text/html' }), ENV, deps());
  assertEquals(res.status, 200, 'status');
  assert((res.headers.get('content-type') ?? '').includes('text/html'), 'content-type');
  const html = await res.text();
  assert(html.includes('<html'), 'html body');
});

Deno.test('an answer above the cap is rejected with the field name', async () => {
  const res = await handleFeedback(req(ok({ answers: { ...ANSWERS, gap: 'g'.repeat(601) } })), ENV, deps());
  assertEquals(res.status, 400, 'status');
  const body = await res.json();
  assertEquals(body.field, 'gap', 'field');
});

Deno.test('a missing salt is a loud misconfiguration, not a silent shared hash', async () => {
  const res = await handleFeedback(req(ok()), { ...ENV, ipSalt: '' }, deps());
  assertEquals(res.status, 500, 'status');
});
