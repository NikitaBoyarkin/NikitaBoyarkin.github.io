---
title: Python Analytics Playground
description: "A module-based Python analytics toolkit — loading, cleaning, EDA, visualization — assembled into one pipeline with ≥80% pytest coverage. The base I copy into every new analysis."
track: analytics
hero: images/python.svg
impact:
  - Modular load / clean / EDA / viz / pipeline modules with pytest coverage ≥80%
  - Single end-to-end pipeline runnable as `python -m python_analytics`
  - Requirements traced to a PRD (REQ-002 … REQ-006), tests tied to requirements
  - uv + ruff tooling, synthetic data for demo runs
tools:
  - Python
  - pandas / NumPy
  - Matplotlib
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/python
updated: 2026-09-03
date: 2026-09-03
related:
  - /posts/eda-python-template/
  - /posts/reproducible-data-pipelines/
---

# Python Analytics Playground

## Goal

In product analytics, most tasks start the same way: load an export, clean it, look at distributions and correlations, show charts. This project turns that routine into reusable modules — so every new analysis starts not from scratch, but from a tested foundation you can hand to teammates and extend without fear of breaking it.

## Data & Method

**Package layout** (`src/python_analytics/`):

- **`load.py`** (REQ-002) — CSV loading into a DataFrame with basic checks.
- **`clean.py`** (REQ-003) — missing values, duplicates, type coercion.
- **`eda.py`** (REQ-004) — descriptive stats, missingness, correlations.
- **`viz.py`** (REQ-005) — histograms, correlation heatmaps.
- **`pipeline.py`** (REQ-006) — end-to-end pipeline runnable as `python -m python_analytics`.

Each module covers a single requirement from the PRD (`docs/prd.md`), and the tests in `tests/` check exactly those requirements — coverage ≥80%.

### Run

```bash
uv sync --all-groups
uv run pytest                          # tests + coverage (≥80%)
uv run python -m python_analytics      # end-to-end pipeline
```

## Result

The key difference from one-off analysis scripts is structure and testability: modules are small and single-purpose, requirements are documented in a PRD, and tests keep coverage ≥80%. You can extend the tool and not fear breaking existing behavior.

## Limitations

The pipeline targets tabular CSVs and a basic EDA set — it is not a framework for arbitrary pipelines. The ≥80% coverage applies to the package modules, not to user analyses built on top of them.

## Documentation

- [GitHub → python](https://github.com/NikitaBoyarkin/python)
