---
title: Scrolly English Speaking
description: "A scrollytelling guide to spoken English for workplace conversations (A2–B1): an MDX narrative with D3 visualizations, content and visuals decoupled. Built on Astro 6."
track: engineering
hero: images/scrolly.svg
impact:
  - Scrollytelling narrative on Astro 6 + MDX, D3 visualizations (workflow, bars, calendar, checklist)
  - Content and visuals decoupled — trusted data module, frontmatter safely merged on top
  - Interactive viz panels via IntersectionObserver + dark/light theme + reduced-motion
  - Deployed to GitHub Pages subpath, Node 22, `astro check` in CI
tools:
  - Astro
  - TypeScript
  - MDX
  - D3
  - Tailwind v4
github: https://github.com/NikitaBoyarkin/scrolly-english-speaking
updated: 2026-08-25
related:
  - /projects/site/
  - /projects/garden/
---

# Scrolly English Speaking

## Situation

Workplace conversations in English (standups, syncs, interviews) are a weak spot for many Russian-speaking specialists at A2–B1: the grammar is there, but coherent speech and real-time reactions stall. A textbook doesn't help much: no context, no visuals, no link between phrases and situation. The task is to build not an article but an interactive guide, where a narrative leads the reader through workplace-conversation scenes and visualizations show how the workflow, tools, and progress metrics are structured.

## Task

I needed learners to practice workplace English inside a real situation rather than from a textbook, so I owned the interactive guide, its narrative scenes, and the visuals that carry the context.

## Actions

**Stack:** Astro 6 (`output: static`) + MDX + Tailwind v4 (via `@tailwindcss/vite`), D3 v7 for visualizations, Shiki (`nord` theme) for code, `@astrojs/sitemap`. Deploy to GitHub Pages subpath, Node 22.

**Architecture:**

- `src/layouts/ScrollyLayout.astro` — single template: hero, 2-column scrolly, viz panels, head meta.
- `src/posts/scrolly/*.mdx` — narrative (section text) with `<ScrollySection>` blocks.
- `src/scrolly/data/*.ts` — `configId` + sections + viz props + theme. Trusted HTML source: hero/footer always come from the data module, never from frontmatter — injection guard.
- `src/scrolly/scrolly-runtime.ts` — IntersectionObserver, `switchViz`, theme-toggle; viz renderers via lazy import.

**Content model:** MDX frontmatter (`configId`, `metadata`, `theme`) is safely merged on top of the trusted data module. Hero/footer HTML always from `data/*.ts`, never from frontmatter.

## Result

Synchronizing narrative and visualization holds attention better than a static article with pictures: the reader reaches a paragraph and at that moment the chart on the right changes. Splitting MDX and data modules solves the core pain of static sites — mixing text and logic: the narrative stays editable in Markdown, and the visualizations stay typed in TypeScript. A new scene is a new data file + MDX, with no rendering changes.

## Limitations

The guide targets A2–B1 and covers workplace scenarios, not general English; the material is the author's and has not been reviewed by a methodologist. Decoupling content from data modules guards against frontmatter injection, but not against the content itself.

## Documentation

- [Live page →](https://nikitaboyarkin.github.io/scrolly-english-speaking/english-speaking)
- [GitHub → scrolly-english-speaking](https://github.com/NikitaBoyarkin/scrolly-english-speaking)
