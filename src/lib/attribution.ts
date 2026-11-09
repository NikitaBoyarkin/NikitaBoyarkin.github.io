// Attribution layer: first-touch referrer class, UTM parameters and the two
// UTM super-property sets (PRD §4.2, REQ-A03).
//
// Split out of `analytics.ts` to keep that module — the typed event registry,
// parsed by `tests/lib/analytics-contract.test.ts` and by
// `monitoring/dashboards/create_dashboards.py` — under the repo's per-file
// budget. `analytics.ts` re-exports every public name here, so imports of
// `classifyReferrer` / `parseUtm` / `firstTouch` / `visitUtm` keep working and
// the split stays an implementation detail.
//
// Nothing here touches PostHog: `registerSuperProperties()` in `analytics.ts`
// is the only caller of `utmSuperProperties()`.

/** Normalized first-touch source class (PRD §4.2, REQ-A03). */
export type ReferrerClass = 'linkedin' | 'github' | 'google' | 'direct' | 'other';

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

/** UTM parameters carried by the landing URL (PRD §4.2, `docs/linkedin-campaign-spec.md`). */
export type UtmKey = 'source' | 'medium' | 'campaign' | 'content' | 'term';
export type UtmParams = Partial<Record<UtmKey, string>>;

const UTM_KEYS: readonly UtmKey[] = ['source', 'medium', 'campaign', 'content', 'term'];

// Long enough for a real campaign slug, short enough that a pasted essay or a
// runaway ad macro cannot spawn a thousand near-identical breakdown rows.
const UTM_MAX = 100;

/**
 * Read the five UTM parameters out of a query string.
 *
 * Case and separators are preserved on purpose: the link was already normalized
 * where it was built (`/utm-tags` feeds the ad cabinet), and normalizing again
 * here would make the site's value disagree with the platform's report.
 */
export function parseUtm(search: string): UtmParams {
  const out: UtmParams = {};
  if (!search) return out;
  const params = new URLSearchParams(search);
  for (const key of UTM_KEYS) {
    const raw = params.get(`utm_${key}`);
    if (!raw) continue;
    const value = raw
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, UTM_MAX);
    if (value) out[key] = value;
  }
  return out;
}

/** Narrow an unknown stored value back to the five whitelisted keys. */
function readUtm(value: unknown): UtmParams {
  const out: UtmParams = {};
  if (!value || typeof value !== 'object') return out;
  for (const key of UTM_KEYS) {
    const stored = (value as Record<string, unknown>)[key];
    if (typeof stored === 'string' && stored) out[key] = stored;
  }
  return out;
}

/**
 * `{ first_utm_source: 'linkedin', … }` — all five keys every time, `null` when
 * the visit carries nothing, so the property schema stays stable in PostHog.
 */
export function utmSuperProperties(
  prefix: 'first_utm' | 'visit_utm',
  utm: UtmParams,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of UTM_KEYS) out[`${prefix}_${key}`] = utm[key] ?? null;
  return out;
}

export interface FirstTouch {
  referrer_class: ReferrerClass;
  landing_path: string;
  utm: UtmParams;
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
      utm: readUtm(parsed.utm),
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
export function computeFirstTouch(
  referrer: string,
  pathname: string,
  search = '',
): FirstTouch {
  let domain = '';
  if (referrer) {
    try {
      domain = new URL(referrer).hostname;
    } catch {
      domain = '';
    }
  }
  return {
    referrer_class: classifyReferrer(domain),
    landing_path: pathname,
    utm: parseUtm(search),
  };
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

  const value = computeFirstTouch(
    document.referrer || '',
    window.location.pathname,
    window.location.search,
  );
  writeFirstTouch(session, value);
  writeFirstTouch(local, value);
  return value;
}

const VISIT_UTM_KEY = 'dswo_ph_visit_utm';

function readVisitUtm(s: Storage | null): UtmParams | null {
  if (!s) return null;
  try {
    const raw = s.getItem(VISIT_UTM_KEY);
    if (!raw) return null;
    const parsed = readUtm(JSON.parse(raw));
    return Object.keys(parsed).length ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * UTM of the current visit, persisted in sessionStorage.
 *
 * Written the first time this visit carries any UTM and never overwritten
 * afterwards: navigating deeper, or landing on an untagged page, must not erase
 * the campaign that brought the visitor in. A new tab starts empty — first touch
 * answers "how did they hear about me at all", this answers "which campaign is
 * live right now", and a campaign report that spans months needs the second.
 */
export function visitUtm(): UtmParams {
  const session = store('session');
  const stored = readVisitUtm(session);
  if (stored) return stored;

  const fresh = parseUtm(window.location.search);
  if (session && Object.keys(fresh).length) {
    try {
      session.setItem(VISIT_UTM_KEY, JSON.stringify(fresh));
    } catch {
      // Storage may be unavailable (private mode, quota).
    }
  }
  return fresh;
}
