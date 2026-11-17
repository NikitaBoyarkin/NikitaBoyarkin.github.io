// Feedback endpoint. The browser posts here with no Supabase key; the trust
// boundary is RLS with zero policies on the feedback tables, so only this
// function (service_role) can write. Config and network access arrive as
// arguments, so handler_test.ts drives every branch without a server.

import { type FeedbackPayload, parseFeedback, type Role } from './payload.ts';

export interface Env {
  supabaseUrl: string;
  serviceRole: string;
  ipSalt: string;
}

export interface Deps {
  lookupInvite(tokenHash: string): Promise<{ id: string; role: Role; maxResponses: number; used: number } | null>;
  countRecentByIp(ipHash: string, sinceIso: string): Promise<number>;
  insertResponse(row: Record<string, unknown>): Promise<void>;
}

const SITE = 'https://nikitaboyarkin.github.io';
const RATE_MAX = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const CORS = {
  'access-control-allow-origin': SITE,
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const THANKS: Record<'ru' | 'en', { title: string; body: string }> = {
  ru: { title: 'Спасибо', body: 'Отзыв записан. Он нигде не публикуется — только у меня.' },
  en: { title: 'Thank you', body: 'Your feedback is recorded. It is never published — only I read it.' },
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function thanksPage(locale: 'ru' | 'en'): Response {
  const copy = THANKS[locale];
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">` +
    `<meta name="robots" content="noindex"><title>${copy.title}</title>` +
    `<style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem}</style>` +
    `</head><body><h1>${copy.title}</h1><p>${copy.body}</p>` +
    `<p><a href="/">← nikitaboyarkin.github.io</a></p></body></html>`;
  return new Response(html, { status: 200, headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' } });
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

function postgrest(env: Env): Deps {
  const headers = { apikey: env.serviceRole, authorization: `Bearer ${env.serviceRole}` };

  return {
    async lookupInvite(tokenHash) {
      const query = `token_hash=eq.${tokenHash}&active=eq.true&select=id,role,max_responses`;
      const res = await fetch(`${env.supabaseUrl}/rest/v1/feedback_invites?${query}`, { headers });
      if (!res.ok) return null;
      const rows = await res.json() as { id: string; role: Role; max_responses: number }[];
      if (rows.length === 0) return null;
      const invite = rows[0];

      const countRes = await fetch(
        `${env.supabaseUrl}/rest/v1/feedback_responses?invite_id=eq.${invite.id}&select=id`,
        {
          method: 'HEAD',
          headers: { ...headers, prefer: 'count=exact' },
        },
      );
      const total = Number((countRes.headers.get('content-range') ?? '*/0').split('/').pop());

      return { id: invite.id, role: invite.role, maxResponses: invite.max_responses, used: total };
    },

    async countRecentByIp(ipHash, sinceIso) {
      const query = `ip_hash=eq.${ipHash}&created_at=gt.${sinceIso}&select=id`;
      const res = await fetch(`${env.supabaseUrl}/rest/v1/feedback_responses?${query}`, {
        method: 'HEAD',
        headers: { ...headers, prefer: 'count=exact' },
      });
      if (!res.ok) throw new Error(`count failed ${res.status}`);
      return Number((res.headers.get('content-range') ?? '*/0').split('/').pop());
    },

    async insertResponse(row) {
      const res = await fetch(`${env.supabaseUrl}/rest/v1/feedback_responses`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json', prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error(`insert failed ${res.status}`);
    },
  };
}

export async function handleFeedback(req: Request, env: Env, injected?: Partial<Deps>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: CORS });

  if (!env.supabaseUrl || !env.serviceRole || !env.ipSalt) {
    console.error('feedback: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / FEEDBACK_IP_SALT are not set');
    return new Response(null, { status: 500, headers: CORS });
  }

  const parsed = await parseFeedback(req);
  // A filled honeypot looks exactly like a success, so the bot learns nothing.
  if (parsed.kind === 'empty') return new Response(null, { status: 200, headers: CORS });
  if (parsed.kind === 'invalid') return json(400, { error: 'invalid', field: parsed.field });

  const payload: FeedbackPayload = parsed.payload;
  const deps = { ...postgrest(env), ...injected };

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() || '0.0.0.0';
  const ipHash = await sha256Hex(ip + env.ipSalt);

  let recent = 0;
  try {
    recent = await deps.countRecentByIp(ipHash, new Date(Date.now() - RATE_WINDOW_MS).toISOString());
  } catch (error) {
    // Fail open: an unreadable counter must not cost a real answer.
    console.error(`feedback: rate-limit count failed ${error instanceof Error ? error.name : typeof error}`);
  }
  if (recent >= RATE_MAX) return json(429, { error: 'rate_limited' });

  let role: Role = payload.role;
  let source: 'open' | 'invited' = 'open';
  let inviteId: string | null = null;

  if (payload.token !== '') {
    const invite = await deps.lookupInvite(await sha256Hex(payload.token)).catch(() => null);
    if (invite !== null) {
      if (invite.used >= invite.maxResponses) return json(429, { error: 'invite_exhausted' });
      role = invite.role;
      source = 'invited';
      inviteId = invite.id;
    }
  }

  try {
    await deps.insertResponse({
      role,
      source,
      invite_id: inviteId,
      answers: payload.answers,
      signature: payload.signature === '' ? null : payload.signature,
      locale: payload.locale,
      ip_hash: ipHash,
    });
  } catch (error) {
    console.error(`feedback: insert failed ${error instanceof Error ? error.name : typeof error}`);
    return json(500, { error: 'server' });
  }

  if ((req.headers.get('accept') ?? '').includes('text/html')) return thanksPage(payload.locale);
  return json(200, { ok: true });
}

export const unexpectedError = (): Response => new Response(null, { status: 500, headers: CORS });
