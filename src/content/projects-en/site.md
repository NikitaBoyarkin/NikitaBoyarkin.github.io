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
updated: 2026-09-20
related:
  - /projects/garden/
  - /projects/scrolly/
  - /posts/data-analyst-portfolio-checklist/
---

# This Portfolio Site

## Context

A static portfolio was needed where content (projects, posts) is edited in Markdown rather than component markup. Hosting is GitHub Pages as a user site (repository `NikitaBoyarkin.github.io`, served from the domain root). Deploy is push-triggered, with no manual build.

## Hypothesis

If we take Astro with content collections and a Zod frontmatter schema, content and presentation separate: new projects/posts are a new `.md` file, with no component edits. The base path and meta tags (OG, JSON-LD, sitemap, RSS) are configured once.

## Data & Method

**Stack:** Astro 7, TypeScript, Markdown content collections (`src/content/{projects,posts}/`), Zod schemas in `src/content/config.ts`.

**Architecture:**

- **Content collections** — each project/post = Markdown + frontmatter; Zod validates fields at build.
- **Base path** — `withBase()` from `src/lib/path.ts` applies `base` to all internal links and images (the site now serves from the root, `base: '/'`).
- **Theme** — an inline `<head>` script reads `localStorage`/`prefers-color-scheme` and sets `data-theme` before first paint (no flash); CSS custom properties are reactive.
- **SEO** — `sitemap.xml`, `robots.txt`, `rss.xml`, JSON-LD, OG/Twitter meta, canonical.
- **Deploy** — GitHub Actions builds `dist/` and publishes to Pages on push to `master`.

**Validation:** `scripts/check_site.py` checks required pages, internal links, the profile image, and assets in `index.html`.

## Findings

Astro content collections with Zod are a contract between content and presentation: invalid frontmatter breaks the build, not the deploy. `withBase()` encapsulates the GitHub Pages base path — no link hardcodes the base. The "content = `.md`, presentation = `.astro`" split means adding a project requires no code changes.

## Impact

- **Astro 7 + TypeScript + Markdown content collections** — content edited in `.md`, validated by Zod.
- **Dark/light theme without flash** — inline script before first paint.
- **Full SEO** — RSS, sitemap, robots, JSON-LD, OG/Twitter meta, canonical.
- **Base-path-aware URLs** — `withBase()` for GitHub Pages, no hardcoding.

## Documentation

- [GitHub → NikitaBoyarkin.github.io](https://github.com/NikitaBoyarkin/NikitaBoyarkin.github.io)