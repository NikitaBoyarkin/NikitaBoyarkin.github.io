---
title: "Volta — Premium Upsell"
description: "Free→Premium conversion concentrates in the anchor (17.3%) and status-seekers (41.2%); Digital Newcomers 45+ convert just 1.8% — the value prop doesn't transfer."
part: premium-upsell
order: 15
layer: market-jobs
impact:
  - "Premium Status 41.2%, anchor 17.3%"
  - "Digital Newcomers 45+ 1.8% (z=34, p<0.001)"
  - "The gap persists within cohorts"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "premium-upsell-by-segment"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Premium Upsell

## Context

The second Market & Jobs project: does the upsell found in the anchor transfer to new segments.

## Data & Method

- Free→Premium conversion by JTBD segment and cohort.
- Chi² + z-test (anchor vs gap), driver importance (logistic regression).
- Offer-channel effect and top upgrade reason by segment.

## Findings

- Conversion concentrates: **Premium Status 41.2%**, anchor **17.3%** vs **Digital Newcomers 45+ 1.8%** (z=34, p<0.001).
- The gap persists within every cohort (Power 26% vs Dormant 2%).
- Converters upgrade for different reasons — one upsell doesn't fit all.

## Recommendations

- Introduce segment offers: cashback for families, support for 45+, FX features for travelers.
- Don't expect parity with the anchor — plan for a residual gap.
- Test segment offers in an A/B (Project 20).

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
