---
title: This Portfolio Site
description: "The site you are reading: Astro 7, TypeScript and Markdown content collections, static output, dark/light theme, RSS, sitemap, JSON-LD and GitHub Pages deployment."
track: engineering
hero: images/site.svg
impact:
  - Astro 7 + TypeScript + Markdown content collections
  - Dark/light theme with no-flash inline script
  - RSS, sitemap, robots, JSON-LD, OG/Twitter meta
  - Base-path-aware URLs for GitHub Pages hosting
tools:
  - Astro
  - TypeScript
  - Markdown
  - CSS custom properties
github: https://github.com/NikitaBoyarkin/NikitaBoyarkin.github.io
updated: 2026-09-16
related:
  - /projects/garden/
  - /projects/scrolly/
  - /posts/data-analyst-portfolio-checklist/
---

# This Portfolio Site

## Goal

A static portfolio where content (projects, posts) is edited in Markdown rather than component markup. Hosting is GitHub Pages as a user site (repository `NikitaBoyarkin.github.io`, served from the domain root), deploy is push-triggered with no manual build. Content and presentation must separate: a new project is a new `.md` file, with no component edits.

## Data & Method

**Stack:** Astro 7, TypeScript, Markdown content collections (`src/content/{projects,posts}/`), Zod schemas in `src/content.config.ts`.

**Architecture:**

- **Content collections** — each project/post = Markdown + frontmatter; Zod validates fields at build.
- **Base path** — `withBase()` from `src/lib/path.ts` applies `base` to all internal links and images (the site now serves from the root, `base: '/'`).
- **Theme** — an inline `<head>` script reads `localStorage`/`prefers-color-scheme` and sets `data-theme` before first paint (no flash); CSS custom properties are reactive.
- **SEO** — `sitemap.xml`, `robots.txt`, `rss.xml`, JSON-LD, OG/Twitter meta, canonical.
- **Deploy** — GitHub Actions builds `dist/` and publishes to Pages on push to `master`.

**Validation:** `scripts/check_site.py` checks required pages, internal links, the profile image, and assets in `index.html`.

## Result

Content collections with Zod are a contract between content and presentation: invalid frontmatter breaks the build, not the deploy. `withBase()` encapsulates the GitHub Pages base path — no link hardcodes the base. The "content = `.md`, presentation = `.astro`" split means adding a project requires no code changes.

## Limitations

The site is built for one hosting setup: GitHub Pages as a user site with `base: '/'`. Moving to a project page or another host would require changes to `withBase()` and the deploy workflow. Validation covers structure and links, not content.

## Documentation

- [GitHub → NikitaBoyarkin.github.io](https://github.com/NikitaBoyarkin/NikitaBoyarkin.github.io)
