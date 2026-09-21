---
title: Cohort Analysis Dashboard
description: "A triangular cohort retention and LTV matrix on synthetic data: per-cohort ARPU and LTV with an observation-age caveat, plus a Tableau-ready CSV and Hyper export."
track: analytics
hero: images/cohort.svg
impact:
  - Cohort retention matrix with triangular decay
  - ARPU / LTV by cohort with proper observation-age caveat
  - Tableau-ready export (CSV + .hyper extract)
  - Reproducible seeded pipeline (seed=42)
tools:
  - Python
  - pandas
  - matplotlib / seaborn
  - Jupyter Notebook
  - Tableau (Hyper API)
github: https://github.com/NikitaBoyarkin/tableau_cohort_analysis
updated: 2026-09-04
demo: demos/cohort/index.html
related:
  - /posts/cohort-retention-guide/
---

# Cohort Analysis Dashboard

## Goal

Cohort retention and LTV analysis on synthetic data: user retention, churn curves, and revenue by acquisition cohort. Average retention hides the dynamics, and LTV without an observation-age correction misleads. The task is to build a matrix that shows where churn speed is higher and where monetization drops faster than retention. A Python pipeline (pandas + matplotlib/seaborn) plus a Tableau-ready export; data is synthetic and deterministic (seed=42), reproduced from code.

## Data & Method

**Data model** — one row = "user × observation month":

| Field | Type | Description |
|---|---|---|
| `user_id` | int | user identifier |
| `cohort_month` | date | arrival month (derived from `join_date`, not a separate field) |
| `join_date` | date | registration date (first of month) |
| `period` | int | months since arrival (0 = registration month) |
| `is_active` | int 0/1 | active in this month |
| `revenue` | int | revenue for the month (0 if inactive) |

`cohort_month` is derived from `join_date`, as in real production. Younger cohorts have fewer observed months — the retention matrix is triangular.

**Methodology:**

- **Period 0 = 100% retention** by definition (all active in arrival month). The curve decays from period 1: `retention(p) = 0.85 · 0.75^(p-1)`.
- **Revenue:** active month → `Poisson(λ=10)`; inactive → 0.
- **Cohort sizes** — count of unique `user_id` where `period == 0`.
- **ARPU** — average revenue per cohort user; **LTV** — cumulative ARPU over periods.

**Functions:** `cohort_sizes()` (monthly inflow), `retention_matrix()` (matrix + curves), `revenue_by_cohort()` (ARPU/LTV).

**Tableau export** (`tableau_export.py`) creates in `tableau/`:
- `cohort_export.csv` — flat shape for Tableau (adds `cohort_label` and `period_date` — the calendar observation month);
- `cohort_extract.hyper` — a Tableau Hyper extract via the official Hyper API.

**Tableau heatmap:** Columns = `period`, Rows = `cohort_label`, Marks = Square, Color = AVG(`is_active`), Text = `% of Total` per row.

## Result

The cohort view matters more than average retention: it exposes churn speed and where monetization diverges from it. The key methodological choices — `cohort_month` is derived from `join_date` (not a separate random field), period 0 = 100% by convention, and NaNs are masked in the heatmap instead of rendering `nan%`.

## Limitations

LTV of younger cohorts is understated due to short history — compare LTV correctly only at equal cohort "age." The data is synthetic, so the numbers illustrate the method, not the behavior of a real product.

## Documentation

- [GitHub → tableau_cohort_analysis](https://github.com/NikitaBoyarkin/tableau_cohort_analysis)
