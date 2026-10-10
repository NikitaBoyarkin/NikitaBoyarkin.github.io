import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  attachPosthog,
  flushAnalyticsQueue,
  readAudience,
  registerSuperProperties,
  track,
  writeAudience,
  type AnalyticsEventMap,
} from '../../src/lib/analytics';
import { AUDIENCES, DEFAULT_AUDIENCE, PROJECT_ORDER } from '../../src/lib/projects';
import { CAL_BOOKING_URL } from '../../src/lib/contact';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ph = any;

const makePh = (): Ph => ({
  __loaded: true,
  capture: mock(() => {}),
  register: mock(() => {}),
});

/** Every capture() call as { event, props }. */
const captured = (ph: Ph) =>
  ph.capture.mock.calls.map((c: unknown[]) => ({ event: c[0] as string, props: c[1] as Record<string, unknown> }));

const lastPropsFor = (ph: Ph, event: string) =>
  captured(ph)
    .filter((c: { event: string }) => c.event === event)
    .pop()?.props;

const ROOT = join(__dirname, '..', '..');
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// ---------------------------------------------------------------------------
// Buffering — must run FIRST: it asserts the pre-attach state of the module,
// and `attachPosthog` is sticky for the rest of this file.
// ---------------------------------------------------------------------------
describe('buffering before PostHog attaches (the lazy-SDK window)', () => {
  it('does not throw and does not capture when no SDK is attached yet', () => {
    expect(() =>
      track('persona_gate_view', { lang: 'ru', has_stored_choice: false })
    ).not.toThrow();
  });

  it('flushes the buffered gate view once the SDK attaches', () => {
    const ph = makePh();
    attachPosthog(ph);
    flushAnalyticsQueue();

    const props = lastPropsFor(ph, 'persona_gate_view');
    expect(props, 'buffered persona_gate_view was dropped on flush').toBeTruthy();
    expect(props).toEqual({ lang: 'ru', has_stored_choice: false });
  });
});

// ---------------------------------------------------------------------------
// AC6 — the two persona events reach PostHog with the PRD §11 props.
// ---------------------------------------------------------------------------
describe('persona events (PRD §11)', () => {
  let ph: Ph;

  beforeEach(() => {
    ph = makePh();
    attachPosthog(ph);
  });

  it('sends persona_gate_view { lang, has_stored_choice }', () => {
    track('persona_gate_view', { lang: 'en', has_stored_choice: true });
    expect(lastPropsFor(ph, 'persona_gate_view')).toEqual({
      lang: 'en',
      has_stored_choice: true,
    });
  });

  it('sends persona_selected { persona, lang, source } from the gate', () => {
    track('persona_selected', { persona: 'hr', lang: 'ru', source: 'gate' });
    expect(lastPropsFor(ph, 'persona_selected')).toEqual({
      persona: 'hr',
      lang: 'ru',
      source: 'gate',
    });
  });

  it('sends persona_selected with source:switch from the role switcher', () => {
    track('persona_selected', { persona: 'manager', lang: 'ru', source: 'switch' });
    expect(lastPropsFor(ph, 'persona_selected')).toMatchObject({ source: 'switch' });
  });

  it('never lets a throwing SDK break the caller', () => {
    const broken = makePh();
    broken.capture = mock(() => {
      throw new Error('sdk exploded');
    });
    attachPosthog(broken);
    expect(() => track('persona_selected', { persona: 'hr', lang: 'ru', source: 'gate' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC2 — the stored choice is the single source of truth for the attribute and
// the super-property.
// ---------------------------------------------------------------------------
describe('audience storage (AC2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-audience');
  });

  it('writeAudience persists the key and mirrors it onto <html data-audience>', () => {
    writeAudience('hr');
    expect(window.localStorage.getItem('audience')).toBe('hr');
    expect(document.documentElement.getAttribute('data-audience')).toBe('hr');
    expect(readAudience()).toBe('hr');
  });

  it('accepts every taxonomy value', () => {
    for (const a of AUDIENCES) {
      writeAudience(a);
      expect(readAudience()).toBe(a);
    }
  });

  it('rejects the retired taxonomy instead of trusting it', () => {
    for (const stale of ['recruiter', 'analyst', 'learner', 'nonsense']) {
      window.localStorage.setItem('audience', stale);
      expect(readAudience(), `"${stale}" must not survive`).not.toBe(stale);
    }
  });

  it('returns null when nothing is stored', () => {
    expect(readAudience()).toBeNull();
  });

  it('registers audience as a super-property after a choice is made', () => {
    const ph = makePh();
    attachPosthog(ph);
    writeAudience('manager');
    registerSuperProperties();

    // register() may be called with (props) or (name, props); flatten the args
    // and look for any object carrying `audience`.
    const withAudience = ph.register.mock.calls
      .flat()
      .find((a: unknown) => a && typeof a === 'object' && 'audience' in (a as object));

    expect(withAudience, 'audience super-property was not registered').toBeTruthy();
    expect((withAudience as Record<string, unknown>).audience).toBe('manager');
  });
});

// ---------------------------------------------------------------------------
// Wiring — the components must call track() with the agreed props, and the six
// role routes from PRD §6 must exist. A source assertion is the mechanism here:
// nothing else fails if the component stops tracking.
// ---------------------------------------------------------------------------
describe('wiring (PRD §6, §9, §10)', () => {
  it('PersonaCanvas tracks the gate view and gate-sourced selection', () => {
    const s = src('src/components/PersonaCanvas.astro');
    expect(s).toContain("track('persona_gate_view'");
    expect(s).toContain("track('persona_selected'");
    expect(s).toMatch(/source:\s*'gate'/);
  });

  it('RoleSwitch tracks a switch-sourced selection', () => {
    const s = src('src/components/RoleSwitch.astro');
    expect(s).toContain("track('persona_selected'");
    expect(s).toMatch(/source:\s*'switch'/);
    expect(s, 'RoleSwitch must write the choice').toContain('writeAudience');
  });

  it('the gate is mounted on / and /en/ with the right locale', () => {
    expect(src('src/pages/index.astro')).toMatch(/PersonaCanvas[^>]*lang="ru"/);
    expect(src('src/pages/en/index.astro')).toMatch(/PersonaCanvas[^>]*lang="en"/);
  });

  it('ships all six role routes', () => {
    const routes = [
      'src/pages/hr/index.astro',
      'src/pages/manager/index.astro',
      'src/pages/colleague/index.astro',
      'src/pages/en/hr/index.astro',
      'src/pages/en/manager/index.astro',
      'src/pages/en/colleague/index.astro',
    ];
    for (const r of routes) {
      expect(existsSync(join(ROOT, r)), `missing route ${r}`).toBe(true);
    }
  });

  it('keeps the default branch on colleague', () => {
    expect(DEFAULT_AUDIENCE).toBe('colleague');
  });

  it('does not leak the retired taxonomy into the shipped source', () => {
    for (const file of ['src/lib/analytics.ts', 'src/lib/projects.ts', 'src/components/PersonaCanvas.astro']) {
      const s = src(file);
      for (const stale of ['recruiter', 'learner']) {
        expect(s, `${file} still mentions "${stale}"`).not.toContain(`'${stale}'`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Homepage CTA — the four regressions the "вопрос → ответ" rework left behind.
// Each one shipped as a bug once: a dead href, a hand-typed project count, a
// primary action with no exposure event, and a CTA pointing at a placeholder.
// ---------------------------------------------------------------------------
describe('homepage primary CTA (docs/cta-inventory.md)', () => {
  const gate = () => src('src/components/PersonaCanvas.astro');

  it('the hero CTA is the booking link, not a placeholder', () => {
    expect(CAL_BOOKING_URL).not.toContain('PROJECT_REF');
    expect(gate()).toContain('href={CAL_BOOKING_URL}');
    expect(gate(), 'the CTA lost its delegated tracking hook').toContain(
      'data-analytics="booking_click"',
    );
  });

  it('fires cta_exposure so the click has a denominator', () => {
    const props = {
      surface: 'home_hero',
      lang: 'ru',
    } satisfies AnalyticsEventMap['cta_exposure'];
    expect(props.surface).toBe('home_hero');
    expect(gate()).toContain("track('cta_exposure'");
  });

  it('"all projects" points at /projects/, not /colleague/', () => {
    const s = gate();
    expect(s).toContain("withBase(isEn ? 'en/projects/' : 'projects/')");
    expect(s, 'regression Q18: the label promised all projects, the href led to one role').not.toContain(
      "/colleague/'",
    );
  });

  it('counts the projects from PROJECT_ORDER instead of a hand-typed number', () => {
    const s = gate();
    expect(s).toContain('${PROJECT_ORDER.length}');
    expect(s, 'a hand-typed project count goes stale on the next project').not.toMatch(
      /Показать все \d+ проектов/,
    );
    // The claim above is only meaningful while the array it counts is non-empty.
    expect(PROJECT_ORDER.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Sticky action rail (D7). Its whole point is the breakpoint: it exists to fill
// the gutter right of the content column, and that gutter does not exist on a
// 1440px screen. The numbers below are the arithmetic from global.css
// (`--rail-total: 264px`, `--content-max: 1180px`) — if either token moves, the
// 1860px threshold here goes stale and the rail starts overlapping the content.
// ---------------------------------------------------------------------------
describe('sticky action rail (Base.astro)', () => {
  const base = () => src('src/layouts/Base.astro');

  it('carries both actions the hero already offers', () => {
    const s = base();
    expect(s).toContain('href={CAL_BOOKING_URL}');
    expect(s).toContain('data-analytics="booking_click"');
    expect(s).toContain('data-analytics="cv_download_pdf"');
  });

  it('is rendered only where a gutter exists, and only when asked for', () => {
    expect(base()).toContain('@media (min-width: 1860px)');
    expect(base(), 'the rail is off by default so non-home pages do not get it').toContain(
      'showCtaRail = false',
    );
    expect(src('src/pages/index.astro'), 'the rail never renders without the prop').toMatch(
      /^\s*showCtaRail$/m,
    );
  });

  it('counts its exposure only when the rail is actually visible', () => {
    const s = base();
    expect(s).toContain("track('cta_exposure'");
    expect(s, 'a hidden rail counted as an exposure deflates its own click rate').toContain(
      "matchMedia('(min-width: 1860px)').matches",
    );
  });
});
