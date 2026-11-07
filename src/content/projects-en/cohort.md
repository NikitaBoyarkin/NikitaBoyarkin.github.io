---
title: Cohort Analysis Dashboard
description: "Python inside Tableau: 4 cohort calculations on a TabPy server and 65 tests; a triangular retention matrix with per-cohort ARPU and LTV, an observation-age caveat and a CSV + Hyper export."
star:
  situation: "Cohort retention and LTV on synthetic data: average retention hides the per-cohort dynamics"
  task: "Make retention and LTV readable per acquisition cohort rather than as a single average"
  action: "Retention matrix, ARPU and LTV by cohort, observation-age caveat, Tableau export (CSV + Hyper)"
  result: "Python inside Tableau: 4 cohort calculations on a TabPy server and 65 tests; the cohort matrix replaces average retention and shows churn speed and where monetization diverges"
track: analytics
hero: images/cohort.svg
ogImage: /images/og/cohort.png
impact:
  - Cohort retention matrix with triangular decay
  - ARPU / LTV by cohort with proper observation-age caveat
  - Tableau-ready export (CSV + .hyper extract)
  - "TabPy layer: 4 calculations executed by a Python server on localhost:9004, deployed by tabpy/deploy.py (6 endpoints) — Python runs inside Tableau"
  - "65 tests: 26 tabpy + 16 real_data + 14 cohort_analysis + 9 tableau_export"
tools:
  - Python
  - pandas
  - matplotlib / seaborn
  - Jupyter Notebook
  - Tableau (Hyper API)
github: https://github.com/NikitaBoyarkin/tableau_cohort_analysis
date: 2026-07-12
updated: 2026-11-01
demo: demos/cohort/index.html
related:
  - /posts/cohort-retention-guide/
faq:
  - question: "Why is average retention not enough?"
    answer: "Average retention smooths the dynamics: cohorts churn at different speeds, and that spread disappears inside a single averaged curve."
  - question: "What does the cohort matrix show?"
    answer: "Triangular retention decay per cohort: churn speed broken out by each cohort's age rather than one blended curve."
  - question: "Why does ARPU/LTV need an observation-age caveat?"
    answer: "Older cohorts have been observed longer, so their ARPU and LTV sit higher for free; without the caveat the comparison across cohorts is biased."
  - question: "How does the result reach Tableau?"
    answer: "As a CSV and a .hyper extract export; the pipeline reproduces from a fixed seed=42."
---

# Cohort Analysis Dashboard

**▶ [Data-flow diagram](/diagrams/tableau-cohort-analysis.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

Cohort retention and LTV analysis on synthetic data: user retention, churn curves, and revenue by acquisition cohort. Average retention hides the dynamics, and LTV without accounting for cohort age misleads — so the matrix carries the observation-age caveat and the comparable metric is the fixed-horizon LTV (`ltv_at_k`).

The task is to build a matrix that shows where churn speed is higher and where monetization drops faster than retention. A Python pipeline (pandas + matplotlib/seaborn) plus a Tableau-ready export; data is synthetic and deterministic (seed=42), reproduced from code.

## Task

I needed retention and lifetime value to be readable per acquisition cohort rather than as a single average, so I owned the pipeline that turns synthetic data into a retention and revenue matrix ready for Tableau.

## Actions

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

**Real data:** `real_data.py` accepts a CSV on the same "user × month" contract — fail-fast validation (required columns, types, duplicates, period-0 coverage), with PII (email, phone, name) dropped by whitelist.

**Tableau export** (`tableau_export.py`) creates in `tableau/`:
- `cohort_export.csv` — flat shape for Tableau (adds `cohort_label` and `period_date` — the calendar observation month);
- `cohort_extract.hyper` — a Tableau Hyper extract via the official Hyper API.

**Tableau heatmap:** Columns = `period`, Rows = `cohort_label`, Marks = Square, Color = AVG(`is_active`), Text = `% of Total` per row.

## Result

The cohort view matters more than average retention: it exposes churn speed and where monetization diverges from it. The key methodological choices — `cohort_month` is derived from `join_date` (not a separate random field), period 0 = 100% by convention, and NaNs are masked in the heatmap instead of rendering `nan%`.

- **Python inside Tableau:** 4 calculations are deployed to a TabPy server (localhost:9004) by `tabpy/deploy.py` — 6 endpoints, with Python executed inside Tableau.
- **Tests:** 65 (26 tabpy + 16 real_data + 14 cohort_analysis + 9 tableau_export) keep the pipeline reproducible.

## What I learned

A cohort analysis answers a different question than "what is the product's retention": it answers "which cohort behaves worse, and at what age". The unit of decision changes — a single average gives way to the age dimension, and "is this normal?" becomes "compared to whom". An averaged curve welds cohorts of different ages into one line and hides exactly the divergence the analysis exists to expose.

The second lesson is about the comparability conditions built into the metric. ARPU and LTV grow with observation time, so younger cohorts look worse because their history is short, not because they behave worse. A metric that encodes tenure ranks cohorts by how long you have watched them; to measure the product it needs a fixed horizon.

## Discussion points

- **Why a matrix, not a single retention curve.** One curve is an average over cohorts of different ages; the matrix keeps the age dimension the average erases.
- **Why the zero period is full by definition.** Everyone is active in the join month, so it carries no information about churn and cannot be used to compare cohorts.
- **Why LTV is compared only at an equal horizon.** Without equal observation age, cohorts are ranked by exposure time, not by behaviour.
- **What I would do differently.** Make LTV at a fixed horizon the headline and treat cumulative LTV as a diagnostic, not a basis for ranking.

## Limitations

LTV of younger cohorts is understated due to short history — compare LTV correctly only at equal cohort "age." The data is synthetic, so the numbers illustrate the method, not the behavior of a real product.

## Documentation

- [GitHub → tableau_cohort_analysis](https://github.com/NikitaBoyarkin/tableau_cohort_analysis)
