// Holds the three places that state the caps against each other: the column
// CHECK constraints, the browser contract (src/lib/feedback.ts) and the Edge
// Function (payload.ts). Editing one without the others turns this red instead
// of shipping a form the database silently refuses.
//
// The per-answer caps cannot be a column CHECK — the answers live in one jsonb
// value — so SQL pins the total size and the signature, and the two TypeScript
// mirrors are compared key by key.

import sql from '../../migrations/20261117000000_feedback_tables.sql' with { type: 'text' };
import { FEEDBACK_QUESTIONS_RU, FEEDBACK_SIGNATURE_MAX } from '../../../src/lib/feedback.ts';
import { CAPS, SIGNATURE_MAX, TOKEN_MAX } from './payload.ts';

const assertEquals = <T>(actual: T, expected: T, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const checkBound = (pattern: RegExp, label: string): number => {
  const match = sql.match(pattern);
  if (!match) throw new Error(`no CHECK for ${label}`);
  return Number(match[1]);
};

Deno.test('signature cap matches all three sources', () => {
  const inSql = checkBound(/char_length\(signature\) <= (\d+)/, 'signature');
  assertEquals(FEEDBACK_SIGNATURE_MAX, inSql, 'src/lib signature');
  assertEquals(SIGNATURE_MAX, inSql, 'payload signature');
});

Deno.test('answer caps match between the browser contract and the function', () => {
  const fromSrc = Object.fromEntries(FEEDBACK_QUESTIONS_RU.map((q) => [q.key, q.cap]));
  assertEquals(CAPS, fromSrc, 'caps');
});

Deno.test('the answers column is bounded even though the per-key caps are not', () => {
  const bound = checkBound(/pg_column_size\(answers\) <= (\d+)/, 'answers');
  const longest = Object.values(CAPS).reduce((sum, cap) => sum + cap, 0);
  if (bound <= longest) throw new Error(`answers CHECK ${bound} cannot hold ${longest} characters of text`);
});

Deno.test('an invite token fits the column the hash is stored in', () => {
  const hashLength = checkBound(/char_length\(token_hash\) = (\d+)/, 'token_hash');
  if (TOKEN_MAX > hashLength * 2) {
    throw new Error(`token cap ${TOKEN_MAX} is longer than a real invite (${hashLength * 2})`);
  }
});
