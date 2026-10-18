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

import { AUDIENCES, type Audience } from './projects';

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
  // `surface` keeps the two search inputs apart: the site-wide SearchBox
  // (`header`) and the glossary filter (`glossary`) both emit these names, and
  // without the prop they collapse into one series in PostHog.
  search_used: {
    query: string;
    results_count: number;
    locale: Locale;
    surface: 'header' | 'glossary';
  };
  search_no_results: {
    query: string;
    results_count: number;
    locale: Locale;
    surface: 'header' | 'glossary';
  };
  read_depth: { content_type: ContentType; slug: string; depth: number; locale: Locale };
  filter_applied: { tag: string; results_count: number; surface: 'writing' | 'glossary' };
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
  // Persona gate (`docs/prd-persona-landing.md` §11). `source` distinguishes the
  // gate card from the role switcher so the two paths stay separable in funnels.
  persona_gate_view: { lang: Locale; has_stored_choice: boolean };
  // `source` is the surface the choice came from. `header`/`menu` are
  // `NavRoles.astro`'s two variants (bar vs drawer) — they were shipped before
  // this union existed, so declaring only `gate | switch` made the map lie
  // about what reaches PostHog.
  persona_selected: {
    persona: Audience;
    lang: Locale;
    source: 'gate' | 'switch' | 'header' | 'menu';
  };
  // Denominator for the primary-CTA rate (exposure→click). The numerator is the
  // delegated `booking_click` / `cv_download_pdf` from `[data-analytics]`, which
  // carries `{ path }` and no surface prop — so the pair is joined on
  // `surface` against the event's own path in PostHog, not on a shared prop.
  cta_exposure: { surface: string; lang: Locale };
  // Library + contact surfaces that were already shipping through the delegated
  // `[data-analytics]` handler but were never declared here (docs §2 drift).
  library_tile: { path: string };
  source_external: { path: string };
  linkedin_contact: { path: string };
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

/**
 * One-shot callbacks waiting for `attachPosthog` (see `whenAnalyticsReady`).
 * Kept separate from `pending` because they are actions, not events.
 */
const readyCallbacks: Array<() => void> = [];

let warned = false;

/** Hand the initialised PostHog instance to this module (called by Analytics.astro). */
export function attachPosthog(instance: PostHogClient): void {
  ph = instance;
  // Anything waiting on the SDK may proceed now (bounded waiters included).
  for (const callback of readyCallbacks.splice(0)) callback();
}

/**
 * Run `action` once the SDK is attached, or after `maxWaitMs` — whichever comes
 * first. Runs at most once.
 *
 * Why this exists: a capture that *causes* a navigation (the "random post"
 * button sets `window.location`) used to race the lazy SDK load. The event went
 * into the pre-attach buffer, the browser navigated, and the buffer died with
 * the page — the first action of a session could vanish. Waiting a bounded
 * amount for the attach keeps the capture, and still navigates when analytics
 * is unavailable (ad-blocker, failed chunk load) instead of hanging.
 */
export function whenAnalyticsReady(action: () => void, maxWaitMs = 150): void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    action();
  };
  if (ph) {
    run();
    return;
  }
  readyCallbacks.push(run);
  window.setTimeout(run, maxWaitMs);
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

/**
 * Test-only: detach the SDK handle and drop the buffered events.
 *
 * The buffering contract is order-dependent (it only holds while nothing has
 * called `attachPosthog` yet), and Bun shares one module registry across the
 * files of a run — so a second test file that attaches an SDK would silently
 * break the buffering assertions in `persona.test.ts`. Resetting state in a
 * `beforeEach` removes that cross-file ordering dependency. Never called by
 * application code.
 */
export function resetAnalyticsForTests(): void {
  ph = null;
  pending.splice(0);
  readyCallbacks.splice(0);
  warned = false;
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

const AUDIENCE_KEY = 'audience';

/**
 * The stored persona, or `null` when nothing is stored or the value is stale
 * (`recruiter|analyst|learner` from the never-shipped taxonomy). Returning null
 * rather than the raw string keeps an unrecognized value out of both the
 * super-property and the gate's highlight logic.
 */
export function readAudience(): Audience | null {
  try {
    const saved = window.localStorage.getItem(AUDIENCE_KEY);
    return AUDIENCES.includes(saved as Audience) ? (saved as Audience) : null;
  } catch {
    return null;
  }
}

/**
 * Persist the persona choice and mirror it onto `<html data-audience>` — the
 * two writes always happen together, so the attribute never disagrees with the
 * key it is derived from. Called before the click's navigation commits.
 */
export function writeAudience(audience: Audience): void {
  try {
    window.localStorage.setItem(AUDIENCE_KEY, audience);
  } catch {
    // Storage may be unavailable (private mode, quota) — the attribute still moves.
  }
  document.documentElement.setAttribute('data-audience', audience);
}


/**
 * Map a referrer hostname to the normalized first-touch class.
 * Pure and unit-tested (REQ-A03 acceptance).
 */export function classifyReferrer(referrer: string | null | undefined): ReferrerClass {
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

const REFERRER_CLASSES: ReadonlySet<string> = new Set([
  'linkedin',
  'github',
  'google',
  'direct',
  'other',
]);

function isReferrerClass(value: unknown): value is ReferrerClass {
  return typeof value === 'string' && REFERRER_CLASSES.has(value);
}

function readFirstTouch(s: Storage | null): FirstTouch | null {
  if (!s) return null;
  try {
    const raw = s.getItem(FIRST_TOUCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirstTouch>;
    if (typeof parsed.landing_path !== 'string') return null;
    return {
      // The stored value is already a class name, not a hostname — running it
      // through classifyReferrer again collapses every class except 'direct'
      // to 'other' ('linkedin' does not contain 'linkedin.'), destroying
      // first-touch attribution on every page load after the first.
      referrer_class: isReferrerClass(parsed.referrer_class)
        ? parsed.referrer_class
        : 'other',
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

  // Validated against the taxonomy rather than passed through raw: an
  // unrecognized value (a stale `recruiter`, a typo) registers as null instead
  // of polluting the super-property with a category that no page renders.
  const audience = readAudience();

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
