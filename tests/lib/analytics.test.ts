import { describe, it, expect, beforeEach } from 'bun:test';
import {
  attachPosthog,
  classifyReferrer,
  computeFirstTouch,
  firstTouch,
  localeFromPath,
  parseUtm,
  registerSuperProperties,
  resetAnalyticsForTests,
  visitUtm,
  whenAnalyticsReady,
} from '../../src/lib/analytics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ph = any;

const FIRST_TOUCH_KEY = 'dswo_ph_first_touch';

/** Props passed to the last `register()` call — the super-property payload. */
let lastRegistered: Record<string, unknown> | null = null;

const makePh = (): Ph => ({
  __loaded: true,
  capture: () => {},
  register: (props: Record<string, unknown>) => {
    lastRegistered = props;
  },
});

describe('classifyReferrer (REQ-A03)', () => {
  it('maps a referrer hostname to its normalized class', () => {
    expect(classifyReferrer('www.linkedin.com')).toBe('linkedin');
    expect(classifyReferrer('linkedin.com')).toBe('linkedin');
    expect(classifyReferrer('github.com')).toBe('github');
    expect(classifyReferrer('gist.github.com')).toBe('github');
    expect(classifyReferrer('www.google.co.uk')).toBe('google');
  });

  it('treats a missing, empty, or literal-direct referrer as direct', () => {
    expect(classifyReferrer(null)).toBe('direct');
    expect(classifyReferrer(undefined)).toBe('direct');
    expect(classifyReferrer('')).toBe('direct');
    expect(classifyReferrer('$direct')).toBe('direct');
    expect(classifyReferrer('direct')).toBe('direct');
  });

  it('falls back to other for anything else', () => {
    expect(classifyReferrer('news.ycombinator.com')).toBe('other');
    expect(classifyReferrer('example.com')).toBe('other');
  });
});

describe('localeFromPath', () => {
  it('reads the locale from the path prefix alone', () => {
    expect(localeFromPath('/')).toBe('ru');
    expect(localeFromPath('/projects/volta/')).toBe('ru');
    expect(localeFromPath('/en')).toBe('en');
    expect(localeFromPath('/en/')).toBe('en');
    expect(localeFromPath('/en/projects/volta/')).toBe('en');
    // A path that merely starts with the letters "en" is still RU.
    expect(localeFromPath('/energy/')).toBe('ru');
  });
});

describe('computeFirstTouch', () => {
  it('resolves the class from a full referrer URL and keeps the landing path', () => {
    expect(computeFirstTouch('https://www.linkedin.com/feed/', '/projects/')).toEqual({
      referrer_class: 'linkedin',
      landing_path: '/projects/',
      utm: {},
    });
  });

  it('does not crash on a malformed referrer', () => {
    expect(computeFirstTouch('not a url', '/about/')).toEqual({
      referrer_class: 'direct',
      landing_path: '/about/',
      utm: {},
    });
  });

  it('captures the campaign UTM of the landing URL', () => {
    expect(
      computeFirstTouch('https://www.linkedin.com/feed/', '/', '?utm_source=linkedin&utm_campaign=hr-screening'),
    ).toEqual({
      referrer_class: 'linkedin',
      landing_path: '/',
      utm: { source: 'linkedin', campaign: 'hr-screening' },
    });
  });
});

describe('firstTouch persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('returns the stored value on a second call instead of recomputing it', () => {
    const stored = {
      referrer_class: 'linkedin' as const,
      landing_path: '/from-linkedin/',
      utm: { source: 'linkedin', campaign: 'hr-screening' },
    };
    window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(stored));

    // Regression guard: the stored value is already a *class*, not a hostname.
    // Re-running classifyReferrer over it used to collapse every class except
    // 'direct' to 'other', destroying attribution after the first page load.
    expect(firstTouch()).toEqual(stored);
  });

  it('drops an unrecognized stored class to other rather than passing it through', () => {
    window.localStorage.setItem(
      FIRST_TOUCH_KEY,
      JSON.stringify({ referrer_class: 'recruiter', landing_path: '/x/' }),
    );
    expect(firstTouch().referrer_class).toBe('other');
  });

  it('ignores a stored value without a landing path and falls back to the current one', () => {
    window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify({ referrer_class: 'github' }));
    const touch = firstTouch();
    expect(typeof touch.landing_path).toBe('string');
    expect(['linkedin', 'github', 'google', 'direct', 'other']).toContain(touch.referrer_class);
  });
});

describe('parseUtm (PRD §4.2)', () => {
  it('reads the five campaign parameters', () => {
    expect(
      parseUtm(
        '?utm_source=linkedin&utm_medium=paid&utm_campaign=hr-screening&utm_content=2-proof&utm_term=ru',
      ),
    ).toEqual({
      source: 'linkedin',
      medium: 'paid',
      campaign: 'hr-screening',
      content: '2-proof',
      term: 'ru',
    });
  });

  it('ignores query parameters that are not UTM', () => {
    expect(parseUtm('?mode=group&utm_source=github')).toEqual({ source: 'github' });
    expect(parseUtm('?mode=group&hideGroups=topic')).toEqual({});
  });

  it('preserves case and separators — normalization belongs to the link builder', () => {
    expect(parseUtm('?utm_campaign=Sale_Spring-2026')).toEqual({ campaign: 'Sale_Spring-2026' });
  });

  it('caps a value a runaway macro made enormous', () => {
    expect(parseUtm(`?utm_term=${'x'.repeat(300)}`).term).toHaveLength(100);
  });

  it('drops empty values instead of storing blank keys', () => {
    expect(parseUtm('?utm_source=&utm_medium=paid')).toEqual({ medium: 'paid' });
  });
});

describe('visitUtm persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('returns the stored visit UTM instead of re-reading the current URL', () => {
    window.sessionStorage.setItem(
      'dswo_ph_visit_utm',
      JSON.stringify({ source: 'linkedin', campaign: 'hr-screening' }),
    );
    expect(visitUtm()).toEqual({ source: 'linkedin', campaign: 'hr-screening' });
  });

  it('returns an empty object when the visit carries no UTM', () => {
    expect(visitUtm()).toEqual({});
    expect(window.sessionStorage.getItem('dswo_ph_visit_utm')).toBeNull();
  });
});

describe('registerSuperProperties (PRD §4.2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-audience');
    document.documentElement.setAttribute('data-theme', 'cyberpunk');
  });

  it('registers all sixteen super properties', () => {
    resetAnalyticsForTests();
    const ph = makePh();
    attachPosthog(ph);

    registerSuperProperties();

    const props = lastRegistered as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(
      [
        'audience',
        'initial_referrer_class',
        'landing_path',
        'locale',
        'prefers_reduced_motion',
        'theme',
        ...['source', 'medium', 'campaign', 'content', 'term'].flatMap((key) => [
          `first_utm_${key}`,
          `visit_utm_${key}`,
        ]),
      ].sort(),
    );
    expect(props.locale).toBe('ru');
    expect(props.theme).toBe('cyberpunk');
    expect(props.audience).toBeNull();
    expect(typeof props.prefers_reduced_motion).toBe('boolean');
    expect(typeof props.landing_path).toBe('string');
    // All ten UTM keys are present and null on an untagged visit, so the
    // property schema in PostHog does not appear mid-history.
    for (const key of ['source', 'medium', 'campaign', 'content', 'term']) {
      expect(props[`first_utm_${key}`]).toBeNull();
      expect(props[`visit_utm_${key}`]).toBeNull();
    }
  });

  it('never throws when the SDK register() blows up', () => {
    attachPosthog({
      __loaded: true,
      capture: () => {},
      register: () => {
        throw new Error('register exploded');
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(() => registerSuperProperties()).not.toThrow();
  });
});

describe('whenAnalyticsReady (capture that causes a navigation)', () => {
  beforeEach(() => resetAnalyticsForTests());

  it('runs immediately when the SDK is already attached', () => {
    attachPosthog(makePh());
    let calls = 0;
    whenAnalyticsReady(() => {
      calls += 1;
    });
    expect(calls).toBe(1);
  });

  it('waits for the attach instead of navigating into a lost buffer', () => {
    let calls = 0;
    whenAnalyticsReady(() => {
      calls += 1;
    }, 1000);
    expect(calls, 'navigated before the SDK could capture').toBe(0);
    attachPosthog(makePh());
    expect(calls).toBe(1);
  });

  it('still runs after maxWaitMs when analytics never loads (ad-blocker)', async () => {
    let calls = 0;
    whenAnalyticsReady(() => {
      calls += 1;
    }, 10);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(calls, 'a blocked SDK must not make the button dead').toBe(1);
  });

  it('runs the action at most once when the attach arrives after the timeout', async () => {
    let calls = 0;
    whenAnalyticsReady(() => {
      calls += 1;
    }, 10);
    await new Promise((resolve) => setTimeout(resolve, 30));
    attachPosthog(makePh());
    expect(calls).toBe(1);
  });
});
