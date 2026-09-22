---
version: alpha
name: Personal Projects Portfolio
description: Bilingual (RU/EN) portfolio for a product/data analyst — Obsidian-inspired dark-teal theme with light and cyberpunk modes, a single coral accent, and a kanban project board.
colors:
  background-primary: "#0f2a2b"
  background-secondary: "#1a3435"
  background-tertiary: "#234044"
  text-normal: "#e4e4e7"
  text-muted: "#a1a1aa"
  text-accent: "#ff8569"
  text-accent-hover: "#ffa68a"
  button-bg: "#1400c3"
  button-bg-hover: "#2410e0"
  button-ink: "#f8f8fa"
  interactive-normal: "#234044"
  interactive-hover: "#3f3f46"
  border-color: "#3f3f46"
  border-active: "#ff8569"
  code-background: "#234044"
  blockquote-border: "#3f3f46"
  table-border: "#3f3f46"
  table-header-background: "#234044"
  surface-secondary: "#27272a"
  shadow-color: "rgba(0, 0, 0, 0.4)"
  text-accent-dataviz: "#4ecdc4"
typography:
  sans:
    fontFamily: Inter
    fontSize: 16px
    lineHeight: 1.6
  display:
    fontFamily: Cormorant / Georgia / Times New Roman / Literata / Noto Serif / PT Serif
  mono:
    fontFamily: SF Mono
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  1: 0.25rem
  2: 0.5rem
  3: 0.75rem
  4: 1rem
  5: 1.25rem
  6: 1.5rem
  8: 2rem
  10: 2.5rem
  12: 3rem
  16: 4rem
  20: 5rem
components:
  button:
    backgroundColor: "{colors.button-bg}"
    textColor: "{colors.button-ink}"
    rounded: "{rounded.md}"
---

## Overview

A bilingual (RU/EN) personal portfolio for a product/data analyst, built with Astro and deployed to GitHub Pages. The design language is Obsidian-inspired: a dark-teal default theme with stepped surface roles, a single coral accent reserved for interactive semantics, and two alternate themes (light, cyberpunk) that re-map the same tokens. Projects are presented as a kanban board; content is card-based with sticky-note styling.

## Redesign Pilot (2026-09)

Goal: shift the homepage from a "dashboard-by-numbers" stack to an editorial + bento experience that communicates product-analyst identity in the first 10 seconds.

### Decisions

- **Audience:** hiring managers in product analytics.
- **Positioning:** "experienced analyst with product taste and technical depth".
- **Style direction:** editorial + bento, dataviz-first.
- **Scope:** Hero + navigation + design tokens (Phase 1); homepage restructure into editorial top + bento bottom (Phase 2).
- **Theme:** system preference by default, manual toggle in nav, `prefers-reduced-motion` respected.
- **Typography:** keep self-hosted Inter for UI/body; add a system serif/display stack (`--font-display`) for the hero name and major headings.
- **Hero:** two-column editorial layout — identity + pitch + metrics + CTAs on the left, animated dataviz panel on the right (floating metric cards over a mesh-gradient backdrop).
- **Navigation:** a left rail (≥1100px) carrying name/logo, the primary links (Projects, About, Value, Writing), language switch, search, contact CTA and theme toggle; below 1100px the same panel becomes an off-canvas drawer opened from a sticky top bar that holds the brand and the ☰/✕ trigger. Start/Graph/Games removed from the main nav but remain reachable via direct URLs and internal links.
- **Palette:** keep the existing teal/coral base; add a second `--text-accent-dataviz` token for graph/metric highlights so dataviz reads as information, not as a CTA.
- **Homepage structure:** editorial top after hero (featured project spotlight) and a bento grid bottom (career snapshot, knowledge graph, library, notes, arcade, testimonials).

### Files touched

- `src/styles/global.css` — new tokens, editorial hero + bento + featured-card styles, flatter nav.
- `src/layouts/Base.astro` — simplified navigation links and labels.
- `src/pages/index.astro` — new Russian hero + editorial/bento layout.
- `src/pages/en/index.astro` — new English hero + editorial/bento layout.
- `DESIGN.md` — this section.

### Phase 2 (completed)

- Replaced the long `home-stack` dashboard and its audience-toggle bar with a focused editorial top + bento bottom on both language homepages.
- Featured project spotlight surfaces `posthog.md` as the lead case (full loop: metric → hypothesis → experiment → decision).
- CapabilitiesGrid was removed (ADR-0001); the capabilities signal now lives in the featured project spotlight, the bento stack chips, and the `/projects/` board.
- Bento grid cells: `CareerSnapshot`, knowledge-graph link, `ReadingBlock`, notes link, arcade link, `Testimonials`.
- Removed from the homepage: the audience-toggle bar, the 3-column homepage kanban, and the A/B case-study block. Those components were deleted (PRD v6 / the case-study refactor) — no route renders them and they are reachable at no URL.
- Still reachable via direct URLs (dropped from nav, not from the build): `/graph`, and the static arcade assets under `public/games/`.
- **Known debt — unused components.** On disk but imported by nothing: `Manifesto`, `TopicMap`, `ProjectTimeline`, `CollaborationFormats` (~487 lines). Delete or re-link in navigation — task P3-2 in `docs/prd-v8-tasks.md`.
- **Known debt — orphan dependency.** `@paper-design/shaders` has had no consumer since the shader hero background was retired; recorded in `docs/prd-hero-banner-brand-polish.md` «Открытые вопросы» §2. Removal is task P3-3.

### Phase 3 (completed)

- Self-hosted **Cormorant** display serif with full Cyrillic coverage (variable weight 400–700), replacing the generic system stack.
- Updated `--font-display` token and preloaded the active-language subsets in `Base.astro` so the LCP heading renders in the final font early.
- Closed the two open design-plan items (`project-card-title-text-normal.md` and `project-tool-accent-pill.md`) — both were already implemented in commit `29ef020`.

### Phase 6 (completed)

- Added personal-layer pages `whois`, `value`, and `work-with-me` in both RU and EN, with `ProfilePage` JSON-LD, Telegram deep-link CTAs, and quantified proof on `value`.
- Wired the pages into the main nav with short labels (`Кто я` / `Ценность` / `Формат` and `Who I am` / `Value` / `Format`) to keep the bar usable.
- Updated the homepage hero tagline to the Phase 6 wording: `Гипотеза → эксперимент → метрика → рост.` / `Hypothesis → experiment → metric → growth.`
- Cross-links already existed in `about.astro`, `contact.astro`; `Analytics.astro` already fired `whois_viewed`, `value_viewed`, `work_with_me_viewed`; `llms.txt` already listed the pages.

### Next phase

- (none — backlog empty)

## Colors

- The accent is semantic, not decorative: use it for links, active nav, focus rings, borders, and primary actions. Do not introduce a second accent.
- Surfaces step primary → secondary → tertiary for page, card, and nested surfaces (code blocks, table headers, chips).
- The button fill is a distinct indigo (`#1400c3`) with `--button-ink` (white, `#f8f8fa`) — the primary-button convention. `--button-ink` is the ink that sits on the button fill: white (`#f8f8fa`) in dark/light themes, dark (`#1a1a1a`) in cyberpunk (where the fill is magenta). It is the ink for buttons, skip-link, `::selection`, and accent badges; it is **not** constant across all three themes — it flips to keep AA contrast on its fill.
- `text-muted` is for secondary text and metadata; `text-normal` for body and headings.

## Color Roles — 60-30-10

The palette is formalized against the **60-30-10** rule (`docs/prd-palette-60-30-10.md`): 60% dominant surfaces, 30% secondary neutrals (text + borders), 10% coral accent for interactive semantics. Every token maps to exactly one role; `--code-background` and `--table-header-background` are aliases of the tertiary surface, not separate colors.

| Role | Token | Dark | Light | Cyberpunk |
|---|---|---|---|---|
| **60% Dominant** (surfaces) | `--background-primary` | `#0f2a2b` | `#f4efca` | `#0a0a12` |
| | `--background-secondary` | `#1a3435` | `#ffffff` | `#11111d` |
| | `--background-tertiary` | `#234044` | `#f4f4f5` | `#1a1a2e` |
| | `--interactive-normal` | `#234044` | `#f4f4f5` | `#1a1a2e` |
| | `--interactive-hover` | `#3f3f46` | `#e4e4e7` | `#232342` |
| | `--code-background` | `#234044` | `#f4f4f5` | `#1a1a2e` |
| | `--table-header-background` | `#234044` | `#f4f4f5` | `#1a1a2e` |
| **30% Secondary** (neutrals) | `--text-normal` | `#e4e4e7` | `#18181b` | `#e6f1ff` |
| | `--text-muted` | `#a1a1aa` | `#52525b` | `#8a8aa8` |
| | `--border-color` | `#3f3f46` | `#e4e4e7` | `#2a2a4a` |
| | `--blockquote-border` | `#3f3f46` | `#e4e4e7` | `#2a2a4a` |
| | `--table-border` | `#3f3f46` | `#e4e4e7` | `#2a2a4a` |
| | `--surface-secondary` | `#27272a` | `#d4d4d8` | `#16162e` |
| **10% Accent** (interactive) | `--text-accent` | `#ff8569` | `#a8331a` | `#ff8569` |
| | `--text-accent-hover` | `#ffa68a` | `#8a2a16` | `#ffbe99` |
| | `--button-bg` | `#1400c3` | `#1400c3` | `#ff2bd6` |
| | `--button-bg-hover` | `#2410e0` | `#2410e0` | `#ff5ce0` |
| | `--button-ink` | `#f8f8fa` | `#f8f8fa` | `#1a1a1a` |
| | `--border-active` | `#ff8569` | `#a8331a` | `#ff8569` |

Application budget: dominant 55–65% of any screen, secondary 25–35%, accent ≤15%. The accent is reserved for links, active nav, focus rings, `border-active`, accent bars, and badge pills — never as the fill of a content block. The primary button fill is a **scoped exception**: it is indigo `#1400c3` (magenta `#ff2bd6` in cyberpunk), not the coral accent — a deliberate second interactive color so CTAs read as actions, not as accent text.

**Scoped exceptions** (raw hex outside the token system, by technical necessity — not palette drift):
- `Base.astro` `theme-color` meta + `THEME_COLORS` JS map — meta content cannot be a CSS variable; values mirror the dominant 60% per theme.
- `graph.ts` — the knowledge graph uses a categorical data-viz palette (~20 hues for node categories), a separate domain from the UI palette.

## Brand source of truth

`src/lib/brand.ts` holds the palette and the hexagon geometry that the site and the
OG banners share. It exports two **contextual** accents, one cream, the signal blue,
and the marketing-surface depth tints:

| Export | Value | Where it lands |
|---|---|---|
| `BRAND_BLUE` | `#1400c3` | `--button-bg` (dark + light); the OG banner surface |
| `ACCENT_ON_TEAL` | `#ff8569` | `--text-accent` (dark + cyberpunk) |
| `ACCENT_ON_TEAL_LIGHT` | `#a8331a` | `--text-accent` (light) |
| `ACCENT_ON_BLUE` | `#fe4e02` | the OG banner accent — never site text |
| `CREAM` | `#f4efca` | `--background-primary` (light) **and** the OG banner ink |

The two accents are deliberate, not drift: the high-chroma orange reads on the
royal-blue marketing surface, the coral on the teal site canvas. Swapping them
would fail contrast in both places.

`global.css` stays hand-written; agreement between it and `brand.ts` is enforced
by `tests/lib/brand.test.ts`, which parses the `:root`, `[data-theme="light"]` and
`[data-theme="cyberpunk"]` token blocks and fails on any divergence. The four
banner generators (`scripts/generate-{cv-og,cv-linkedin,home-og,graph-og}.mjs`)
import the same module, so there are no bare brand hexes outside it.


## Palette Swatches — 60-30-10

Bar widths approximate the 60/30/10 proportion (illustrative, not pixel-measured — see Goal 1 for a measured audit):

```
Dark       60% ▰▰▰▰▰▰▰▰▰▰  #0f2a2b teal       · 30% ▰▰▰▰▰  #e4e4e7 zinc    · 10% ▰▰  #ff8569 coral
Light      60% ▰▰▰▰▰▰▰▰▰▰  #f4efca cream      · 30% ▰▰▰▰▰  #18181b zinc    · 10% ▰▰  #a8331a sienna
Cyberpunk  60% ▰▰▰▰▰▰▰▰▰▰  #0a0a12 indigo     · 30% ▰▰▰▰▰  #e6f1ff cool    · 10% ▰▰  #ff8569 coral  (button fill: #ff2bd6 magenta)
```

## Visual Area Audit — Phase 2

Measured on `/` with `scripts/audit-palette-coverage.mjs` (Playwright + pngjs). Viewport screenshots at desktop/tablet/mobile in all three themes; each sampled pixel classified to the nearest palette hex (Euclidean RGB, threshold 25) into a 60/30/10 bucket. Pixels too far from the palette → `other` (photos, WebGL hero shader, anti-aliased edges). Evidence class: **Verified** (real rendered pixels).

| Theme | Breakpoint | 60% palette | 30% palette | 10% palette | other (screen) | verdict (60/30/10) |
|---|---|---:|---:|---:|---:|---|
| dark | desktop | 62.4 | 34.9 | 2.7 | 4.5 | PASS/PASS/PASS |
| dark | tablet | 61.9 | 34.7 | 3.4 | 16.2 | PASS/PASS/PASS |
| dark | mobile | 61.6 | 33.3 | 5.1 | 3.3 | PASS/PASS/PASS |
| light | desktop | 63.1 | 34.7 | 2.2 | 5.6 | PASS/PASS/PASS |
| light | tablet | 64.6 | 32.4 | 2.9 | 10.0 | PASS/PASS/PASS |
| light | mobile | 61.3 | 33.5 | 5.1 | 3.5 | PASS/PASS/PASS |
| cyberpunk | desktop | 64.8 | 34.0 | 1.2 | 0.9 | PASS/PASS/PASS |
| cyberpunk | tablet | 63.7 | 33.5 | 2.8 | 17.0 | PASS/PASS/PASS |
| cyberpunk | mobile | 63.3 | 31.6 | 5.0 | 2.8 | PASS/PASS/PASS |

**Result:** the home page now meets the 60-30-10 area budget across all nine theme/breakpoint combinations. Final CSS rebalancing kept `audience-bar` and `home-board` as `surface-secondary`, gave desktop board columns a translucent secondary background, compacted the hero on mobile/tablet, and added a small 60% strip from `.audience-note` on cyberpunk desktop to bring the last CHECK into range. Accent remains ≤15% everywhere.

Screenshots + `summary.json` → `reports/palette-audit/`.

## Color Wheel & Harmony

- **Dominant + accent = near-complementary pair.** Teal (≈180°) and coral (≈15°) sit on opposite sides of the color wheel, giving the 10% accent the tension the rule calls for. The single accent hue is a deliberate constraint: a second accent would dilute the "accent = action" semantics.
- **Secondary is achromatic.** The zinc neutrals carry no hue, so they never compete with the dominant teal or the coral accent — they provide depth and legibility, which is exactly why a neutral works as the 30% in this scheme.
- **Dark ≈ monochrome.** The dark theme is close to the article's monochrome case: one hue family (teal) across three stepped surfaces plus an achromatic 30%, with coral reserved for the 10%.
- **Cyberpunk ≈ vivid/eclectic.** The cyberpunk theme is the article's "break the rule" example: the button fill shifts to magenta `#ff2bd6` while the interactive accent stays coral, a deliberate 10% variation rather than a new 30% block.
- **The rule is a guide, not a law.** Deviations are documented here and in the PRD; the contrast gate (below) is the non-negotiable constraint.

## Contrast Verification

WCAG AA contrast is bound to a mechanism — `.claude/hooks/contrast-gate.js`, a PostToolUse guard that checks all three themes (`:root` dark, `[data-theme="light"]`, `[data-theme="cyberpunk"]`) and blocks any edit to `global.css` whose text/accent pair drops below AA (4.5:1 text, 3:1 non-text). Hook verified green on the current palette; cyberpunk button-ink `#1a1a1a` on `#ff2bd6` = 5.44:1, passes AA.

| Pair | Dark | Light | Cyberpunk | Gate |
|---|---|---|---|---|
| text-normal / bg-primary | 11.94:1 | 15.22:1 | 17.27:1 | hook |
| text-muted / bg-primary | 5.91:1 | 6.64:1 | 5.90:1 | hook |
| text-accent / bg-secondary (card) | 5.55:1 | 6.66:1 | 7.85:1 | hook |
| `--button-ink` / button-bg | 10.89:1 | 10.89:1 | 5.44:1 | hook |
| border-active / bg-primary (3:1) | 6.36:1 | 5.72:1 | 8.27:1 | hook |

## Themes

The default (dark) values live in the frontmatter. Light and cyberpunk re-map the same semantic tokens:

| Token | Light | Cyberpunk |
|---|---|---|
| background-primary | `#f4efca` | `#0a0a12` |
| background-secondary | `#ffffff` | `#11111d` |
| background-tertiary | `#f4f4f5` | `#1a1a2e` |
| text-normal | `#18181b` | `#e6f1ff` |
| text-muted | `#52525b` | `#8a8aa8` |
| text-accent | `#a8331a` | `#ff8569` |
| text-accent-hover | `#8a2a16` | `#ffbe99` |
| button-bg | `#1400c3` | `#ff2bd6` |
| button-bg-hover | `#2410e0` | `#ff5ce0` |
| interactive-normal | `#f4f4f5` | `#1a1a2e` |
| interactive-hover | `#e4e4e7` | `#232342` |
| border-color | `#e4e4e7` | `#2a2a4a` |
| border-active | `#a8331a` | `#ff8569` |
| code-background | `#f4f4f5` | `#1a1a2e` |
| blockquote-border | `#e4e4e7` | `#2a2a4a` |
| table-border | `#e4e4e7` | `#2a2a4a` |
| table-header-background | `#f4f4f5` | `#1a1a2e` |
| shadow-color | `rgba(0, 0, 0, 0.08)` | `rgba(255, 133, 105, 0.15)` |

The cyberpunk theme keeps the dark theme's accent so accent-tint recipes (badges, facets, counts) pass contrast on both; only the button fill shifts to magenta.

## Typography

- Inter variable is the only sans face, self-hosted in four subsets covering RU + EN — do not add a second sans family.
- Base text is the `sans` scale; code uses the mono stack.
- Display headings (hero name, page titles) use the `--font-display` serif stack for editorial contrast against Inter. The stack is system-native to avoid an extra font download and Cyrillic gaps in pilot; revisit with a hosted face if needed.
- Headings use weight contrast and tight letter-spacing rather than size alone; the hero name is the most extreme of both.
- Project and post prose is justified (`text-align: justify`) with automatic hyphenation (`hyphens: auto`) so the even right edge does not open word gaps.
- Paragraphs separate by a first-line indent (`text-indent: 1.5em`) with only a tight vertical gap, not by extra air; the indent drops after a heading, at the start of a section, and inside lists and quotes.
- Justification is turned off below 640px — in a narrow column it produces rivers and uneven spacing.

## Layout

- The body spans the viewport; at ≥1100px it reserves `--rail-total` on the inline start for the fixed nav rail, and the reading column stays centred at a 960px measure inside the remaining space.
- Below 1100px the nav is an off-canvas drawer over a scrim, opened from a sticky top bar; the panel holds the page scroll only while it is open.
- The kanban board is the only element that breaks out of the reading column, to a wider viewport-capped width — it centres on the content column, not the viewport, so it never slides under the rail.
- Project grids use auto-fit with a minimum card width so cards reflow without media queries.
- Post content is capped at a comfortable reading measure; intro paragraphs are narrower.
- The rail utility cluster (language, search, contacts CTA, theme) sits directly under the brand, above the primary links — the search dropdown opens downward from its toggle, so it needs the headroom the rail's bottom edge could not give it.
- The search dropdown anchors to the left edge of its toggle and opens rightward; on the rail it overhangs into the content column, and the rail stops clipping only while the panel is open. Inside the mobile drawer the panel fits the drawer width instead of overhanging a box that would cut it.
- The rail is opaque with a single inline-end hairline. Blur belongs to the mobile bar, which does have content scrolling under it.

## Elevation & Depth

- Hover lift is translateY plus a shadow derived from the shadow token — never scale or opacity alone.
- Cards lift more than buttons; buttons get an accent-tinted shadow.
- Reveal animations use the shared easing with a downward translate; stagger via the delay classes.

## Shapes

- Radii scale from small to full; cards use the largest corner, buttons the medium, badges and count pills the full.
- The accent top bar (cards, kanban columns) is the hover/active signal — keep it accent, not a surface color.

## Components

- **Button** — three variants: primary (indigo fill, white ink), secondary (transparent, accent border and text), demo (accent-tinted fill). Hover lifts with an accent-tinted shadow.
- **Project card** — secondary surface, hairline border, large corner; an accent gradient bar reveals on hover; the hero image scales up slightly.
- **Skill badge** — accent-tinted pill with an accent border; used for skills and topic chips.
- **Kanban column** — full-width snap panel on mobile, equal share on desktop; accent top border; header carries an accent dot and a count pill.

## Do's and Don'ts

- Don't ship a theme color that fails WCAG AA contrast against both the page background and the card surface — enforced by the contrast-gate hook.
- Don't use the accent as link text on a light card unless it passes AA; a vivid accent that works as a button fill often fails as link text.
