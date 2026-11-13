// Single source of truth for what the ingest function accepts.
//
// The CHECK constraints in supabase/migrations mirror these numbers, and
// limits_drift_test.ts compares the two — editing a value here without the
// matching migration turns the suite red instead of shipping the drift.
//
// Event names are validated by shape, not by an enumerated allowlist: the site
// already has ~40 `data-analytics` names and a frozen list here would silently
// drop every new one until someone remembered to add it. The shape rule still
// stops free text from becoming a metric name.

export const EVENT_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;

export const PROPS = [
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
  // Граф докладов (/talks/): tab switches, dialog opens/nav, graph node clicks.
  'tab',
  'group',
  'talk_id',
  'track_id',
  'link',
  'direction',
  'graph',
  'node_kind',
  'node_id',
] as const;

/** `outbound_click.url` is deliberately absent: full URLs can carry tokens and
 * query strings, and the `domain` prop already answers "where did they go". */

export const EVENT_NAME_MAX = 60;
export const SESSION_MIN = 8;
export const SESSION_MAX = 64;
export const PATH_MAX = 512;
export const QUERY_MAX = 100;
export const STRING_MAX = 300;
export const PROPS_MAX = 24;
export const BATCH_MAX = 25;

export const RATE_MAX = 120;
export const RATE_WINDOW_MS = 60_000;

export const BOT_UA_RE =
  /bot|crawler|spider|slurp|bingpreview|headless|lighthouse|pagespeed|facebookexternalhit|telegrambot|whatsapp|curl\/|wget\/|python-requests|go-http-client|axios\//i;

export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
