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
 * regime"): a high-chroma orange that accents the royal-blue marketing surface
 * (and filled the CTA button until 2026-10-18), and a coral for the site's
 * teal canvas. They are not interchangeable *by role*. The orange is a
 * **marketing-surface accent**; the button fill is now the neutral
 * `BUTTON_FILL` (`#171717`) with the cream `BUTTON_INK` on top (15.97:1). The
 * orange cleared dark ink at 5.23:1 and the 3:1 graphical floor against the
 * teal canvas (4.55:1), but as accent *text* it would fail — on a card surface
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
 * High-chroma orange — the accent on the royal-blue marketing surface until
 * 2026-10-20, when every picture moved to the cream surface. On cream it
 * measures 2.96:1, under the 3:1 graphics floor, so the banner accent is now
 * `BANNER_ACCENT` (`#b8431f`). The hex stays exported because the site's history
 * and the OG-banner PRDs reference it; no generator should import it as an ink.
 */
export const ACCENT_ON_BLUE: BrandHex = '#fe4e02';

/**
 * The CTA fill (`--button-bg`, dark + light themes) — a near-black neutral,
 * deliberately not a brand hue. The button is the one control that must read
 * as *action* rather than as accent colour, so it left the 10% coral/orange
 * bucket for the neutral family on 2026-10-18. Cyberpunk still overrides the
 * fill with its magenta `#ff2bd6`.
 */
export const BUTTON_FILL: BrandHex = '#171717';

/** Hover fill — the second stop of `--gradient-button`. A neutral step. */
export const BUTTON_FILL_HOVER: BrandHex = '#2e2e2e';

/**
 * Ink on the button fill (`--button-ink`). The banner/card cream (`#f8f2da`,
 * the same value as `CREAM_CARD`), which clears AA on the near-black fill at
 * 15.97:1 and on the hover step at 12.10:1.
 */
export const BUTTON_INK: BrandHex = '#f8f2da';

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
 * Card cream — the light-theme project and article card surface
 * (`--card-background`). A hair lighter than CREAM on purpose: a card should
 * read as a raised sheet on the #f4efca page rather than as the page itself.
 * The dark and cyberpunk themes alias their `--background-secondary` here
 * instead, so one token serves all three.
 */
export const CREAM_CARD: BrandHex = '#f8f2da';

/**
 * Blue-family depth tints. The marketing surface is royal blue, so the only
 * place to add depth is within the blue family: `LIFT` reads as a raised
 * surface, `DEEP` as an inset well. Both are banner-surface only.
 */
export const SURFACE_BLUE_LIFT: BrandHex = '#2410e0';
export const SURFACE_BLUE_DEEP: BrandHex = '#0a0070';
export const SURFACE_BLUE_DEEPEST: BrandHex = '#06003a';

/**
 * Cream picture surface — every image asset: the 22 hero illustrations and the
 * OG/CV banners (2026-10-20). ΔRGB 2 from `CREAM_CARD`, which is why the two
 * read as the same sheet; they stay separate names because one is a UI fill and
 * this one is a picture surface.
 */
export const CREAM_SURFACE: BrandHex = '#f8f2d8';

/**
 * Ink on the cream picture surface. Royal blue carries the brand into the
 * banners without light-on-light: 10.28:1 on `CREAM_SURFACE`.
 */
export const BANNER_INK: BrandHex = BRAND_BLUE;

/** Deeper ink for values and emphasis on cream — 14.98:1. */
export const BANNER_INK_DEEP: BrandHex = SURFACE_BLUE_DEEP;

/** Muted label ink on cream (role line, legend, axes) — 5.56:1, AA normal text. */
export const BANNER_MUTED: BrandHex = '#5b4fc4';

/**
 * The banner accent on cream: burnt coral, 4.84:1 — clears the 3:1 graphics
 * floor for rules, rings and hexes, and AA for large text. It replaces
 * `ACCENT_ON_BLUE` (`#fe4e02`), which sits at 2.96:1 on cream.
 */
export const BANNER_ACCENT: BrandHex = '#b8431f';

/** The palette as one object, for consumers that prefer a menu over imports. */
export const BRAND = {
  blue: BRAND_BLUE,
  accentOnBlue: ACCENT_ON_BLUE,
  accentOnTeal: ACCENT_ON_TEAL,
  accentOnTealLight: ACCENT_ON_TEAL_LIGHT,
  buttonFill: BUTTON_FILL,
  buttonFillHover: BUTTON_FILL_HOVER,
  buttonInk: BUTTON_INK,
  cream: CREAM,
  creamCard: CREAM_CARD,
  surfaceBlueLift: SURFACE_BLUE_LIFT,
  surfaceBlueDeep: SURFACE_BLUE_DEEP,
  surfaceBlueDeepest: SURFACE_BLUE_DEEPEST,
  creamSurface: CREAM_SURFACE,
  bannerInk: BANNER_INK,
  bannerInkDeep: BANNER_INK_DEEP,
  bannerMuted: BANNER_MUTED,
  bannerAccent: BANNER_ACCENT,
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
