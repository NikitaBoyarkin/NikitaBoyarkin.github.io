import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The gradient family's binding mechanism (docs/prd-gradient-family.md, REQ-06).
//
// Why this test exists at all: neither existing contrast mechanism can see a
// gradient. `.claude/hooks/contrast-gate.js:37` documents the limit outright —
// "gradient backgrounds are skipped" — and tests/lib/brand.test.ts parses
// `--token: #hex;`, which a `linear-gradient(...)` value never matches. So the
// invariant "a gradient never carries text it cannot carry" had no mechanism,
// which made it prose. This is the mechanism.
//
// Three things it holds:
//   1. Completeness — the five tokens exist, and a theme block may only
//      override a token that `:root` already defines. Deleting a token to
//      "fix" a failure therefore fails.
//   2. Stop allowlist — every colour stop is an existing brand token or
//      `transparent`. A raw hex in a gradient is a defect: it would bypass
//      src/lib/brand.ts (and brand.test.ts) and drift unseen, the exact way
//      public/games/index.html's `--accent:#ff6643` drifted.
//   3. Worst-case composite — the ramp is sampled and composited over the
//      surface it replaces, and the text token that sits on that surface has
//      to hold AA at every sample. The button case is the real one: the fill
//      is a near-black neutral the page cannot police (on the dark teal canvas
//      `--button-bg` sits at ~1.2:1 — DESIGN.md, "measured, not gated"), so a
//      fill that drifts toward the cream ink shows up here and nowhere else.
//
// Like brand.test.ts and demo-tokens.test.ts, the gate proves it bites: the
// mutation-control cases at the bottom must go red.

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const GLOBAL = read('src/styles/global.css');

const THEME_SELECTORS = [':root', '[data-theme="light"]', '[data-theme="cyberpunk"]'] as const;
type ThemeSelector = (typeof THEME_SELECTORS)[number];

/** Drop comments so a commented-out declaration cannot be mistaken for one. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Every `--token: value` inside the FIRST block matching `selector`, with
 * whitespace collapsed. Values are taken verbatim up to the `;`, which is what
 * lets a multi-line `radial-gradient(...)` come through as one string.
 */
function blockVars(source: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(stripComments(source));
  if (!block) throw new Error(`no CSS block for selector ${selector}`);
  const vars: Record<string, string> = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+)(?:;|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1])) !== null) {
    vars[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return vars;
}

const themeVars = (source: string, selector: ThemeSelector) => blockVars(source, selector);

/** What the browser resolves: the theme block, falling back to `:root`. */
function resolve(source: string, selector: ThemeSelector, token: string): string {
  const value = themeVars(source, selector)[token] ?? themeVars(source, ':root')[token];
  if (value === undefined) throw new Error(`${selector} has no --${token}`);
  return value;
}

// --- gradient shape --------------------------------------------------------

/** The five names the family is allowed to use. Any other is a typo or a stray. */
const GRADIENTS = ['gradient-hero', 'gradient-surface', 'gradient-button', 'gradient-rule', 'gradient-page'];

const N = String.raw`\d+(?:\.\d+)?`;
const TOKEN = String.raw`var\(--([a-z0-9-]+)\)`;

/**
 * One stop, in declaration order. Three shapes appear in the family, and all
 * three matter:
 *
 *   - `var(--x)`                        → the token's colour, fully opaque
 *   - `color-mix(… var(--x) 10%, transparent)` → the token's colour at that alpha
 *   - `color-mix(… var(--x) 88%, var(--y))`    → a blend, still fully opaque
 *
 * The alpha case is the whole point of the hero and rule recipes — it is what
 * keeps the accent inside the 60-30-10 budget. The blend case is the card ramp.
 * Collapsing either into "just find the hexes" would drop exactly the numbers
 * the invariant depends on.
 */
type Stop =
  | { kind: 'token'; ref: string; alpha: number }
  | { kind: 'blend'; from: string; to: string; weight: number }
  | { kind: 'transparent' }
  | { kind: 'hex'; ref: string };

const STOP_RE = new RegExp(
  [
    // color-mix against transparent — a tinted token at partial alpha
    String.raw`color-mix\(\s*in srgb\s*,\s*${TOKEN}\s+(${N})%\s*,\s*transparent\s*\)`,
    // color-mix between two opaque tokens — a blend, alpha stays 1
    String.raw`color-mix\(\s*in srgb\s*,\s*${TOKEN}\s+(${N})%\s*,\s*${TOKEN}\s*\)`,
    TOKEN,
    String.raw`transparent(?![\w-])`,
    String.raw`#[0-9a-fA-F]{3,8}\b`,
  ].join('|'),
  'g',
);

function stopsOf(value: string): Stop[] {
  const stops: Stop[] = [];
  STOP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STOP_RE.exec(value)) !== null) {
    const raw = m[0];
    const groups = m.slice(1).filter((g) => g !== undefined);
    if (/^color-mix\(/.test(raw)) {
      // Two groups: the mix's own token + weight. A third means the blend form.
      if (groups.length >= 3) {
        stops.push({ kind: 'blend', from: groups[0], to: groups[2], weight: Number(groups[1]) / 100 });
      } else {
        stops.push({ kind: 'token', ref: groups[0], alpha: Number(groups[1]) / 100 });
      }
    } else if (/^var\(/.test(raw)) {
      stops.push({ kind: 'token', ref: groups[0], alpha: 1 });
    } else if (raw.startsWith('transparent')) {
      stops.push({ kind: 'transparent' });
    } else {
      stops.push({ kind: 'hex', ref: raw });
    }
  }
  return stops;
}

/** Token names a gradient depends on, in any stop shape. */
const tokenRefs = (stops: Stop[]): string[] =>
  stops.flatMap((s) => {
    if (s.kind === 'token') return [s.ref];
    if (s.kind === 'blend') return [s.from, s.to];
    return [];
  });

// --- colour maths ----------------------------------------------------------

type RGB = [number, number, number];

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(f)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as RGB;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** A stop as the browser paints it: colour plus the alpha it composites with. */
function stopPaint(stop: Stop, source: string, selector: ThemeSelector): { rgb: RGB; a: number } {
  if (stop.kind === 'transparent') return { rgb: [0, 0, 0], a: 0 };
  if (stop.kind === 'hex') return { rgb: hexToRgb(stop.ref), a: 1 };
  if (stop.kind === 'blend') {
    const from = hexToRgb(resolve(source, selector, stop.from));
    const to = hexToRgb(resolve(source, selector, stop.to));
    const w = stop.weight;
    return { rgb: [0, 1, 2].map((k) => from[k] * w + to[k] * (1 - w)) as RGB, a: 1 };
  }
  return { rgb: hexToRgb(resolve(source, selector, stop.ref)), a: stop.alpha };
}

/**
 * The ramp sampled at `t`, composited over `backdrop`.
 *
 * Stops are treated as evenly spaced, ignoring their declared positions. That
 * is deliberately conservative for `--gradient-hero`, whose tint ends at 70%:
 * the model keeps tinting past 70%, so a sample there is darker than reality
 * and the check is stricter than the browser.
 */
function sampleOver(
  stops: Stop[],
  t: number,
  backdrop: RGB,
  source: string,
  selector: ThemeSelector,
): RGB {
  if (stops.length === 0) return backdrop;
  if (stops.length === 1) {
    const { rgb, a } = stopPaint(stops[0], source, selector);
    return [0, 1, 2].map((k) => rgb[k] * a + backdrop[k] * (1 - a)) as RGB;
  }
  const pos = t * (stops.length - 1);
  const i = Math.min(Math.floor(pos), stops.length - 2);
  const u = pos - i;
  const a0 = stopPaint(stops[i], source, selector);
  const a1 = stopPaint(stops[i + 1], source, selector);
  const a = a0.a + (a1.a - a0.a) * u;
  return [0, 1, 2].map((k) => {
    const premultiplied = a0.rgb[k] * a0.a * (1 - u) + a1.rgb[k] * a1.a * u;
    return (a > 0 ? premultiplied / a : 0) * a + backdrop[k] * (1 - a);
  }) as RGB;
}

const SAMPLES = [0, 0.25, 0.5, 0.75, 1];

/**
 * Each gradient's base surface and the text that sits on it. `--gradient-rule`
 * is absent on purpose: it is a hairline beside a heading, never behind text.
 */
const FAMILY = [
  { token: 'gradient-hero', surface: 'background-primary', ink: ['text-normal', 'text-accent'] },
  { token: 'gradient-surface', surface: 'card-background', ink: ['text-normal'] },
  { token: 'gradient-button', surface: 'button-bg', ink: ['button-ink'] },
  // The page wash sits behind every page's copy, so it carries the full ink set
  // the hero does. `--text-muted` is a known gap across the whole FAMILY, not
  // one this member introduces.
  { token: 'gradient-page', surface: 'background-primary', ink: ['text-normal', 'text-accent'] },
] as const;

/** Every (theme, gradient, sample, ink) pair that fails AA. */
function aaFailures(source: string): string[] {
  const failures: string[] = [];
  for (const selector of THEME_SELECTORS) {
    for (const { token, surface, ink } of FAMILY) {
      const value = resolve(source, selector, token);
      const stops = stopsOf(value);
      if (stops.length === 0) {
        failures.push(`${selector} --${token}: no colour stop parsed`);
        continue;
      }
      const backdrop = hexToRgb(resolve(source, selector, surface));
      for (const t of SAMPLES) {
        const painted = sampleOver(stops, t, backdrop, source, selector);
        for (const inkToken of ink) {
          const ratio = contrast(hexToRgb(resolve(source, selector, inkToken)), painted);
          if (ratio < 4.5) {
            failures.push(
              `${selector} --${token} @${t * 100}% under --${inkToken}: ${round(ratio)}:1`,
            );
          }
        }
      }
    }
  }
  return failures;
}

const gradientEntries = (source: string) =>
  THEME_SELECTORS.flatMap((selector) =>
    Object.entries(themeVars(source, selector))
      .filter(([name]) => name.startsWith('gradient-'))
      .map(([name, value]) => ({ selector, name, value, stops: stopsOf(value) })),
  );

/** Stops that are neither a token reference nor `transparent`. */
function rawHexStops(source: string): string[] {
  return gradientEntries(source)
    .filter(({ stops }) => stops.some((s) => s.kind === 'hex'))
    .map(
      ({ selector, name, stops }) =>
        `${selector} --${name}: ${stops.filter((s) => s.kind === 'hex').map((s) => s.ref).join(', ')}`,
    );
}

// --- the gate --------------------------------------------------------------

describe('gradient family tokens', () => {
  it('defines all five tokens in :root', () => {
    const root = themeVars(GLOBAL, ':root');
    expect(GRADIENTS.filter((name) => root[name] === undefined)).toEqual([]);
  });

  it('uses no name outside the family', () => {
    const names = new Set(gradientEntries(GLOBAL).map(({ name }) => name));
    expect([...names].filter((n) => !GRADIENTS.includes(n))).toEqual([]);
  });

  it('only overrides a token that :root already defines', () => {
    // An override with no base is a silent fallback to nothing — and it is how
    // "fix the failing theme" turns into "delete the token here".
    const root = themeVars(GLOBAL, ':root');
    const orphans = gradientEntries(GLOBAL)
      .filter(({ selector, name }) => selector !== ':root' && root[name] === undefined)
      .map(({ selector, name }) => `${selector} --${name}`);
    expect(orphans).toEqual([]);
  });

  it('composes every stop from an existing brand token or transparent', () => {
    expect(rawHexStops(GLOBAL)).toEqual([]);
  });

  it('references only tokens that exist in the theme that uses them', () => {
    const missing: string[] = [];
    for (const selector of THEME_SELECTORS) {
      const vars = { ...themeVars(GLOBAL, ':root'), ...themeVars(GLOBAL, selector) };
      for (const { name, stops } of gradientEntries(GLOBAL).filter((e) => e.selector === selector)) {
        for (const ref of tokenRefs(stops)) {
          if (vars[ref] === undefined) missing.push(`${selector} --${name} → --${ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('never paints text with a gradient', () => {
    // REQ-04. Gradient-filled text is invisible to axe and to every gate here,
    // and it dies under forced-colors — so the accent lives in a rule beside
    // the heading instead.
    const styles = ['global.css', 'blog.css'].map((f) => read(`src/styles/${f}`));
    expect(styles.filter((css) => /background-clip\s*:\s*text/.test(css))).toEqual([]);
  });

  it('keeps the text on every gradient surface at AA across the whole ramp', () => {
    expect(aaFailures(GLOBAL)).toEqual([]);
  });

  it('collapses the family to flat values under print / forced-colours / stronger contrast', () => {
    // REQ-07. Read as text, not resolved: the point is that the tokens are
    // reset, not that a particular flat value was chosen.
    const css = stripComments(GLOBAL);
    const at = css.indexOf('@media print,');
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf('}', at));
    for (const name of GRADIENTS) expect(block).toContain(`--${name}:`);
  });
});

describe('the gate bites', () => {
  it('goes red when a stop is lightened toward the cream button ink', () => {
    // The failure the button case exists to catch, in its current direction:
    // --button-ink is the cream #f8f2da, so a fill that drifts *light* is what
    // drops below AA. A darker fill is fine — the ramp may be any neutral, it
    // only has to stay clear of the ink.
    const mutated = GLOBAL.replace(/(\s--button-bg: )#171717;/, '$1#c9c2a8;');
    expect(mutated).not.toBe(GLOBAL);
    expect(aaFailures(mutated).some((f) => f.includes('--gradient-button'))).toBe(true);
  });

  it('goes red when a stop is a raw hex instead of a token', () => {
    const mutated = GLOBAL.replace(
      /--gradient-button: linear-gradient\(135deg, var\(--button-bg\), var\(--button-bg-hover\)\);/,
      '--gradient-button: linear-gradient(135deg, var(--button-bg), #ff6a1f);',
    );
    expect(mutated).not.toBe(GLOBAL);
    expect(rawHexStops(mutated)).toEqual([':root --gradient-button: #ff6a1f']);
  });

  it('goes red when a stop points at a token that does not exist', () => {
    const mutated = GLOBAL.replace(
      /(--gradient-rule: linear-gradient\(90deg, )var\(--text-accent\)( 0%, transparent 70%\))/,
      '$1var(--accent-typo)$2',
    );
    expect(mutated).not.toBe(GLOBAL);
    const vars = themeVars(mutated, ':root');
    expect(vars['accent-typo']).toBeUndefined();
    expect(tokenRefs(stopsOf(vars['gradient-rule']))).toEqual(['accent-typo']);
  });

  it('goes red when a token is deleted instead of fixed', () => {
    const mutated = GLOBAL.replace(
      /  --gradient-rule: linear-gradient\(90deg, var\(--text-accent\) 0%, transparent 70%\);\n/,
      '',
    );
    expect(mutated).not.toBe(GLOBAL);
    expect(themeVars(mutated, ':root')['gradient-rule']).toBeUndefined();
  });

  it('goes red when an override outlives its :root definition', () => {
    const mutated = GLOBAL.replace(/  --gradient-hero: radial-gradient\(\n[\s\S]*?\n  \);\n/, '');
    expect(mutated).not.toBe(GLOBAL);
    expect(themeVars(mutated, ':root')['gradient-hero']).toBeUndefined();
    expect(themeVars(mutated, '[data-theme="cyberpunk"]')['gradient-hero']).toBeDefined();
  });
});
