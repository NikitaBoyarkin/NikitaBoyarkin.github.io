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
} from '../../src/lib/analytics';
import { AUDIENCES, DEFAULT_AUDIENCE } from '../../src/lib/projects';
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
// Homepage CTA — the regressions the "вопрос → ответ" rework left behind, now
// inverted. Each of those shipped as a bug once: a dead href, a primary action
// with no exposure event, a CTA pointing at a placeholder. (The "show all
// projects" link was removed from the hero on 2026-10-10.) The CV and Contact
// buttons left the board on 2026-10-10 as well (PRD §13, second wave), so these
// assertions now guard the REMOVAL: the page must not grow the row back, and if
// it does, no test here goes quietly green. The denominator that used to live in
// the gate is not gone from the site — the rail still fires it, asserted under
// "sticky action rail (Base.astro)" below.
// ---------------------------------------------------------------------------
describe('homepage primary CTA (docs/cta-inventory.md)', () => {
  const gate = () => src('src/components/PersonaCanvas.astro');

  it('leaves the hero CTA row off the board, and does not grow it back', () => {
    const s = gate();
    // The row used to be CV download (primary) + Contact (secondary). Both left
    // the body on the owner's call; the contact routes and the CV file are still
    // reachable from the nav, rail and footer, so nothing is orphaned.
    expect(s, 'the retired CV download is back on the board').not.toContain(
      'data-analytics="cv_download_pdf"',
    );
    expect(s, 'the retired CV link is back on the board').not.toContain('CV-Nikita-Boyarkin.pdf');
    expect(s, 'the retired contact link is back on the board').not.toContain(
      "href={withBase(isEn ? 'en/contact/' : 'contact/')}",
    );
    expect(s, 'the booking button must not be back on the homepage').not.toContain('booking_click');
    expect(s, 'the hero must not reference the booking URL').not.toContain('CAL_BOOKING_URL');
    expect(CAL_BOOKING_URL, 'the contact pages still depend on it').toMatch(/^https:\/\/cal\.com\//);
  });

  it('fires no cta_exposure — the board carries no exposed CTA to have a rate for', () => {
    // Kept as a NEGATIVE assertion rather than deleted: a rate whose denominator
    // counts a button that is not on the page is worse than no rate. The event
    // still fires from the rail, where the CTA is actually visible.
    expect(gate()).not.toContain("track('cta_exposure'");
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

  it('carries the CV download the hero already offers', () => {
    const s = base();
    expect(s).toContain('data-analytics="cv_download_pdf"');
    // The rail/nav booking button was removed on 2026-10-10; booking_click now
    // fires only from /contact and /en/contact.
    expect(s, 'the rail/nav must not carry the retired booking link').not.toContain(
      'booking_click',
    );
    expect(s).not.toContain('CAL_BOOKING_URL');
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
