---
title: "Volta — JTBD × Cohorts"
description: "Job segments and behavioral cohorts are not independent (chi² p<0.001): Dormant concentrates in Digital Newcomers 45+ (39.4%) vs Family Budgeters (15.1%)."
part: jtbd
order: 13
layer: market-jobs
impact:
  - "chi² p<0.001: job segments ≠ cohorts"
  - "Dormant 39.4% among 45+ vs 15.1% among families"
  - "Dormancy is driven by UX friction, not 'no job'"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "jtbd-cohort-heatmap"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — JTBD × Cohorts

## Context

The first Market & Jobs project: do job segments (JTBD) match the behavioral cohorts from segmentation.

## Data & Method

- Cross-table JTBD segment × cohort.
- Chi-square for independence, two-proportion z-test for Dormant.
- UX-friction contrast (support tickets, KYC duration).

## Findings

- Chi-square: JTBD segment × cohort are **NOT independent (p<0.001)**.
- **Dormant 39.4%** among Digital Newcomers 45+ vs **15.1%** among Family Budgeters (z-test significant).
- Dormant 45+ show more UX friction → dormancy is driven by UX, not a missing job.

## Recommendations

- The retention lever is assisted onboarding and UX simplification, not accepting churn.
- Don't scale one playbook across all job segments.
- Test the assisted-recovery hypothesis (Project 22).

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
