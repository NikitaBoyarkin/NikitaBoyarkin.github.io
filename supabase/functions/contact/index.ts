// Contact-form endpoint for the static portfolio site: the browser posts here
// cross-origin and the site ships no Supabase key. The trust boundary is RLS with zero
// policies on public.contact_messages, so only this function (service_role) can write.
// PostgREST is called with plain fetch — no supabase-js import — so nothing has to
// resolve from a registry at deploy time.

// This folder is inside the site's astro tsconfig, which ships no Deno types, so the
// globals are declared locally (`declare` emits nothing; `export {}` scopes them here).
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
export {};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''; // optional
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') ?? ''; // optional
const IP_SALT = Deno.env.get('IP_SALT') ?? 'dswok-contact-v1'; // optional; a per-deploy salt is better

type Locale = 'ru' | 'en';

const SITE = 'https://nikitaboyarkin.github.io';
const CONTACT_URL: Record<Locale, string> = { ru: `${SITE}/contact/`, en: `${SITE}/en/contact/` };
const RATE_WINDOW_MS = 10 * 60 * 1000; // matches the ip_hash/created_at index
const RATE_MAX = 3;
const SOURCES = ['direct', 'linkedin', 'hh', 'telegram', 'github', 'referral', 'other']; // mirrors the CHECK

// Carried on every response, errors included: the JSON path is a preflighted
// cross-origin fetch, while the no-JS form POST is a navigation and ignores CORS —
// which is exactly why that fallback works without it.
const CORS = {
  'access-control-allow-origin': SITE,
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const TEXT = {
  ru: {
    sent: 'Спасибо, сообщение отправлено',
    sentLine: 'Я отвечу в течение пары дней.',
    failed: 'Не удалось отправить сообщение',
    invalid: (fields: string[]) => `Проверьте поля: ${fields.join(', ')}.`,
    limited: 'Слишком много сообщений. Попробуйте через несколько минут.',
    store: 'Ошибка на сервере. Попробуйте позже.',
    back: 'Вернуться на страницу контактов',
  },
  en: {
    sent: 'Thanks, your message has been sent',
    sentLine: "I'll get back to you within a couple of days.",
    failed: 'Could not send the message',
    invalid: (fields: string[]) => `Please check these fields: ${fields.join(', ')}.`,
    limited: 'Too many messages. Please try again in a few minutes.',
    store: 'Server error. Please try again later.',
    back: 'Back to the contact page',
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}

// Postgres char_length counts code points, not UTF-16 units, so a message that fits
// the table's CHECK constraint is never rejected here.
const codePoints = (value: string): number => [...value].length;

// Form values can be File, JSON values can be numbers or objects: anything that is
// not a string becomes empty rather than leaking a non-text value into the row.
const field = (value: unknown): string => (typeof value === 'string' ? value : '');

async function readBody(req: Request): Promise<Record<string, string> | null> {
  const out: Record<string, string> = {};
  try {
    if ((req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      const raw: unknown = await req.json();
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) out[key] = field(value);
    } else {
      (await req.formData()).forEach((value, key) => {
        out[key] = field(value);
      });
    }
    return out;
  } catch {
    return null; // unparseable body: reported as invalid, never as a store failure
  }
}

const wantsHtml = (req: Request): boolean => (req.headers.get('accept') ?? '').toLowerCase().includes('text/html');

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
}

function htmlPage(status: number, locale: Locale, title: string, line: string): Response {
  const page = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1.25rem;line-height:1.6">
<h1 style="font-size:1.35rem">${title}</h1>
<p>${line}</p>
<p><a href="${CONTACT_URL[locale]}">${TEXT[locale].back}</a></p>
</body></html>`;
  return new Response(page, { status, headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' } });
}

function success(req: Request, locale: Locale): Response {
  if (!wantsHtml(req)) return json(200, { ok: true });
  return htmlPage(200, locale, TEXT[locale].sent, TEXT[locale].sentLine);
}

function fail(req: Request, locale: Locale, status: number, error: string, fields: string[] = []): Response {
  if (!wantsHtml(req)) return json(status, fields.length > 0 ? { ok: false, error, fields } : { ok: false, error });
  const text = TEXT[locale];
  const line = error === 'invalid' ? text.invalid(fields) : error === 'rate_limited' ? text.limited : text.store;
  return htmlPage(status, locale, text.failed, line);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function pingTelegram(locale: Locale, name: string, contact: string, company: string, message: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return; // optional: unset means no ping
  const who = [
    `Имя: ${escapeHtml(name || '—')}`,
    `Контакт: ${escapeHtml(contact)}`,
    `Компания: ${escapeHtml(company || '—')}`,
  ].join('\n');
  const text = `Новое сообщение с сайта\n${who}\nЯзык: ${locale}\n\n${escapeHtml(message)}`;
  const ping = fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
    .then((res) => {
      if (!res.ok) console.error(`contact: telegram ping returned ${res.status}`);
    })
    .catch((error: unknown) => console.error('contact: telegram ping failed', error)); // never fails the request
  const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (edge) edge.waitUntil(ping);
  else await ping; // without EdgeRuntime (local serve) awaiting is what keeps it alive
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail(req, 'ru', 405, 'method_not_allowed');
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('contact: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
    return fail(req, 'ru', 500, 'misconfigured');
  }

  const body = await readBody(req);
  if (body === null) return fail(req, 'ru', 400, 'invalid', ['body']);
  const locale: Locale = body.locale === 'en' ? 'en' : 'ru';

  // Honeypot: a filled hidden field means a bot. Answer exactly like a real
  // submission so it learns nothing, and insert nothing.
  if ((body.website ?? '').trim() !== '') return success(req, locale);

  const name = (body.name ?? '').trim();
  const contact = (body.contact ?? '').trim();
  const company = (body.company ?? '').trim();
  const message = (body.message ?? '').trim();
  // These caps mirror the table's CHECK constraints and the client validator.
  const fields: string[] = [];
  if (codePoints(contact) < 3 || codePoints(contact) > 200) fields.push('contact');
  if (codePoints(message) < 5 || codePoints(message) > 4000) fields.push('message');
  if (codePoints(name) > 120) fields.push('name');
  if (codePoints(company) > 160) fields.push('company');
  if (fields.length > 0) return fail(req, locale, 400, 'invalid', fields);

  const source = SOURCES.includes(body.source ?? '') ? (body.source as string) : 'direct';
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0';
  // Only the salted hash is ever stored; the raw address stays in the request.
  const ipHash = await sha256Hex(ip + IP_SALT);
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  // PostgREST count trick: Prefer: count=exact with Range: 0-0 puts the total in
  // content-range ("0-0/7"). Fail open — a lookup hiccup must not swallow a real
  // message, and if PostgREST is truly down the insert below fails anyway.
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/contact_messages?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(since)}`,
    { headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, prefer: 'count=exact', range: '0-0' } },
  );
  const total = Number.parseInt((countRes.headers.get('content-range') ?? '').split('/')[1] ?? '', 10);
  if (Number.isFinite(total) && total >= RATE_MAX) return fail(req, locale, 429, 'rate_limited');

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ name: name || null, contact, message, company: company || null, source, locale, ip_hash: ipHash }),
  });
  if (!insertRes.ok) {
    const detail = await insertRes.text().catch(() => '');
    console.error(`contact: insert failed ${insertRes.status} ${detail.slice(0, 300)}`);
    return fail(req, locale, 502, 'store_failed');
  }

  await pingTelegram(locale, name, contact, company, message);
  return success(req, locale);
});
