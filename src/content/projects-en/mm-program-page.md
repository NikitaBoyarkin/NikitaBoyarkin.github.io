---
title: Matemarketing 2026 Programme — a static replica
description: "Rebuilt a conference programme page: a time × hall grid over 91 talks, track filters, a modal and .ics export — then checked the copy against the original with measurements, not eyeballing."
star:
  situation: "A conference programme page is a Vue SPA: the data lives in an API and the layout in a bundle, so 'make it the same' usually means 'make it look similar'"
  task: "Take a third-party interface apart down to measurable quantities and rebuild it with no build step and no backend"
  action: "Pulled the programme from the public API, measured the grid on the rendered DOM, rebuilt it in plain HTML/CSS/JS, then ran four independent passes: code review, security audit, browser tests, visual audit"
  result: "The grid matches the original to the pixel: 99 px time column, 420 px hall column, 391 px card, 550 px row, grid top at y = 414; tests catch data and layout drift"
track: engineering
hero: images/mm-program-page.svg
ogImage: /images/og/mm-program-page.png
impact:
  - "Grid replicated 1:1 by measurement: 99–100 px time column, 420 px hall, 391 px card, 550 px row"
  - "Data comes from the public API rather than scraped HTML: 3 days, 91 talks, 11 tracks, 9 halls"
  - 2,370 data assertions and 7 browser tests, both suites mutation-checked
  - "Degradation instead of emptiness: a dead banner turns the card into a text card, not a dark hole"
tools:
  - HTML
  - CSS
  - JavaScript
  - Python
github: https://github.com/NikitaBoyarkin/mm-program-page
demo: https://nikitaboyarkin.github.io/mm-program-page/
related:
  - /projects/site/
date: 2026-11-03
updated: 2026-11-03
---

# Matemarketing 2026 Programme — a static replica

**▶ [Live replica](https://nikitaboyarkin.github.io/mm-program-page/)** — runs on any static host, no build, no install.
**Code:** [NikitaBoyarkin/mm-program-page](https://github.com/NikitaBoyarkin/mm-program-page).
**Talks graph:** [the same 91 talks as a graph](/en/talks/) — tracks, themes and the links between talks.

## Situation

A conference programme page is a typical SPA: the HTML ships an empty `<div id="app">`, the
programme arrives from an API and the browser draws it. You cannot copy such a page by saving the
rendered markup — the saved file has neither the talks nor the grid. The usual answer to this task
is "I made it look similar", and there is no way to check that claim.

## Task

Take the interface apart into measurable quantities — column widths, insets, row height, type
sizes — and rebuild it with no build step, no backend and no npm. More importantly, replace
"looks similar" with something checkable: measurements, tests and an explicit list of deviations.

## Actions

1. **Reconnaissance.** Established that the page is a Vue app and the programme comes from
   `GET /api/event-program/event/6/`: 335 KB of JSON, 3 days, 91 talks, 11 tracks, 9 halls.
   Design tokens (borders `#E5E7EB`, grid surface `#F9FAFB`, brand `#5C34F6`) came from the
   visual config and the shipped CSS rather than from picking colours by eye.
2. **Data.** `tools/fetch_program.py` downloads the payload, strips HTML from descriptions,
   falls back to the first paragraph when `short_description` is empty, and writes
   `window.MM_PROGRAM`. Modes: `--fetch`, `--check` (detects drift between snapshot and API)
   and `--dry-run`.
3. **Layout.** An `index.html` skeleton plus curated CSS (an extract of the shipped CSS with
   `data-v-*` stripped and Vuetify internals dropped) and a dependency-free `app.js`: the
   time × hall grid, multi-slot cards, day tabs, 11 track chips, `localStorage` favourites,
   a modal with a focus trap, and per-day `.ics` export.
4. **Verification.** Four independent passes: code review (15 findings, 2 high), security audit
   (0 blocking), browser tests in headless Chrome, and a visual audit with pixel measurements.
   The findings added URL validation for images, fallbacks for broken banners and avatars,
   `.ics` line folding, tab/ARIA wiring and a CSP.

## Result

The grid is replicated by measurement, not by feel:

| Metric (1440 px) | Original | Replica |
| --- | --- | --- |
| Time column | 99 px | 99–100 px |
| Hall column | 420 px | 420 px |
| Card and radius | 391 px, 16 | 391 px, 16 |
| Banner | 4:3, 291 px | 4:3, 291 px |
| Row height | 550 px | 550 px |
| Grid top | y = 414 | y = 414 |
| Heading (ink box) | 638×22 | 650×22 |
| Document height | 6605 px | 6589 px |

Verification: `tests/test_data.py` — 9 tests, 2,370 data-invariant assertions;
`tests/test_page.py` — 7 tests against real rendering (per-day counts, `grid-area` integrity,
screenshots at 1440 and 390 px, graceful degradation without data). Both suites are
mutation-checked: a broken counter, a shifted grid and an empty title each fail the matching test.

## What I learned

"Looks similar" and "matches" are different claims, and the difference between them is measurable.
Once the interface is broken down into columns, insets, row height and type sizes, the replica
becomes checkable: the grid either agrees with the original or it does not, and a test catches a
shift before the eye does. Measurement is the only thing separating a replica from an impression,
and it is also what makes the list of deviations honest.

The boundary matters more than the result here: the replica does not claim authorship of the
content. The programme, the texts and the design tokens come from the original; only the
reproduction of layout and data was checked. The deviations are listed rather than hidden, and
almost all of them follow from constraints, not choices: the heading typeface does not load
because of CORS, and the counter shows the number of talks instead of "people online" because
presence cannot be invented in a static page.

## Discussion points

- **Why take the SPA apart before measuring instead of saving the markup.** The saved HTML holds
  neither the talks nor the grid: the data lives in an API, and without reconnaissance there is
  nothing to copy.
- **Why pull the data from the API rather than scrape the DOM.** The API hands over structure
  directly and makes drift between snapshot and original detectable.
- **Where the replica honestly diverges.** The heading typeface and images are not redistributed for
  licence and CORS reasons, so the deviation is measured against the ink box rather than papered over.
- **What was checked and what was not.** Tests hold the data, `grid-area` and rendering, but the
  replica does not replace the original and does not claim authorship of its content.

## Limitations

- No backend: no auth, no personal cabinet, no server-side favourites, no chat or player.
- Images and the commercial heading typeface are not redistributed — they load from the original
  CDN. Because of CORS the original Loos Wide does not load, so the heading is drawn by the free
  Unbounded, fitted to the ink box (650×22 against 638×22).
- The header counter shows the number of talks that day, not a fake "people online": presence in a
  static page cannot be invented.
- The data is a snapshot. `python3 tools/fetch_program.py --check` reports when the original
  programme changes.

## Documentation

- [Code and tests](https://github.com/NikitaBoyarkin/mm-program-page) — `index.html`,
  `assets/app.js`, `tests/`, `tools/fetch_program.py`
- [CONTRACT.md](https://github.com/NikitaBoyarkin/mm-program-page/blob/main/CONTRACT.md) — data
  schema, DOM contract and behaviour list
- [docs/DECISIONS.md](https://github.com/NikitaBoyarkin/mm-program-page/blob/main/docs/DECISIONS.md) —
  every deviation from the original, with reasons
- [Live replica](https://nikitaboyarkin.github.io/mm-program-page/) — opens with no install
