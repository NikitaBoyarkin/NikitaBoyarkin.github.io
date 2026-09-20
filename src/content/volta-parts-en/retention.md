---
title: "Volta — Retention & Cohorts"
description: "Cohort triangles showed a step-change after the KYC fix: M1 +11.8pp, M3 +9.2pp and +€227K/yr LTV. Premium LTV is 4.3× Free."
part: retention
order: 3
impact:
  - "M1 retention +11.8pp step-change"
  - "M3 retention +9.2pp"
  - "+€227K/yr incremental LTV; Premium LTV 4.3× Free"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "cohort-retention-heatmap"
  - "retention-pre-post"
  - "retention-free-vs-premium"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Retention & Cohorts

## Context

Shipping is not the end: the KYC-fix effect was checked on retention with cohort triangles (signup month × age) instead of 'the average across everyone'.

## Data & Method

- Cohort curves and an M0–M11 retention matrix.
- Pre/post Welch t-test + Cohen's d, bootstrap CIs at M1/M3/M6.
- Plan-specific LTV decomposed into ARPU × retention.

## Findings

- Step-change: post-fix cohorts (2024-09+) hold M1 ≈ **61–67%** vs **51–53%** pre-fix.
- **M3 +9.2pp**; the effect does not fade — the gap persists at M6.
- **Premium LTV = 4.3× Free** (ARPU 2.66× × retention 1.62×).
- Portfolio effect: **+€227K/yr** incremental LTV.

## Recommendations

- Target upgrades at high-intent Free users in the first 1–2 months — the biggest lever.
- Monitor cohort decay, not just average retention.
- Read the last diagonal cells with care (few observation periods).

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
