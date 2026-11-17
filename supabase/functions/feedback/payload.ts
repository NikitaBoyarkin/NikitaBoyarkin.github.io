// Pure request parsing for the feedback survey — no Deno global, no network.
//
// Two bodies arrive here: the island posts JSON, a browser without JS posts
// `application/x-www-form-urlencoded` from a native form. Both normalise to the
// same payload; the caps mirror the column CHECKs and src/lib/feedback.ts, and
// limits_drift_test.ts compares the three.

export type Key = 'task' | 'helps' | 'friction' | 'gap' | 'more';
export type Role = 'hr' | 'manager' | 'colleague' | 'other';

export interface FeedbackPayload {
  role: Role;
  answers: Record<Key, string>;
  signature: string;
  locale: 'ru' | 'en';
  token: string;
}

export type Parsed =
  | { kind: 'ok'; payload: FeedbackPayload }
  | { kind: 'invalid'; field: string }
  | { kind: 'empty' };

/** Mirrored from the `feedback_responses` CHECK constraints. */
export const CAPS: Record<Key, number> = { task: 600, helps: 600, friction: 600, gap: 600, more: 1000 };
export const SIGNATURE_MAX = 120;
export const TOKEN_MAX = 64;

const KEYS: readonly Key[] = ['task', 'helps', 'friction', 'gap', 'more'];
const REQUIRED: readonly Key[] = ['task', 'helps', 'friction', 'gap'];
const ROLES: readonly Role[] = ['hr', 'manager', 'colleague', 'other'];
const HONEYPOT = 'website';
// `source` is a hidden field the form posts; the server decides it, so the
// value is ignored rather than rejected.
const NON_ANSWER_FIELDS = new Set(['role', 'locale', 'signature', 'token', HONEYPOT, 'source']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Both bodies flatten to `[name, value]` pairs; q_* names are stripped. */
function pairsOf(req: Request, text: string): [string, string][] | null {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return null;
    }
    if (!isRecord(body)) return null;
    const pairs: [string, string][] = [];
    for (const [name, value] of Object.entries(body)) {
      if (name === 'answers') {
        if (!isRecord(value)) return null;
        for (const [key, answer] of Object.entries(value)) {
          if (typeof answer !== 'string') return null;
          pairs.push([`q_${key}`, answer]);
        }
      } else if (typeof value === 'string') {
        pairs.push([name, value]);
      } else {
        return null;
      }
    }
    return pairs;
  }
  if (type.includes('application/x-www-form-urlencoded') || text.includes('=')) {
    return [...new URLSearchParams(text)];
  }
  return null;
}

export async function parseFeedback(req: Request): Promise<Parsed> {
  const text = await req.text().catch(() => '');
  const pairs = pairsOf(req, text);
  if (pairs === null || pairs.length === 0) return { kind: 'empty' };

  const answers: Record<Key, string> = { task: '', helps: '', friction: '', gap: '', more: '' };
  let role: Role = 'other';
  let locale: 'ru' | 'en' = 'ru';
  let signature = '';
  let token = '';

  for (const [name, rawValue] of pairs) {
    if (name === HONEYPOT) {
      if (rawValue !== '') return { kind: 'empty' };
      continue;
    }
    if (name.startsWith('q_')) {
      const key = name.slice(2);
      if (!(KEYS as readonly string[]).includes(key)) return { kind: 'invalid', field: key };
      const value = rawValue.trim();
      if (value.length > CAPS[key as Key]) return { kind: 'invalid', field: key };
      answers[key as Key] = value;
      continue;
    }
    if (!NON_ANSWER_FIELDS.has(name)) return { kind: 'invalid', field: name };
    if (name === 'role') role = (ROLES as readonly string[]).includes(rawValue) ? (rawValue as Role) : 'other';
    else if (name === 'locale') locale = rawValue === 'en' ? 'en' : 'ru';
    else if (name === 'signature') {
      if (rawValue.length > SIGNATURE_MAX) return { kind: 'invalid', field: 'signature' };
      signature = rawValue;
    } else if (name === 'token') {
      if (rawValue.length > TOKEN_MAX) return { kind: 'invalid', field: 'token' };
      token = rawValue;
    }
  }

  for (const key of REQUIRED) {
    if (answers[key] === '') return { kind: 'invalid', field: key };
  }

  return { kind: 'ok', payload: { role, answers, signature, locale, token } };
}
