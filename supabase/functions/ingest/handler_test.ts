// Offline tests for the ingest handler: no server, no Deno.env, only
// globalThis.fetch stubbed. Same shape as portfolio-contact-backend's
// handler_test.ts so the two functions stay comparable.

import { type Env, handle } from './handler.ts';

const ENV: Env = { supabaseUrl: 'https://example.supabase.co', serviceRole: 'service-role-key', ipSalt: 'salt' };

const assertEquals = <T>(actual: T, expected: T, label: string) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
};
const assert = (value: boolean, label: string) => {
  if (!value) throw new Error(label);
};

interface Captured {
  url: string;
  body: Record<string, unknown>;
}

function stubFetch(): { calls: Captured[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: Captured[] = [];
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return Promise.resolve(new Response('1', { status: 200 }));
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const req = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request('https://example.supabase.co/functions/v1/ingest', {
    method: 'POST',
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh)', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

Deno.test('a valid batch is forwarded as one RPC and answered 204', async () => {
  const { calls, restore } = stubFetch();
  try {
    const res = await handle(
      req({
        events: [{ event_name: 'pageview', path: '/projects/volta/', session_id: 'abcdefgh-1234', ts: Date.now() }],
      }),
      ENV,
    );
    assertEquals(res.status, 204, 'status');
    assertEquals(calls.length, 1, 'rpc calls');
    assert(calls[0].url.endsWith('/rest/v1/rpc/insert_analytics_events'), 'rpc url');
    const events = calls[0].body.p_events as unknown[];
    assertEquals(events.length, 1, 'event count');
    assertEquals(calls[0].body.p_max, 120, 'rate cap');
  } finally {
    restore();
  }
});

Deno.test('the beacon shape (type + ts) is accepted as a pageview', async () => {
  const { calls, restore } = stubFetch();
  try {
    const res = await handle(req({ type: 'pageview', path: '/', session_id: 'abcdefgh-1234', ts: Date.now() }), ENV);
    assertEquals(res.status, 204, 'status');
    const events = calls[0].body.p_events as Array<Record<string, unknown>>;
    assertEquals(events[0].event_name, 'pageview', 'event name');
  } finally {
    restore();
  }
});

Deno.test('an event without an absolute path is dropped; an empty batch skips the RPC', async () => {
  const { calls, restore } = stubFetch();
  try {
    const res = await handle(req({ events: [{ event_name: 'pageview', path: 'projects' }] }), ENV);
    assertEquals(res.status, 204, 'status');
    assertEquals(calls.length, 0, 'rpc calls');
  } finally {
    restore();
  }
});

Deno.test('malformed JSON is 400 and never reaches the RPC', async () => {
  const { calls, restore } = stubFetch();
  try {
    const res = await handle(req('{not json'), ENV);
    assertEquals(res.status, 400, 'status');
    assertEquals(calls.length, 0, 'rpc calls');
  } finally {
    restore();
  }
});

Deno.test('a bot user agent is answered 204 without an insert', async () => {
  const { calls, restore } = stubFetch();
  try {
    const res = await handle(
      req({ events: [{ event_name: 'pageview', path: '/' }] }, { 'user-agent': 'Googlebot/2.1' }),
      ENV,
    );
    assertEquals(res.status, 204, 'status');
    assertEquals(calls.length, 0, 'rpc calls');
  } finally {
    restore();
  }
});

Deno.test('missing config is 500, not a silent drop', async () => {
  const res = await handle(req({ events: [{ event_name: 'pageview', path: '/' }] }), { ...ENV, ipSalt: '' });
  assertEquals(res.status, 500, 'status');
});

Deno.test('OPTIONS is 204 with CORS; other methods 405', async () => {
  const options = await handle(new Request('https://x/ingest', { method: 'OPTIONS' }), ENV);
  assertEquals(options.status, 204, 'options');
  assertEquals(options.headers.get('access-control-allow-origin'), 'https://nikitaboyarkin.github.io', 'cors');
  const get = await handle(new Request('https://x/ingest', { method: 'GET' }), ENV);
  assertEquals(get.status, 405, 'get');
});

Deno.test('props outside the allowlist are stripped before the RPC', async () => {
  const { calls, restore } = stubFetch();
  try {
    await handle(
      req({
        events: [{
          event_name: 'outbound_click',
          path: '/',
          props: { domain: 'github.com', url: 'https://github.com/x?token=secret' },
        }],
      }),
      ENV,
    );
    const events = calls[0].body.p_events as Array<{ props: Record<string, unknown> }>;
    assertEquals(Object.keys(events[0].props), ['domain'], 'props');
  } finally {
    restore();
  }
});
