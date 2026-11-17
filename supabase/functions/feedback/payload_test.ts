// Offline tests for the feedback payload parser: no network, only Request
// objects built by hand. Covers both bodies the form can produce — the JSON the
// island sends and the urlencoded body a no-JS browser sends.

import { parseFeedback } from './payload.ts';

const assertEquals = <T>(actual: T, expected: T, label: string) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
};
const json = (body: unknown): Request =>
  new Request('https://example.supabase.co/functions/v1/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const form = (body: string): Request =>
  new Request('https://example.supabase.co/functions/v1/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

const VALID_ANSWERS = { task: 'a', helps: 'b', friction: 'c', gap: 'd' };

Deno.test('json body with four answers parses to a payload with empty signature and token', async () => {
  const parsed = await parseFeedback(json({ role: 'hr', answers: VALID_ANSWERS, locale: 'ru' }));
  assertEquals(parsed.kind, 'ok', 'kind');
  if (parsed.kind !== 'ok') return;
  assertEquals(parsed.payload.role, 'hr', 'role');
  assertEquals(parsed.payload.answers.more, '', 'more');
  assertEquals(parsed.payload.signature, '', 'signature');
  assertEquals(parsed.payload.token, '', 'token');
  assertEquals(parsed.payload.locale, 'ru', 'locale');
});

Deno.test('urlencoded body flattens q_* keys into answers', async () => {
  const parsed = await parseFeedback(
    form('role=hr&q_task=a&q_helps=b&q_friction=c&q_gap=d&locale=ru'),
  );
  assertEquals(parsed.kind, 'ok', 'kind');
  if (parsed.kind !== 'ok') return;
  assertEquals(parsed.payload.answers, { task: 'a', helps: 'b', friction: 'c', gap: 'd', more: '' }, 'answers');
});

Deno.test('an empty required answer is rejected by name', async () => {
  const parsed = await parseFeedback(json({ role: 'hr', answers: { ...VALID_ANSWERS, gap: '   ' } }));
  assertEquals(parsed.kind, 'invalid', 'kind');
  if (parsed.kind !== 'invalid') return;
  assertEquals(parsed.field, 'gap', 'field');
});

Deno.test('an answer one character over the cap is rejected, not truncated', async () => {
  const parsed = await parseFeedback(json({ role: 'hr', answers: { ...VALID_ANSWERS, friction: 'f'.repeat(601) } }));
  assertEquals(parsed.kind, 'invalid', 'kind');
  if (parsed.kind !== 'invalid') return;
  assertEquals(parsed.field, 'friction', 'field');
});

Deno.test('an unknown answer key is rejected by its bare name', async () => {
  const parsed = await parseFeedback(form('role=hr&q_task=a&q_helps=b&q_friction=c&q_gap=d&q_extra=1'));
  assertEquals(parsed.kind, 'invalid', 'kind');
  if (parsed.kind !== 'invalid') return;
  assertEquals(parsed.field, 'extra', 'field');
});

Deno.test('an unknown role is accepted as other', async () => {
  const parsed = await parseFeedback(json({ role: 'boss', answers: VALID_ANSWERS }));
  assertEquals(parsed.kind, 'ok', 'kind');
  if (parsed.kind !== 'ok') return;
  assertEquals(parsed.payload.role, 'other', 'role');
});

Deno.test('an unknown locale falls back to ru instead of failing', async () => {
  const parsed = await parseFeedback(json({ role: 'hr', answers: VALID_ANSWERS, locale: 'de' }));
  assertEquals(parsed.kind, 'ok', 'kind');
  if (parsed.kind !== 'ok') return;
  assertEquals(parsed.payload.locale, 'ru', 'locale');
});

Deno.test('a body that is neither json nor a form is empty', async () => {
  const parsed = await parseFeedback(
    new Request('https://example.supabase.co/functions/v1/feedback', { method: 'POST', body: 'not a body' }),
  );
  assertEquals(parsed.kind, 'empty', 'kind');
});

Deno.test('a filled honeypot is empty, so the caller answers without inserting', async () => {
  const parsed = await parseFeedback(
    json({ role: 'hr', answers: VALID_ANSWERS, website: 'http://spam.example' }),
  );
  assertEquals(parsed.kind, 'empty', 'kind');
});

Deno.test('a signature over the cap is rejected', async () => {
  const parsed = await parseFeedback(json({ role: 'hr', answers: VALID_ANSWERS, signature: 's'.repeat(121) }));
  assertEquals(parsed.kind, 'invalid', 'kind');
  if (parsed.kind !== 'invalid') return;
  assertEquals(parsed.field, 'signature', 'field');
});

Deno.test('a token longer than any real invite is rejected', async () => {
  const parsed = await parseFeedback(json({ role: 'hr', answers: VALID_ANSWERS, token: 'x'.repeat(128) }));
  assertEquals(parsed.kind, 'invalid', 'kind');
  if (parsed.kind !== 'invalid') return;
  assertEquals(parsed.field, 'token', 'field');
});

Deno.test('malformed json is empty rather than a 500', async () => {
  const parsed = await parseFeedback(
    new Request('https://example.supabase.co/functions/v1/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{oops',
    }),
  );
  assertEquals(parsed.kind, 'empty', 'kind');
});
