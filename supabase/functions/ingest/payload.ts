// Pure request parsing and event normalisation — no Deno global, no network.
//
// The body is read with `req.text()` by the handler, never `formData()`: the
// browser sends it with sendBeacon, which produces `text/plain`, and
// formData() throws on that. Both a single event and `{events:[…]}` are
// accepted; the client always sends the batch form, the single form is what a
// curl smoke check types by hand.

import {
  BATCH_MAX,
  EVENT_NAME_MAX,
  EVENT_NAME_RE,
  LOCALES,
  PATH_MAX,
  PROPS,
  PROPS_MAX,
  QUERY_MAX,
  SESSION_MAX,
  SESSION_MIN,
  STRING_MAX,
} from './limits.ts';

export interface IngestEvent {
  event_name: string;
  session_id: string | null;
  path: string;
  locale: string | null;
  props: Record<string, string | number | boolean>;
  client_ts: string | null;
}

const PROPS_SET = new Set<string>(PROPS);
const LOCALE_SET = new Set<string>(LOCALES);

const isScalar = (v: unknown): v is string | number | boolean =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

function cap(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** Keep only allowlisted, scalar props; cap strings; `query` gets the shorter cap. */
export function sanitizeProps(raw: unknown): Record<string, string | number | boolean> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= PROPS_MAX) break;
    if (!PROPS_SET.has(key) || !isScalar(value)) continue;
    out[key] = typeof value === 'string' ? cap(value, key === 'query' ? QUERY_MAX : STRING_MAX) : value;
    n++;
  }
  return out;
}

/** Epoch milliseconds → ISO, clamped so a skewed or hostile clock cannot date a row into 2001. */
function clientTs(raw: unknown, now: number): string | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const skew = Math.abs(now - raw);
  return new Date(skew > 7 * 24 * 60 * 60 * 1000 ? now : raw).toISOString();
}

/** The beacon writes `type: 'pageview'`; track() writes the event name. Map both. */
function eventName(raw: Record<string, unknown>): string | null {
  const name = typeof raw.event_name === 'string' ? raw.event_name : typeof raw.type === 'string' ? raw.type : '';
  if (name.length > EVENT_NAME_MAX || !EVENT_NAME_RE.test(name)) return null;
  return name;
}

function normalizeOne(raw: unknown, now: number): IngestEvent | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const name = eventName(e);
  if (name === null) return null;

  const path = typeof e.path === 'string' ? cap(e.path, PATH_MAX) : '';
  if (path === '' || !path.startsWith('/')) return null;

  const session = typeof e.session_id === 'string' &&
      e.session_id.length >= SESSION_MIN && e.session_id.length <= SESSION_MAX
    ? e.session_id
    : null;

  const locale = typeof e.locale === 'string' && LOCALE_SET.has(e.locale) ? e.locale : null;

  return {
    event_name: name,
    session_id: session,
    path,
    locale,
    props: sanitizeProps(e.props),
    client_ts: clientTs(e.ts, now),
  };
}

/** Accepts a single event object or `{events:[…]}`; returns [] for anything unusable. */
export function normalizeBody(body: unknown, now = Date.now()): IngestEvent[] {
  const list = Array.isArray(body)
    ? body
    : body !== null && typeof body === 'object' && Array.isArray((body as { events?: unknown }).events)
    ? (body as { events: unknown[] }).events
    : typeof body === 'object' && body !== null
    ? [body]
    : [];
  const out: IngestEvent[] = [];
  for (const item of list.slice(0, BATCH_MAX)) {
    const event = normalizeOne(item, now);
    if (event !== null) out.push(event);
  }
  return out;
}

export function uaClass(userAgent: string, isBot: (ua: string) => boolean): 'human' | 'bot' | 'unknown' {
  if (userAgent === '') return 'unknown';
  return isBot(userAgent) ? 'bot' : 'human';
}
