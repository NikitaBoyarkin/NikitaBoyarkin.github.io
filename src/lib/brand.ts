/**
 * Single source of truth for the brand palette and the hexagon geometry.
 *
 * Two audiences:
 *   - the site, through the CSS custom properties in `src/styles/global.css`.
 *     `tests/lib/brand.test.ts` parses those token blocks and fails if any of
 *     them drift away from the values below (the drift gate).
 *   - the OG banner generators under `scripts/`, which import this module
 *     directly so a banner can never be the only place a brand hex lives.
 *
 * The brand has two contextual accents on purpose (see DESIGN.md, "Double
 * regime"): a high-chroma orange that fills the call-to-action button and
 * accents the royal-blue marketing surface, and a coral for the site's teal
 * canvas. They are not interchangeable *by role*. The orange is a **fill**: it
 * carries dark ink at 5.23:1 and clears the 3:1 graphical floor against the
 * teal canvas (4.55:1). As accent *text* it would fail — on a card surface
 * (`--background-secondary`, `#1a3435`) it lands at 3.97:1, under the 4.5:1
 * the contrast gate enforces for `--text-accent`. That slot stays coral.
 */

/** A hex colour string, in the `#rrggbb` form this codebase uses everywhere. */
export type BrandHex = `#${string}`;

/**
 * Signal blue — the marketing surface (OG banners, CV covers) and the family
 * its depth tints belong to. Not a button fill: a blue CTA on the teal canvas
 * sat at 1.31:1 against it.
 */
export const BRAND_BLUE: BrandHex = '#1400c3';

/**
 * High-chroma orange — the CTA fill (`--button-bg`, dark and light themes,
 * with `--button-ink` dark on top) and the accent on the blue marketing
 * surface. The one hex the two regimes share.
 */
export const ACCENT_ON_BLUE: BrandHex = '#fe4e02';

/** Coral — interactive accent for the teal site canvas (dark + cyberpunk). */
export const ACCENT_ON_TEAL: BrandHex = '#ff8569';

/** Burnt sienna — the light-theme adaptation of the coral accent. */
export const ACCENT_ON_TEAL_LIGHT: BrandHex = '#a8331a';

/**
 * Unified cream. It is the light-theme page surface (`--background-primary`)
 * and the banner ink/backdrop; one value keeps site and banners in one system.
 */
export const CREAM: BrandHex = '#f4efca';

/**
 * Blue-family depth tints. The marketing surface is royal blue, so the only
 * place to add depth is within the blue family: `LIFT` reads as a raised
 * surface, `DEEP` as an inset well. Both are banner-surface only.
 */
export const SURFACE_BLUE_LIFT: BrandHex = '#2410e0';
export const SURFACE_BLUE_DEEP: BrandHex = '#0a0070';
export const SURFACE_BLUE_DEEPEST: BrandHex = '#06003a';

/** The palette as one object, for consumers that prefer a menu over imports. */
export const BRAND = {
  blue: BRAND_BLUE,
  accentOnBlue: ACCENT_ON_BLUE,
  accentOnTeal: ACCENT_ON_TEAL,
  accentOnTealLight: ACCENT_ON_TEAL_LIGHT,
  cream: CREAM,
  surfaceBlueLift: SURFACE_BLUE_LIFT,
  surfaceBlueDeep: SURFACE_BLUE_DEEP,
  surfaceBlueDeepest: SURFACE_BLUE_DEEPEST,
} as const;

const fmt = (n: number): string => n.toFixed(1);

/**
 * SVG `points` for a pointy-top hexagon (a vertex on the vertical axis),
 * centred at (cx, cy) with circumradius r. This is the portrait clip in every
 * banner: the vertex points at the top, matching the site's portrait framing.
 */
export function hexPoints(cx: number, cy: number, r: number): string {
  const dx = (r * Math.sqrt(3)) / 2;
  return [
    [cx, cy - r],
    [cx + dx, cy - r / 2],
    [cx + dx, cy + r / 2],
    [cx, cy + r],
    [cx - dx, cy + r / 2],
    [cx - dx, cy - r / 2],
  ]
    .map(([x, y]) => `${fmt(x)},${fmt(y)}`)
    .join(' ');
}

/**
 * SVG `points` for a flat-top hexagon (vertices on the horizontal axis),
 * centred at (cx, cy) with circumradius r. This is the NB brand mark, and it
 * matches the nav logo geometry in `src/layouts/Base.astro` (`.nav-logo`).
 */
export function hexPointsFlat(cx: number, cy: number, r: number): string {
  const h = (r * Math.sqrt(3)) / 2;
  return [
    [cx - r, cy],
    [cx - r / 2, cy - h],
    [cx + r / 2, cy - h],
    [cx + r, cy],
    [cx + r / 2, cy + h],
    [cx - r / 2, cy + h],
  ]
    .map(([x, y]) => `${fmt(x)},${fmt(y)}`)
    .join(' ');
}
