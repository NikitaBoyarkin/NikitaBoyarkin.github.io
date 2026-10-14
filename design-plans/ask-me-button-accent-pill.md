# Ask-me toggle joins the button family (accent-tinted pill, documented states)

Written against: 7e1cf09

## Evidence chain

- Surface: `#askme-toggle` — the floating "Ask me" control rendered only by
  `src/components/AskMe.astro`, mounted on `/about/` and `/en/about/`
  (`src/components/AboutPage.astro:318`).
- Problem: the control wears none of the documented button recipes. Its hover
  shadow is a raw black (`rgb(0 0 0 / 0.24)`, AskMe.astro:391) rather than the
  shadow token and with no accent tint; it has no `:active` state; it fills with
  a neutral surface token although it is the one conversational CTA on the page;
  and it is an unlabelled 52px circle, so a first-time visitor has no on-screen
  hint of what it does.
- Design evidence:
  - DESIGN.md:296 "Hover lift is translateY plus a shadow derived from the shadow token."
  - DESIGN.md:297 "Cards lift more than buttons; buttons get an accent-tinted shadow."
  - DESIGN.md:336 "Button — three variants: primary (orange fill, dark ink), secondary
    (transparent, accent border and text), demo (accent-tinted fill) … `:active`
    returns to the rested position."
  - DESIGN.md:120 "The accent is semantic, not decorative: use it for links, active
    nav, focus rings, borders, and primary actions."
  - DESIGN.md:75 "`prefers-reduced-motion` respected."
- Exemplars:
  - `.project .button-demo` (global.css:1849-1862) — the documented accent-tinted fill:
    `color-mix(… --text-accent 12%, transparent)` fill, `… 40%, transparent` border;
    hover `22%` / `60%`.
  - `.button:not(:disabled):hover` (global.css:903-907) — accent-tinted shadow
    `0 8px 20px color-mix(… --text-accent 25%, transparent)`.
  - `.button:not(:disabled):active` (global.css:2774-2778) — rested press
    `translateY(0)` + `0 2px 6px color-mix(… 18%, transparent)`.
  - `.button` geometry (global.css:884-897) — `--radius-md`, the shared transition list.
- Owner: `src/components/AskMe.astro` — styles `:371-396` (`.askme-toggle`), `:388-392`
  (hover); state `open()` `:298-307`, `close()` `:309-319`; i18n `:32-47`.
- Scope and affected surfaces: the FAB is component-scoped — `grep -rn "askme"
  src/styles/` returns nothing — so only `AskMe.astro` and the two About pages are
  in scope.
- Uncertainty: whether the FAB should read as an *invitation* (accent tint) or as
  neutral chrome. The plan takes the invitation reading, supported by DESIGN.md:120;
  the stop condition below holds the alternative open.

## Design decision

Bring the FAB into the documented button family as the **demo variant** — an
accent-tinted fill — with a **visible label** on ≥640px so the control names
itself, collapsing to the existing 52px icon circle below 640px. Fix the hover
shadow, add the pressed state, and guard the lift for reduced motion, all by
copying the exact values the `.button` family already uses.

Deliberately *not* the primary (orange) variant: the orange fill is reserved for
the page's main CTAs, and a second orange target on `/about/` would compete with
them and eat accent budget. The accent tint reads as an invitation at a fraction
of the area.

## Reuse

- Demo-variant recipe: `.project .button-demo` (global.css:1849-1853) — 12% fill /
  40% border, hover 22% / 60%.
- Hover shadow: `.button:not(:disabled):hover` (global.css:906) — 25% accent tint.
- Pressed state: `.button:not(:disabled):active` (global.css:2777) — 18% accent tint.
- Geometry: `.button` (global.css:884-897) — `--radius-md`, transition list.
- Tint eyebrows are AAA-verified by the existing contrast gate on `.skill-badge`
  and `.project-tool`, which use the same recipe on the same three themes.

No new primitive is required.

## Changes

1. `src/components/AskMe.astro:32-47` — add `ctaOpen` to `i18n` and to the `I18n`
   type (`:128-139`): "Спроси меня" / "Ask me".
2. `src/components/AskMe.astro:62-72` — add `<span class="askme-toggle-label">`
   (text = `i18n.ctaOpen`) inside the toggle. Keep `id="askme-toggle"`, `type`,
   `data-analytics`, `aria-*` and the inner `<MorphIcon id="askme-icon" icon={CHAT_D}
   spring="snappy" reducedMotion="user" size={20}>` byte-for-byte — `tests/built/morph.test.ts`
   asserts the rest `d` equals `data-icon-chat` and that the close endpoint differs.
3. `src/components/AskMe.astro:298-319` — in `open()`/`close()`, swap the visible
   label text alongside `aria-label` (`ctaOpen` ⇄ `closeLabel`) so the visible label
   stays contained in the accessible name (WCAG 2.5.3).
4. `src/components/AskMe.astro:371-396` (`.askme-toggle`) — accent-tinted fill
   `color-mix(in srgb, var(--text-accent) 12%, var(--background-secondary))` (opaque:
   the FAB scrolls over arbitrary content, so a translucent fill would let text bleed
   through), colour `var(--text-accent)`, border
   `1px solid color-mix(in srgb, var(--text-accent) 40%, transparent)`,
   `border-radius: var(--radius-md)`, pill padding + `gap: var(--space-2)`, label
   type at the 0.85–0.9rem button scale. Keep `position: fixed`, the `z-float` layer
   and the existing box-shadow/token base.
   - Preserve: `position`, `right`/`bottom` anchors, `z-index`, `cursor`, focus-visible.
5. `src/components/AskMe.astro:388-392` (hover) — fill 22%, border 60%, and
   `box-shadow: 0 8px 20px color-mix(in srgb, var(--text-accent) 25%, transparent)`,
   replacing `rgb(0 0 0 / 0.24)`.
6. `src/components/AskMe.astro` — add `.askme-toggle:active` (rested `translateY(0)` +
   `0 2px 6px color-mix(… 18%, transparent)`) and
   `@media (prefers-reduced-motion: reduce) { .askme-toggle { transition: none } .askme-toggle:hover { transform: none } }`.
7. `@media (max-width: 640px)` (existing block `:545-554`) — hide
   `.askme-toggle-label` and restore the 3.25rem circle so the mobile FAB keeps its
   footprint.

## Scope

- Inherit: all `#askme-toggle` renders — `/about/` and `/en/about/`, all three themes.
- Verify: `tests/built/morph.test.ts` "ask-me toggle" block; `tests/lib/qa-corpus.test.ts`
  (asserts the component still imports `../lib/qa-corpus`, unaffected); the panel's
  own styles and the `SearchBox` toggle stay untouched (a rail control, not a FAB).
- Exclude: the panel, the corpus, and `SearchBox`.

## Validation

- Product: opening `/about/` and `/en/about/`, the FAB reads as an accent-tinted
  invitation that names itself; hovering lifts with an accent-tinted shadow; pressing
  lands back down.
- Interface: dark / light / cyberpunk; ≥640px pill and <640px circle; hover, active,
  focus-visible; `prefers-reduced-motion: reduce` leaves the FAB still.
- System: `tests/built/morph.test.ts` green; no `.askme-*` rule exists in
  `src/styles/`; the tint recipe is already gated by the contrast gate via
  `.skill-badge` / `.project-tool`.
- Repository: `cd "/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/NikitaBoyarkin.github.io"
  && bun run build && bun test tests/built` → green.

## Stop conditions

- Stop if the accent-tinted FAB is judged to compete with the page's primary CTAs and
  a neutral utility treatment is the intent — then keep the icon-only circle and land
  only changes 1, 3, 5, 6 (label omitted, shadow/active/reduced-motion fixes).

## Design documentation

- After acceptance and validation: add the FAB as a documented variant under
  DESIGN.md → Components, so the fourth button treatment is recorded rather than
  inferred.
