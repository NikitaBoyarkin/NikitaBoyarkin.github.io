// Second analytics sink: every event that goes to PostHog is also posted to our
// own Supabase Edge Function, which writes it to public.analytics_events.
//
// The endpoint is a constant with a placeholder, not an env var — a var that is
// missing from CI fails silently (see src/lib/contact.ts), while a placeholder
// is greppable and keeps the site inert until someone replaces it.
//
// The payload is JSON text sent through sendBeacon. That produces
// `text/plain`, which is a CORS-safelisted content type: no preflight, and the
// client cannot read the response — the handler answers 204 to everything the
// visitor can cause.

import { getSessionId } from './beacon';

export const INGEST_ENDPOINT = 'https://geojpakugqlcwyhtnjvv.supabase.co/functions/v1/ingest';

/** Build-time gate for <Ingest />: false until PROJECT_REF is replaced. */
export const INGEST_ENABLED = !INGEST_ENDPOINT.includes('PROJECT_REF');

/** Mirrors `PROPS` in supabase/functions/ingest/limits.ts; a test holds them together. */
export const INGEST_PROPS = [
  'slug',
  'locale',
  'path',
  'surface',
  'tag',
  'section',
  'content_type',
  'depth',
  'results_count',
  'rank',
  'href',
  'type',
  'domain',
  'theme',
  'persona',
  'lang',
  'source',
  'matched_id',
  'answer_matched',
  'question_source',
  'track',
  'query',
] as const;

type Scalar = string | number | boolean;

const PROPS_SET = new Set<string>(INGEST_PROPS);
const STRING_MAX = 300;
const QUERY_MAX = 100;
const PROPS_MAX = 24;

let enabled = INGEST_ENABLED;

/** Test-only: the gate is compile-time in production, so tests need a switch. */
export function setIngestEnabledForTests(value: boolean): void {
  enabled = value;
}

export interface IngestEvent {
  event_name: string;
  session_id: string | null;
  path: string;
  locale: string;
  ts: number;
  props: Record<string, Scalar>;
}

/** Allowlisted, scalar-only props; `url` is deliberately absent (see limits.ts). */
export function sanitizeIngestProps(raw?: Record<string, unknown>): Record<string, Scalar> {
  const out: Record<string, Scalar> = {};
  if (!raw) return out;
  let n = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (n >= PROPS_MAX || !PROPS_SET.has(key)) continue;
    if (typeof value === 'string') {
      const max = key === 'query' ? QUERY_MAX : STRING_MAX;
      out[key] = value.length > max ? value.slice(0, max) : value;
      n++;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      n++;
    }
  }
  return out;
}

export function buildIngestEvent(
  name: string,
  props?: Record<string, unknown>,
  now = Date.now(),
): IngestEvent {
  let sessionId: string | null = null;
  let path = '/';
  let locale = 'ru';
  try {
    sessionId = getSessionId();
  } catch {
    // sessionStorage blocked (private mode, cookie settings): the event is still useful
  }
  try {
    const p = window.location.pathname || '/';
    // The server rejects a path that does not start with '/', so normalise here.
    path = p.startsWith('/') ? p : '/';
  } catch {
    // no window: tests and non-DOM callers
  }
  try {
    locale = document.documentElement.lang === 'en' ? 'en' : 'ru';
  } catch {
    // no document
  }
  return { event_name: name, session_id: sessionId, path, locale, ts: now, props: sanitizeIngestProps(props) };
}

/** Never throws and never blocks the caller — same contract as `track()`. */
export function sendIngest(name: string, props?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    const body = JSON.stringify({ events: [buildIngestEvent(name, props)] });
    const sent = navigator.sendBeacon?.(INGEST_ENDPOINT, body) ?? false;
    // sendBeacon returns false when the UA refuses the payload; keepalive fetch
    // is the fallback that still survives a navigation.
    if (!sent) void fetch(INGEST_ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // Analytics must never break the caller.
  }
}
