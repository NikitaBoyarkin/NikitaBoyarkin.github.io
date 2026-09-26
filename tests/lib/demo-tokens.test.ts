import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Drift gate: public/demos/demo.css ↔ src/styles/global.css.
//
// The demos live in `public/`, which Astro copies verbatim and never processes,
// so demo.css cannot `@import` the design tokens — it restates them. That copy
// is the risk: `public/games/index.html` already drifted this exact way (it
// still carries --accent: #ff6643, which global.css deliberately replaced with
// #ff8569). This test is what makes the duplication safe, the same way
// tests/lib/brand.test.ts binds global.css to src/lib/brand.ts: global.css
// stays hand-written, and the agreement is the test.
//
// It also binds the demo's OWN contrast invariant. That part is new — the
// --dv-* dataviz bucket has no canon in global.css, so nothing else checks it.
// The demos are dashboards: their data colours carry meaning, and colour that
// carries meaning has to be readable.
//
// Like brand.test.ts, the gate proves it bites: several tests mutate a copy of
// the stylesheet and assert the check goes red, so a green run means the parser
// really compared values rather than silently matching nothing.

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const GLOBAL = read('src/styles/global.css');
const DEMO = read('public/demos/demo.css');

const THEME_SELECTORS = [':root', '[data-theme="light"]', '[data-theme="cyberpunk"]'] as const;
type ThemeSelector = (typeof THEME_SELECTORS)[number];

/** Drop /* ... *​/ so comments cannot be mistaken for declarations. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Every `--token: value` inside the FIRST block matching `selector`, with
 * whitespace collapsed. Values are taken verbatim up to the `;`, which matters:
 * most are hex colours, but the same map also carries multi-line font stacks
 * and the --wallpaper-tile data URI, and all of those have to match too.
 */
function blockVars(source: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(stripComments(source));
  if (!block) throw new Error(`no CSS block for selector ${selector}`);
  const vars: Record<string, string> = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1])) !== null) {
    vars[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return vars;
}

function themes(source: string): Record<ThemeSelector, Record<string, string>> {
  return Object.fromEntries(
    THEME_SELECTORS.map((s) => [s, blockVars(source, s)]),
  ) as Record<ThemeSelector, Record<string, string>>;
}

/**
 * Tokens the demo MUST restate, per theme block. The completeness half of the
 * gate: without it, "fixing" a drift by deleting the token would go unnoticed.
 */
const REQUIRED: Record<ThemeSelector, string[]> = {
  ':root': [
    // 60% surfaces
    'background-primary',
    'background-secondary',
    'background-tertiary',
    'interactive-normal',
    'interactive-hover',
    // 30% text + hairlines
    'text-normal',
    'text-muted',
    'border-color',
    'surface-secondary',
    // 10% accent
    'text-accent',
    'text-accent-hover',
    'button-bg',
    'button-bg-hover',
    'button-ink',
    'border-active',
    // dataviz + texture
    'text-accent-dataviz',
    'wallpaper-line',
    'wallpaper-tile',
    // scales
    'font-sans',
    'font-mono',
    'page-pad',
    'radius-sm',
    'radius-md',
    'radius-lg',
    'radius-xl',
    'radius-full',
    'z-decor',
    'z-base',
    'z-float',
    'z-sticky',
    'z-panel',
    'z-top',
    'z-overlay',
    'z-dialog',
    'space-1',
    'space-2',
    'space-3',
    'space-4',
    'space-5',
    'space-6',
    'space-8',
    'space-10',
    'space-12',
    'space-16',
    'space-20',
  ],
  '[data-theme="light"]': [
    'background-primary',
    'background-secondary',
    'background-tertiary',
    'interactive-normal',
    'interactive-hover',
    'text-normal',
    'text-muted',
    'border-color',
    'surface-secondary',
    'text-accent',
    'text-accent-hover',
    'button-bg',
    'button-bg-hover',
    'button-ink',
    'border-active',
    'text-accent-dataviz',
    'wallpaper-line',
    'shadow-color',
  ],
  '[data-theme="cyberpunk"]': [
    'background-primary',
    'background-secondary',
    'background-tertiary',
    'interactive-normal',
    'interactive-hover',
    'text-normal',
    'text-muted',
    'border-color',
    'surface-secondary',
    'text-accent',
    'text-accent-hover',
    'button-bg',
    'button-bg-hover',
    'button-ink',
    'border-active',
    'text-accent-dataviz',
    'wallpaper-line',
    'shadow-color',
  ],
};

/** Missing tokens, or tokens whose demo.css value differs from global.css. */
function drift(demoSource: string): string[] {
  const problems: string[] = [];
  const demo = themes(demoSource);
  const canon = themes(GLOBAL);
  for (const selector of THEME_SELECTORS) {
    for (const token of REQUIRED[selector]) {
      const actual = demo[selector][token];
      const expected = canon[selector][token];
      if (expected === undefined) {
        problems.push(`${selector} --${token}: not in global.css (stale requirement)`);
      } else if (actual === undefined) {
        problems.push(`${selector} --${token}: missing from demo.css`);
      } else if (actual !== expected) {
        problems.push(`${selector} --${token}: ${actual} != ${expected}`);
      }
    }
  }
  return problems;
}

// --- colour maths ----------------------------------------------------------
//
// Pure arithmetic over parsed literals: no browser, no build, so this runs in
// the same `bun test tests/lib` pass as everything else.

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a 6-digit hex: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG 2.x contrast ratio. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L*a*b*, D65. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(channel) as [number, number, number];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.9505;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.089;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Perceptual distance (CIE76). The floor used below is 12 — clearly apart. */
function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const round = (n: number) => Math.round(n * 100) / 100;

// --- token access ----------------------------------------------------------

const DEMO_THEMES = themes(DEMO);

/**
 * A theme block's value, falling back to `:root` — the real cascade. The ramp
 * and the categorical set are declared once on `:root` on purpose (they are
 * theme-invariant, see demo.css), so reading them per theme means reading what
 * the browser would resolve, not what the block happens to spell out.
 */
const dv = (selector: ThemeSelector, token: string): string => {
  const value = DEMO_THEMES[selector][token] ?? DEMO_THEMES[':root'][token];
  if (value === undefined) throw new Error(`${selector} has no --${token}`);
  return value;
};



const SEQ = [1, 2, 3, 4, 5, 6, 7].map((i) => `dv-seq-${i}`);
const CAT = Array.from({ length: 11 }, (_, i) => `dv-cat-${i + 1}`);
const SEMANTIC = ['dv-good', 'dv-warn', 'dv-bad', 'dv-neutral'];
const GRAPHICAL = ['dv-axis', 'dv-threshold'];

describe('demo token parity (public/demos/demo.css ↔ src/styles/global.css)', () => {
  it('every shared token in demo.css matches global.css, and none is missing', () => {
    expect(drift(DEMO)).toEqual([]);
  });

  it('carries the wallpaper tile byte-for-byte', () => {
    expect(dv(':root', 'wallpaper-tile')).toBe(blockVars(GLOBAL, ':root')['wallpaper-tile']);
  });

  it('bites when a value is changed', () => {
    // The exact drift public/games/index.html shipped: the cyberpunk accent
    // "simplified" back to the pre-fix coral.
    const mutated = DEMO.replace(
      /(--text-accent:\s*)#ff8569;/,
      '$1#ff6643;',
    );
    expect(mutated).not.toBe(DEMO);
    expect(drift(mutated)).toContain(':root --text-accent: #ff6643 != #ff8569');
  });

  it('bites when a token is deleted instead of fixed', () => {
    const mutated = DEMO.replace('  --radius-lg: 12px;\n', '');
    expect(mutated).not.toBe(DEMO);
    expect(drift(mutated)).toContain(':root --radius-lg: missing from demo.css');
  });

  it('bites when the wallpaper tile drifts', () => {
    const mutated = DEMO.replace("M35 12 28 24 14 24 7 12 14 0 28 0Z", 'M35 12 28 24 14 24 7 12 14 0 30 0Z');
    expect(mutated).not.toBe(DEMO);
    expect(drift(mutated).some((p) => p.includes('--wallpaper-tile'))).toBe(true);
  });

  it('declares no --dv-* through var() or color-mix()', () => {
    // demo-theme.js reads these back with getComputedStyle().getPropertyValue(),
    // which returns the declaration's TEXT and does not resolve a nested var().
    // A token holding `var(--x)` would reach canvas as an unparsable string.
    const offenders = Object.entries(DEMO_THEMES).flatMap(([selector, vars]) =>
      Object.entries(vars)
        .filter(([name, value]) => name.startsWith('dv-') && /var\(|color-mix\(/.test(value))
        .map(([name, value]) => `${selector} --${name}: ${value}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('demo dataviz contrast invariant', () => {
  it('cohort ramp is readable in every theme (>= 4.5:1 against the cell ink)', () => {
    const ink = dv(':root', 'dv-cell-ink');
    const failures: string[] = [];
    for (const selector of THEME_SELECTORS) {
      for (const token of SEQ) {
        const ratio = contrast(dv(selector, token), ink);
        if (ratio < 4.5) failures.push(`${selector} --${token}: ${round(ratio)}:1 on ${ink}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('rfm segments are readable in every theme (>= 4.5:1 against the cell ink)', () => {
    const ink = dv(':root', 'dv-cell-ink');
    const failures: string[] = [];
    for (const selector of THEME_SELECTORS) {
      for (const token of CAT) {
        const ratio = contrast(dv(selector, token), ink);
        if (ratio < 4.5) failures.push(`${selector} --${token}: ${round(ratio)}:1 on ${ink}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('semantic tokens are readable as text on the page and on a card', () => {
    const failures: string[] = [];
    for (const selector of THEME_SELECTORS) {
      for (const surface of ['background-primary', 'background-secondary'] as const) {
        const bg = dv(selector, surface);
        for (const token of SEMANTIC) {
          const ratio = contrast(dv(selector, token), bg);
          if (ratio < 4.5) failures.push(`${selector} --${token} on --${surface}: ${round(ratio)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('axis tick labels are readable on every surface they sit on', () => {
    const failures: string[] = [];
    for (const selector of THEME_SELECTORS) {
      for (const surface of ['background-primary', 'background-secondary', 'background-tertiary'] as const) {
        const ratio = contrast(dv(selector, 'dv-label'), dv(selector, surface));
        if (ratio < 4.5) failures.push(`${selector} --dv-label on --${surface}: ${round(ratio)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('axes and threshold lines clear the 3:1 graphical floor (WCAG 1.4.11)', () => {
    const failures: string[] = [];
    for (const selector of THEME_SELECTORS) {
      for (const surface of ['background-secondary', 'background-tertiary'] as const) {
        const bg = dv(selector, surface);
        for (const token of GRAPHICAL) {
          const ratio = contrast(dv(selector, token), bg);
          if (ratio < 3) failures.push(`${selector} --${token} on --${surface}: ${round(ratio)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('the sequential ramp is monotone and its steps are distinguishable', () => {
    const values = SEQ.map((t) => dv(':root', t));
    const lum = values.map(luminance);
    expect(lum.every((l, i) => i === 0 || l < lum[i - 1])).toBe(true);
    expect(deltaE(values[0], values[values.length - 1])).toBeGreaterThan(30);
  });

  it('no two of the eleven segment colours look alike', () => {
    // Every swatch is visible in the legend at once, so separation is an
    // all-pairs property, not just an adjacent-pairs one.
    const values = CAT.map((t) => dv(':root', t));
    const failures: string[] = [];
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const d = deltaE(values[i], values[j]);
        if (d < 12) failures.push(`--${CAT[i]} vs --${CAT[j]}: DeltaE ${round(d)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('bites when a cell colour is made unreadable', () => {
    // Toward the ink, not away from it: a step that drifts pale is FINE (the
    // ramp's whole design keeps every step far from #1f2430) — what breaks the
    // invariant is a dark step, which is exactly what an alpha ramp produces.
    const mutated = DEMO.replace(/(--dv-seq-7:\s*)#42a3a0;/, '$1#3b414d;');
    expect(mutated).not.toBe(DEMO);
    const vars = blockVars(mutated, ':root');
    expect(contrast(vars['dv-seq-7'], vars['dv-cell-ink'])).toBeLessThan(4.5);
  });

  it('bites when two segment colours are collapsed', () => {
    const mutated = DEMO.replace(/(--dv-cat-2:\s*)#6ccf9c;/, '$1#4ecdc4;');
    expect(mutated).not.toBe(DEMO);
    const vars = blockVars(mutated, ':root');
    expect(deltaE(vars['dv-cat-1'], vars['dv-cat-2'])).toBeLessThan(12);
  });
});

// --- the demos themselves -------------------------------------------------
//
// A stylesheet in the right shape is worth nothing if the pages still carry
// their own hexes — an inline `style="background:#2e7d32"` beats any token.
// This is the mechanical form of the volta decision (classes instead of
// presentation attributes, so the hexes are actually gone rather than dead
// keys overridden from CSS), and it covers the four light demos at the same
// time.

describe('demos carry no hardcoded colours', () => {
  const PAGES = ['cohort', 'rfm', 'telegram', 'bayesian', 'volta'];

  const HEX = /#[0-9a-fA-F]{3,8}\b/g;
  /** A <meta name="theme-color"> is a colour that must be a literal. */
  const THEME_COLOR_META = /<meta\s+name="theme-color"[^>]*>/g;

  it.each(PAGES)('%s/index.html has no colour literal outside <meta theme-color>', (page) => {
    const html = read(`public/demos/${page}/index.html`);
    const withoutMeta = html.replace(THEME_COLOR_META, '');
    expect(withoutMeta.match(HEX) ?? []).toEqual([]);
  });
});
