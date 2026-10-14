# Project tool chips use the accent-tinted skill-badge recipe

Written against: 7093a7e

## Evidence chain

- Surface: Tool/skill chips on project cards — homepage spotlight, projects page kanban, project detail (RU/EN), volta case study.
- Problem: `.project-tool` renders as a muted pill (`--background-tertiary` fill, `--text-muted` text, `--border-color` border), contradicting the documented skill-badge recipe that `.skill-badge` and `.blog-card-tag` already implement.
- Design evidence: DESIGN.md:122 "**Skill badge** — accent-tinted pill with an accent border; used for skills and topic chips." Exemplars: `.skill-badge` (global.css:521-531), `.blog-card-tag` (blog.css:111-123).
- Owner: `src/styles/global.css:873-883` (`.project-tool`)
- Scope and affected surfaces: All `.project-tool` renders — `ProjectCard` (homepage spotlight + projects page), `projects/[slug].astro`, `projects/volta/[part].astro`, `en/projects/[slug].astro`. The `.kanban-column .project-tool` (2050) and `.spotlight-slide .project-tool` (2326) overrides only set font-size and inherit the base colors.
- Uncertainty: None — the recipe is documented and two in-repo exemplars implement it.

## Design decision

Restyle `.project-tool` to the documented accent-tinted pill recipe, reusing the exact values from `.skill-badge`. This makes skill/topic chips consistent across the site (about page, blog cards, project cards) and conforms to DESIGN.md:122.

## Reuse

- Recipe: `.skill-badge` (global.css:521-531) — `background: color-mix(in srgb, var(--text-accent) 8%, transparent); color: var(--text-accent); border: 1px solid color-mix(in srgb, var(--text-accent) 20%, transparent); border-radius: var(--radius-full)`
- Exemplar: `.blog-card-tag` (blog.css:111-123) — same recipe with 10%/22% mixes

No new primitive required — the recipe exists and is already shared by two components.

## Changes

1. `src/styles/global.css:873-883` (`.project-tool`)
   - Change: `background: var(--background-tertiary)` → `background: color-mix(in srgb, var(--text-accent) 8%, transparent)`; `color: var(--text-muted)` → `color: var(--text-accent)`; `border: 1px solid var(--border-color)` → `border: 1px solid color-mix(in srgb, var(--text-accent) 20%, transparent)`
   - Preserve: display, align-items, font-size, font-weight, padding, border-radius
   - Verify: tool chips render as accent-tinted pills on all project cards, in all three themes

## Scope

- Inherit: All `.project-tool` renders — homepage spotlight, projects page, project detail (RU/EN), volta case study
- Verify: `.kanban-column .project-tool` (2050) and `.spotlight-slide .project-tool` (2326) still inherit the new colors (they only override font-size)
- Exclude: `.search-topic-chip` (global.css:1708) — a different chip variant (search facets) with its own hover behavior; not part of this change

## Validation

- Product: Browsing projects; tool chips read as accent-tinted pills consistent with the about-page skill badges and blog-card tags
- Interface: Homepage spotlight (RU/EN), projects page kanban (RU/EN), project detail (RU/EN), volta case study, all three themes, mobile + desktop
- System: Confirm the recipe matches `.skill-badge` values; confirm no other `.project-tool` color declaration exists (grep `\.project-tool` → only 873, 2050, 2326; the latter two set font-size only)
- Repository: `cd "/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/Personal_Projects.github.io" && bun run build` → build succeeds

## Stop conditions

- Stop if the muted chip is confirmed as a deliberate variant distinct from the skill badge (user intent) — reject the plan instead of widening scope.

## Design documentation

- After acceptance and validation: none — DESIGN.md already documents the skill-badge recipe; the change brings the implementation into conformance.
