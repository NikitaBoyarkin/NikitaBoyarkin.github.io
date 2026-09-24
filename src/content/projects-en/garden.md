---
title: Digital Garden
description: "A personal digital garden and Zettelkasten published as a Quartz v4 site: linked notes, backlinks and a graph view instead of a chronological blog feed."
track: engineering
hero: images/garden.svg
impact:
  - Linked-notes Zettelkasten with backlinks + graph view
  - Atomic evergreen notes over chronological posts
  - Quartz v4 — TypeScript-extensible, static output
  - Obsidian-flavored Markdown → public site
tools:
  - TypeScript
  - Quartz v4
  - Markdown
  - Obsidian
github: https://github.com/NikitaBoyarkin/digital_garden
updated: 2026-08-12
related:
  - /projects/site/
  - /projects/scrolly/
---

# Digital Garden

## Goal

Knowledge as chronological posts ages quickly and loses connections. A digital garden is the opposite of a blog: notes are not ordered by date but linked with `[[wikilinks]]`, have maturity stages (seedling → evergreen), and evolve over time. The task: publish a personal Zettelkasten as a static site where the reader sees a network of ideas and navigates by meaning, not chronology.

## Data & Method

**Content model:** atomic notes in Obsidian-flavored Markdown. Each note is one idea, with YAML frontmatter, tags, and `[[wikilinks]]` to neighboring concepts.

**Quartz v4:**

- TypeScript plugins for rendering — extensibility out of the box.
- Backlinks: each note shows everyone that links to it.
- Graph view: a visualization of the note graph (nodes = notes, edges = links).
- Full-text search, popover preview on `[[wikilink]]` hover.
- Static output — host on GitHub Pages, no server.

## Result

The power of a digital garden is in the links, not the individual notes. Backlinks turn a note into a "node" and show which contexts include it. The graph turns note accumulation into a navigable structure: topic clusters and isolated islands are visible. A chronological blog answers "when"; a garden answers "how is this connected."

## Limitations

The garden is a personal tool, not a product: notes are immature by definition, some stay seedlings, and the links reflect the author's thinking rather than a finished system. That makes the site more honest than a blog, but also less predictable for an outside reader.

## Documentation

- [GitHub → digital_garden](https://github.com/NikitaBoyarkin/digital_garden)
