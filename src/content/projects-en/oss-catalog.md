---
title: OSS catalog — 47 projects from one source
description: "A static catalog of 47 open repositories: GitHub metadata is synced by a script into frontmatter and the build reads only that — 15 fields per project, 26 tests and an idempotent render."
star:
  situation: "The project catalog was maintained by hand: cards drifted from GitHub, and metadata and links had to be updated in two places"
  task: "I needed a catalog where the data comes from one machine-owned source, pages are built from it, and a repeated sync does not overwrite authored edits"
  action: "Astro 7 with content collections, a Python sync from the GitHub API into TOML, a frontmatter generator with an ownership marker, a notes validator and 26 tests, and CI ordered from the cheap gate to the build"
  result: "47 project pages and 15 metadata fields are built from one TOML file; a repeated render is idempotent, and 26 tests cover all three record-matching branches"
track: engineering
dataset: real
hero: images/oss-catalog.svg
ogImage: /images/og/oss-catalog.png
impact:
  - "47 project pages and 47 repo records are built from one `data/github-repos.toml`"
  - "15 metadata fields per repository: stars, forks, releases, licence, language, contributors, last update"
  - "26 tests, including byte-level idempotency of a repeated render and all three record-matching branches"
  - "CI runs from the cheap gate to the expensive one: validator and tests before Astro dependencies, then type-check, build and Pagefind"
  - "Machine and editorial data are separated: `exclude:` prunes noisy fields and explicit languages survive a re-sync"
tools:
  - Astro
  - TypeScript
  - Bun
  - Python
  - GitHub API
  - Pagefind
  - uv
date: 2026-11-01
updated: 2026-11-06
github: https://github.com/NikitaBoyarkin/oss-catalog
bet: "The catalog has to be a projection of machine data rather than a hand-kept table: otherwise cards and GitHub drift apart and nobody notices the divergence."
failureBar: "The build is accepted only if the validator passes on every page, a repeated render leaves the file unchanged, and a field absent from the source never reaches the frontmatter."
retro: "The separation of machine and editorial data held: `exclude:` and explicit languages survive a re-sync. `website` and `readme_image` stayed unused — fetched but never rendered; that is recorded as debt, not as a feature."
related:
  - /projects/site/
  - /projects/garden/
---

# OSS catalog — 47 projects from one source

## Situation

An open-source project catalog assembled by hand ages faster than it can be updated. Stars, releases and languages change on GitHub while the site keeps numbers from a month ago. Worse, the same card exists in two places — a data table and the markup — and disagrees with itself.

## Task

I needed a catalog where the data comes from one machine-owned source, pages are built from it, and a repeated sync does not overwrite authored edits.

## Actions

**Data source.** A Python script calls the GitHub API and writes one TOML file: 47 records with 15 fields each — name, description, stars, forks, releases, licence, language, contributors, last update and others. The API response cache lives outside the repository.

**Ownership split.** The generator rewrites only the frontmatter block under an "updated automatically" marker; the rest of the page stays authored. An `exclude:` field prunes noisy machine values, and explicitly set languages survive a repeated sync.

**Build.** Astro 7 with content collections: a `glob` loader reads project and note pages, a Zod schema checks types, and the project page renders metadata and links. The site is static with no client framework.

**Validation.** A separate validator checks notes and project pages: required fields, key parity with the source, no empty blocks. In strict mode a warning about a record without metadata becomes an error.

**Tests.** 26 tests cover the three record-matching branches — owner/name, short name, directory name — render idempotency, preservation of editorial fields, and the real page tree.

**CI.** Steps are ordered by cost: the validator and Python tests run before Astro dependencies are installed, then `astro check`, build, Pagefind and deploy. The cheap gate fails before the expensive one runs.

## Result

- **47** project pages and **47** repository records from one TOML file.
- **15** metadata fields per record, including stars, forks, releases, licence and last update.
- **26** tests, including byte-level idempotency of a repeated render.
- **8** topic pages, **76** tag pages and **5** language pages generated from the same source.
- The build never goes to the network: the site reads only committed frontmatter, so the deploy is reproducible.
- The validator passes on every page, and `astro check` catches schema drift before the build.

## What I learned

A catalog is a projection of machine data, not a hand-kept table. While there is one source and pages are built from it, a card cannot drift from GitHub: a divergence becomes a broken build rather than an editorial slip. The ownership split — the generator rewrites only the block under the marker, everything else stays authored — is what makes a repeated sync safe.

The boundary: build reproducibility here follows from the site reading committed frontmatter and never touching the network, not from good architecture in the abstract. The CI ordering from cheap gate to expensive one is likewise a consequence — the validator and Python tests need no Astro dependencies. And unused fields plus Pagefind with no search UI are recorded as debt, not presented as features.

## Discussion points

- **Why a TOML file rather than an API call at build time.** A build with no network is reproducible; otherwise the deploy depends on API availability and rate limits.
- **Why an ownership marker rather than generating the whole page.** Authored edits have to survive a re-sync, or every run wipes out manual work.
- **Where validation stops helping.** It is mechanical: description drift, placeholders and alt text remain a human pass, and the page-count test only holds a floor.
- **What I would change under real traffic.** Fields with no consumer and Pagefind with no UI would either get a renderer or be cut — right now they are debt.

## Limitations

Validation is mechanical: description drift, placeholders and alt text remain a human or separate editorial pass.

The page-count test asserts a floor, not the exact number, so drift away from 47 stays green.

`website`, `readme_image`, `latest_release` and `first_commit` are fetched or declared in the schema but never rendered: the field exists, the consumer does not.

Pagefind is installed and runs in the build, but there is no search UI — search remains an unused dependency.

The catalog is a showcase of an engineering pipeline, not a product with metrics: there is no user analytics and no A/B testing here.

## Documentation

- `README.md` — the data source, quick start and the boundaries of the claim.
- `scripts/update-github-repos.py` — the GitHub API sync into TOML.
- `scripts/update-project-frontmatter.py` — the metadata block generator with the ownership marker.
- Checks: `bun run validate` → `uv run tests/test_scripts.py` → `bun run check` → `bun run build`.
