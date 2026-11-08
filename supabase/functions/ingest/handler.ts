// Ingest endpoint for the static portfolio site. The browser posts here with
// sendBeacon and the site ships no Supabase key; the trust boundary is RLS with
// zero policies on public.analytics_events, so only this function
// (service_role) can write.
//
// Two consequences of sendBeacon shape this file:
//   - the body arrives as `text/plain`, so it is read with req.text() and
//     JSON.parse — req.formData() throws on that content type;
//   - the client cannot read the response, so every outcome the visitor can
//     cause is 204. Rejections are logged, not reported.
//
// Config arrives as an argument and nothing here touches the Deno global, so
// handler_test.ts can drive every branch without starting a server.

import { BOT_UA_RE, RATE_MAX, RATE_WINDOW_MS } from './limits.ts';
import { normalizeBody, uaClass } from './payload.ts';

export interface Env {
  supabaseUrl: string;
  serviceRole: string;
  ipSalt: string;
}

const SITE = 'https://nikitaboyarkin.github.io';

const CORS = {
  'access-control-allow-origin': SITE,
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const noContent = (): Response => new Response(null, { status: 204, headers: CORS });

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Deno's fetch rejection message embeds the URL, which carries no secret here,
// but the name alone ("TypeError", "TimeoutError") already separates a network
// fault from a bug — and keeps the log boring.
const errorName = (error: unknown): string => (error instanceof Error ? error.name : typeof error);

function postgrestError(payload: unknown): string {
  if (payload === null || typeof payload !== 'object') return 'unparseable body';
  const { code, message } = payload as { code?: unknown; message?: unknown };
  const parts = [code, message].filter((part): part is string => typeof part === 'string' && part !== '');
  return parts.length > 0 ? parts.join(' ') : 'unparseable body';
}

export async function handle(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return noContent();
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: CORS });

  // IP_SALT has no default: a shared fallback salt makes ip_hash reversible by
  // brute force over the IPv4 space. Missing salt is a misconfiguration.
  if (!env.supabaseUrl || !env.serviceRole || !env.ipSalt) {
    console.error('ingest: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / IP_SALT are not set');
    return new Response(null, { status: 500, headers: CORS });
  }

  const raw = await req.text().catch(() => '');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }

  const events = normalizeBody(body);
  if (events.length === 0) return noContent();

  const ua = req.headers.get('user-agent') ?? '';
  if (uaClass(ua, (value) => BOT_UA_RE.test(value)) === 'bot') return noContent();

  // Rightmost hop: a client may prepend entries to x-forwarded-for, and a
  // prepended value only pushes the real ones right, so the leftmost is the one
  // an attacker picks freely.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() || '0.0.0.0';
  const ipHash = await sha256Hex(ip + env.ipSalt);

  try {
    const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/insert_analytics_events`, {
      method: 'POST',
      headers: {
        apikey: env.serviceRole,
        authorization: `Bearer ${env.serviceRole}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_events: events,
        p_ip_hash: ipHash,
        p_ua_class: uaClass(ua, (value) => BOT_UA_RE.test(value)),
        p_max: RATE_MAX,
        p_window_seconds: Math.floor(RATE_WINDOW_MS / 1000),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let payload: unknown = null;
      try {
        payload = text.trim() === '' ? null : JSON.parse(text);
      } catch {
        // unparseable error body: postgrestError reports it as such
      }
      console.error(`ingest: insert failed ${res.status} ${postgrestError(payload)}`);
    }
  } catch (error) {
    console.error(`ingest: insert failed transport: ${errorName(error)}`);
  }

  return noContent();
}

export const unexpectedError = (): Response => new Response(null, { status: 500, headers: CORS });
