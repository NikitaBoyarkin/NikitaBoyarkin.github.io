# Project card titles use text-normal

Written against: 7093a7e

## Evidence chain

- Surface: Project cards on the homepage kanban spotlight (`HomeBoard` → `ProjectSpotlight` → `ProjectCard`) and the projects page kanban (`ProjectBoard` → `ProjectCard`).
- Problem: `.project h3` renders the project title in `var(--text-accent)`, while every other card title on the same homepage — `.board-card-title` (Profile/Now columns), `.capability-title` (CapabilitiesGrid), `.timeline-body h3 a` (ProjectTimeline) — uses `var(--text-normal)`. The accent title is the outlier in the card-title family.
- Design evidence: DESIGN.md:65 "`text-muted` is for secondary text and metadata; `text-normal` for body and headings"; DESIGN.md:62 "The accent is semantic, not decorative: use it for links, active nav, focus rings, borders, and primary actions."
- Owner: `src/styles/global.css:789` (`.project h3`)
- Scope and affected surfaces: All `ProjectCard` renders — homepage spotlight, projects page kanban (RU + EN). The `.kanban-column .project h3` (global.css:2035) and `.spotlight-slide .project h3` (global.css:2311) overrides only set font-size and inherit the base color, so a single base change covers all.
- Uncertainty: The accent-heading pattern also appears in featured contexts (`.case-study h2`, `.pn-title`, `.intro-content h2`). Those are out of scope — this plan only unifies the card-title family. If the accent title is a deliberate signature the user wants to keep, reject the plan rather than widen it.

## Design decision

Change `.project h3` color from `var(--text-accent)` to `var(--text-normal)`, matching the documented heading rule and the sibling card titles on the same homepage. The accent remains available for the card's interactive semantics (links, buttons, hover bar) per DESIGN.md:62.

## Reuse

- Token: `var(--text-normal)`
- Exemplar: `.board-card-title` (global.css:2401-2404), `.capability-title` (CapabilitiesGrid.astro:181-186), `.timeline-body h3 a` (ProjectTimeline.astro:126-137)

No new primitive required — the token and the sibling-card pattern already exist.

## Changes

1. `src/styles/global.css:789` (`.project h3`)
   - Change: `color: var(--text-accent)` → `color: var(--text-normal)`
   - Preserve: font-size, font-weight, letter-spacing, margin
   - Verify: project card titles render in text-normal on the homepage spotlight and the projects page kanban, in all three themes (dark, light, cyberpunk)

## Scope

- Inherit: All `.project h3` renders — homepage spotlight, projects page kanban (RU + EN)
- Verify: `.kanban-column .project h3` (2035) and `.spotlight-slide .project h3` (2311) still inherit the new color (they only override font-size)
- Exclude: Featured-context accent headings (`.case-study h2`, `.pn-title`, `.intro-content h2`) — separate intent, not part of this change

## Validation

- Product: Browsing projects on the homepage and projects page; card titles read as body-level headings, accent reserved for interactive elements
- Interface: Homepage spotlight (RU/EN), projects page kanban (RU/EN), all three themes, mobile + desktop
- System: Confirm no other `.project h3` color declaration exists (grep `\.project h3` → only 789, 2035, 2311; the latter two set font-size only)
- Repository: `cd "/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/Personal_Projects.github.io" && bun run build` → build succeeds

## Stop conditions

- Stop if the accent title is confirmed as a deliberate signature (user intent) rather than an inconsistency — reject the plan instead of widening scope.

## Design documentation

- After acceptance and validation: none — DESIGN.md already documents "text-normal for body and headings"; the change brings the implementation into conformance.
