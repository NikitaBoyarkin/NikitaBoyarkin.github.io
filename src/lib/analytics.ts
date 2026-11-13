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
import { sendIngest } from './ingest';
import { firstTouch, utmSuperProperties, visitUtm } from './attribution';

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
  // No free text: the visitor's typed question never leaves the browser (the
  // site documents that it collects no PII — a 100-char cap is not a redaction).
  // `matched_id` is what the dashboards segment on, and `question_source` keeps
  // curated chip text out of the typed series.
  ask_me_used: {
    matched_id: string | null;
    answer_matched: boolean;
    locale: Locale;
    question_source: "typed" | "chip";
  };
  random_post_click: { slug: string; path: string };
  section_viewed: { section: string; path: string };
  outbound_click: { domain: string; url: string; surface: string; path: string };
  // `surface` keeps the search inputs apart: the site-wide SearchBox (`header`),
  // the glossary filter (`glossary`), the Explorer (`explorer`), the homepage
  // hero (`hero`) and the programme panel on `/talks/` (`talks`) all emit these
  // names, and without the prop they collapse into one series in PostHog.
  search_used: {
    query: string;
    results_count: number;
    locale: Locale;
    surface: 'header' | 'glossary' | 'explorer' | 'hero' | 'talks';
  };
  search_no_results: {
    query: string;
    results_count: number;
    locale: Locale;
    surface: 'header' | 'glossary' | 'explorer' | 'hero' | 'talks';
  };
  // Which result the visitor actually opened. `query` is repeated so a click can
  // be joined to its query without relying on session stitching, and `rank` is
  // 1-based so CTR@1..3 is a plain aggregation.
  search_result_click: {
    query: string;
    rank: number;
    href: string;
    type: string;
    locale: Locale;
    surface: 'header' | 'explorer' | 'hero';
  };
  read_depth: { content_type: ContentType; slug: string; depth: number; locale: Locale };
  filter_applied: {
    tag: string;
    results_count: number;
    surface: 'writing' | 'glossary' | 'explorer' | 'talks';
  };
  projects_track_filter: { track: string; results_count: number; locale: Locale };
  contact_submit: { locale: Locale };
  contact_form_error: {
    locale: Locale;
    reason: 'validation' | 'rate_limited' | 'server' | 'network';
  };
  // Props mirror the delegated [data-analytics] handler in Analytics.astro, which
  // attaches `{ path }` to every named CTA and adds `surface` when the element
  // carries `data-analytics-surface` — declaring `{ locale }` here would be a
  // type map that lies about what ships. Locale is still recoverable in PostHog
  // from the event's URL (/en/contact/ vs /contact/).
  // `surface` is optional because it follows the attribute, but both contact
  // pages always pass `contact_cta` (contact.astro / en/contact.astro).
  booking_click: { path: string; surface?: string };
  // Any anchor that opens the contact page, not the booking page. `surface`
  // names the placement (`nav`, `footer`, `case_next_step`,
  // `post_next_step`) so "read a case, then wrote" stays separable from a
  // header click. Added 2026-10-31: before it, 262 `/contact/` anchors shipped
  // with exactly one instrumented (a lang switch).
  contact_page_click: { path: string; surface?: string };
  // `source` is the surface the choice came from. `header`/`menu` were the bar
  // and drawer variants of the role buttons (`NavRoles.astro`, since replaced by
  // one «Найм» link) — they were shipped before
  // this union existed, so declaring only `gate | switch` made the map lie
  // about what reaches PostHog.
  persona_selected: {
    persona: Audience;
    lang: Locale;
    source: 'gate' | 'switch' | 'header' | 'menu';
  };
  // Library + contact surfaces that were already shipping through the delegated
  // `[data-analytics]` handler but were never declared here (docs §2 drift).
  library_tile: { path: string };
  source_external: { path: string };
  linkedin_contact: { path: string };
  // The homepage's first screen, rebuilt 2026-11-01 around who → proven → do.
  // `telegram_header` is the bar's labelled CTA — deliberately not
  // `telegram_footer` (the chip beside it) because the two surfaces answer
  // different questions: "the button I can read" vs "the icon I recognise".
  // `cv_download` was declared here for a day and then removed with the CV
  // button: an event nothing emits is a dashboard view with no numerator.
  telegram_header: { path: string };
  telegram_hero: { path: string };
  // The "now" bento cell on `/`, `/en/` and the colleague landings. Separate
  // from the other `bento_*` names because it answers a different question
  // ("what is in progress?"), and the old homepage `bento_graph` series cannot
  // be reused — that surface no longer exists.
  bento_now: { path: string };
  // --- Граф докладов (`/talks/`, `/en/talks/`) -----------------------------
  // `group` names the tablist, so the page's five panels (`talks`), the twelve
  // track panels (`talks:tracks`) and the eleven theme panels (`talks:themes`)
  // stay three series instead of collapsing into one `tab_selected`. Opt-in:
  // only a SectionTabs root carrying `data-analytics-group` emits, so project
  // pages keep their old (uninstrumented) behaviour.
  tab_selected: { tab: string; group: string; locale: Locale };
  // A talk detail opened. `source` is the placement the click came from
  // (`program`, `track`, `theme`, `graph`, `deeplink`, `other`), which is the
  // question the overview graph exists to answer: is the graph itself used, or
  // does everyone read the lists? `track` is the programme's own slug, null for
  // the ~30% of talks the source feed leaves untracked.
  talk_opened: {
    talk_id: number;
    track: string | null;
    source: 'program' | 'track' | 'theme' | 'graph' | 'deeplink' | 'other';
    locale: Locale;
  };
  // Prev/next inside the dialog: the reader moving through the programme
  // without going back to a list. `talk_id` is the talk moved *to*.
  talk_card_nav: { direction: 'prev' | 'next'; talk_id: number; locale: Locale };
  // A node of an opted-in ProjectGraph instance (`analytics` prop) was clicked
  // or activated with Space. `graph` is the instance `idPrefix`
  // (`talks-overview`, `talks-track-avito`), `node_id` the payload id
  // (`talk:277`, `track:avito`, `theme:ai`, `event:program`) and `node_kind` its
  // prefix — so a dashboard can join a click to the talks data directly.
  graph_node_click: {
    graph: string;
    node_kind: string;
    node_id: string;
    locale: Locale;
  };
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
  // Second sink first, so an event is not lost while PostHog is still loading
  // (or blocked): `sendIngest` is independent of `ph` and never throws.
  sendIngest(event, props);
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
 * Attribution (`classifyReferrer`, `parseUtm`, `firstTouch`, `visitUtm`, …)
 * lives in `./attribution` now that this module is the event registry. Every
 * name is re-exported, so callers and the unit tests keep importing from here.
 */
export { classifyReferrer, computeFirstTouch, parseUtm } from './attribution';
export { firstTouch, visitUtm };
export type { FirstTouch, ReferrerClass, UtmKey, UtmParams } from './attribution';
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
  const visit = visitUtm();

  try {
    ph.register({
      locale: localeFromPath(window.location.pathname),
      audience,
      theme: document.documentElement.getAttribute('data-theme') || 'dark',
      prefers_reduced_motion: reducedMotion,
      initial_referrer_class: touch.referrer_class,
      landing_path: touch.landing_path,
      // Super properties, not per-event props: `booking_click`, `contact_submit`
      // and `telegram_*` have to carry the campaign too. PostHog's own
      // auto-capture only puts UTM on `$pageview` — plain `utm_source` reached
      // 801 of 949 pageview rows in 90 days, which is why the dashboards used to
      // fall back to `$session_entry_utm_source`.
      ...utmSuperProperties('first_utm', touch.utm),
      ...utmSuperProperties('visit_utm', visit),
    });
  } catch {
    // Never break init.
  }
}
