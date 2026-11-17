// Static assertions on the feedback migrations: the claims the schema makes
// about itself ("anon cannot read a single response", "no raw invite token at
// rest", "the caps the function enforces are the caps the table checks") hold
// only while these markers are in the SQL.

import sql from '../../migrations/20261117000000_feedback_tables.sql' with { type: 'text' };

const assert = (value: boolean, label: string) => {
  if (!value) throw new Error(label);
};

Deno.test('responses: RLS on, zero policies, no user_agent column', () => {
  assert(/alter table public\.feedback_responses enable row level security/.test(sql), 'RLS missing');
  assert(!/create policy[\s\S]*?feedback_responses/.test(sql), 'policy found');
  assert(!/user_agent/.test(sql), 'user_agent column must not exist');
});

Deno.test('invites: RLS on, zero policies, token stored as hash', () => {
  assert(/alter table public\.feedback_invites enable row level security/.test(sql), 'RLS missing');
  assert(/token_hash\s+text not null unique/.test(sql), 'token_hash missing');
  assert(!/token text/.test(sql), 'raw token column found');
});

Deno.test('caps and ip index are pinned', () => {
  assert(/char_length\(signature\) <= 120/.test(sql), 'signature cap');
  assert(/pg_column_size\(answers\) <= 8192/.test(sql), 'answers size cap');
  assert(/\(ip_hash, created_at\)/.test(sql), 'rate-limit index missing');
});
