// Canonical analytics module (PRD `docs/prd-analytics-instrumentation.md`, REQ-A01–A03).
//
// This is the ONLY module that talks to PostHog on the client besides
// `Analytics.astro` (which owns init). Components import `track()` — they must
// not read the `posthog` global themselves (REQ-A02).
//
// Design notes:
// - `track()` never throws and never breaks the UX. Before PostHog is attached,
//   events are buffered (bounded) and flushed by `flushAnalyticsQueue()`; one
//   dev warning fires.
// - `posthog-js` is NOT imported here. `Analytics.astro` lazy-loads it after the
//   first user interaction and hands the instance to `attachPosthog()`, so
//   consumer chunks (theme toggle, search, filters) stay free of the PostHog
//   bundle and off the critical path.

export type Locale = 'ru' | 'en';

/** Normalized first-touch source class (PRD §4.2, REQ-A03). */
export type ReferrerClass = 'linkedin' | 'github' | 'google' | 'direct' | 'other';

/** Content types that carry a `read_depth` signal (PRD §4.4, REQ-A09). */
export type ContentType = 'post' | 'case_study' | 'note';

/**
 * Typed event map (REQ-A01). Known events are strongly typed; the delegated
 * `data-analytics` CTAs keep their own (frozen) names and go through the
 * open-ended `track(string, …)` overload.
 */
export interface AnalyticsEventMap {
  project_viewed: { slug: string; locale: Locale; surface?: string };
  post_read: { slug: string; locale: Locale };
  lang_switched: { from: Locale; to: Locale; path: string };
  theme_change: { theme: string };
  ask_me_used: { question: string; answer_matched: boolean; locale: Locale };
  random_post_click: { slug: string; path: string };
  section_viewed: { section: string; path: string };
  outbound_click: { domain: string; url: string; surface: string; path: string };
  search_used: { query: string; results_count: number; locale: Locale };
  search_no_results: { query: string; results_count: number; locale: Locale };
  read_depth: { content_type: ContentType; slug: string; depth: number; locale: Locale };
  filter_applied: { tag: string; results_count: number; surface: 'writing' | 'notes' };
  projects_track_filter: { track: string; results_count: number; locale: Locale };
  contact_submit: { locale: Locale };
  contact_form_error: {
    locale: Locale;
    reason: 'validation' | 'rate_limited' | 'server' | 'network';
  };
  // Props mirror the delegated [data-analytics] handler in Analytics.astro, which
  // attaches `{ path }` to every named CTA — declaring `{ locale }` here would be
  // a type map that lies about what ships. Locale is still recoverable in PostHog
  // from the event's URL (/en/contact/ vs /contact/).
  booking_click: { path: string };
}

export type KnownEventName = keyof AnalyticsEventMap;

const DEV =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

/** Client type of the `posthog-js` package-level singleton (type-only import). */
type PostHogClient = typeof import('posthog-js')['posthog'];

/** PostHog instance, attached by `Analytics.astro` once it lazy-loads the SDK. */
let ph: PostHogClient | null = null;

/** Events captured before PostHog is attached, flushed on attach (bounded). */
const pending: Array<[string, Record<string, unknown>]> = [];
const PENDING_MAX = 100;

let warned = false;

/** Hand the initialised PostHog instance to this module (called by Analytics.astro). */
export function attachPosthog(instance: PostHogClient): void {
  ph = instance;
}

/**
 * Flush events buffered before PostHog was attached. Call after
 * `registerSuperProperties()` so the flushed events carry the super properties.
 */
export function flushAnalyticsQueue(): void {
  if (!ph) return;
  const queued = pending.splice(0);
  for (const [event, props] of queued) {
    try {
      ph.capture(event, props);
    } catch {
      // Analytics must never break the caller.
    }
  }
}

/** True once PostHog's init has completed on the current page. */
function isReady(): boolean {
  return ph !== null && (ph as unknown as { __loaded?: boolean }).__loaded === true;
}

function warnNotReady(): void {
  if (!DEV || warned) return;
  warned = true;
  console.warn(
    '[analytics] track() called before PostHog attach — event buffered.',
  );
}

/**
 * Capture a typed event, or an existing `data-analytics` event name.
 * Before PostHog is attached the event is buffered (bounded) and flushed by
 * `flushAnalyticsQueue()`; one dev warning is emitted.
 */
export function track<E extends KnownEventName>(event: E, props: AnalyticsEventMap[E]): void;
export function track(event: string, props?: Record<string, unknown>): void;
export function track(event: string, props?: Record<string, unknown>): void {
  if (!ph) {
    warnNotReady();
    if (pending.length < PENDING_MAX) pending.push([event, props ?? {}]);
    return;
  }
  try {
    ph.capture(event, props ?? {});
  } catch {
    // Analytics must never break the caller.
  }
}

/** Locale is derivable from the path alone (`/en/…` is English). */
export function localeFromPath(pathname: string): Locale {
  return /^\/en(\/|$)/.test(pathname) ? 'en' : 'ru';
}

/**
 * Map a referrer hostname to the normalized first-touch class.
 * Pure and unit-tested (REQ-A03 acceptance).
 */
export function classifyReferrer(referrer: string | null | undefined): ReferrerClass {
  if (!referrer) return 'direct';
  const r = referrer.toLowerCase();
  if (r === '$direct' || r === 'direct') return 'direct';
  if (r.includes('linkedin.')) return 'linkedin';
  if (r.includes('github.')) return 'github';
  if (r.includes('google.')) return 'google';
  return 'other';
}

export interface FirstTouch {
  referrer_class: ReferrerClass;
  landing_path: string;
}

const FIRST_TOUCH_KEY = 'dswo_ph_first_touch';

function store(kind: 'session' | 'local'): Storage | null {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readFirstTouch(s: Storage | null): FirstTouch | null {
  if (!s) return null;
  try {
    const raw = s.getItem(FIRST_TOUCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirstTouch>;
    if (typeof parsed.landing_path !== 'string') return null;
    return {
      referrer_class: classifyReferrer(parsed.referrer_class),
      landing_path: parsed.landing_path,
    };
  } catch {
    return null;
  }
}

function writeFirstTouch(s: Storage | null, value: FirstTouch): void {
  if (!s) return;
  try {
    s.setItem(FIRST_TOUCH_KEY, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, quota).
  }
}

/** Compute first-touch attribution from a raw referrer URL and landing path. */
export function computeFirstTouch(referrer: string, pathname: string): FirstTouch {
  let domain = '';
  if (referrer) {
    try {
      domain = new URL(referrer).hostname;
    } catch {
      domain = '';
    }
  }
  return { referrer_class: classifyReferrer(domain), landing_path: pathname };
}

/**
 * First-touch attribution, computed once and persisted (sessionStorage, with a
 * localStorage fallback). A second call never overwrites the stored value.
 */
export function firstTouch(): FirstTouch {
  const session = store('session');
  const local = store('local');
  const existing = readFirstTouch(session) ?? readFirstTouch(local);
  if (existing) return existing;

  const value = computeFirstTouch(document.referrer || '', window.location.pathname);
  writeFirstTouch(session, value);
  writeFirstTouch(local, value);
  return value;
}

/**
 * Register the super properties (PRD §4.2) exactly once per page load.
 * Called by `Analytics.astro` immediately after `posthog.init()`.
 */
export function registerSuperProperties(): void {
  if (!isReady() || !ph) return;

  let audience: string | null = null;
  try {
    audience = window.localStorage.getItem('audience');
  } catch {
    audience = null;
  }

  const reducedMotion =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const touch = firstTouch();

  try {
    ph.register({
      locale: localeFromPath(window.location.pathname),
      audience,
      theme: document.documentElement.getAttribute('data-theme') || 'dark',
      prefers_reduced_motion: reducedMotion,
      initial_referrer_class: touch.referrer_class,
      landing_path: touch.landing_path,
    });
  } catch {
    // Never break init.
  }
}
