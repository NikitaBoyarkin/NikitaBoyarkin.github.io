---
title: "Volta — CLV Modeling"
description: "Three lifetime-value methods: historical, retention-curve and Gamma-Gamma. The order Power > Growth > Casual > Dormant is robust across all methods."
part: clv
order: 7
layer: extended
impact:
  - "3 methods: historical / retention-curve / Gamma-Gamma"
  - "Robustly Power > Growth > Casual > Dormant"
  - "Power Gamma-Gamma €5,166 vs Dormant €27.7"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "clv-by-method"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — CLV Modeling

## Context

To set CAC ceilings and retention priorities we need an estimate of future value, not just past revenue.

## Data & Method

- Historical CLV (actuals), retention-curve (power-fit), probabilistic Gamma-Gamma.

## Findings

- The order **Power > Growth > Casual > Dormant** is robust across all three methods.
- Gamma-Gamma: **Power €5,166** vs **Dormant €27.7** — a ~187× gap.
- Predictive methods run **2.9–5.9×** above historical.

## Recommendations

- Use predictive CLV as the per-segment CAC ceiling.
- Prioritize retention of Power/Growth (largest value at risk).
- Don't rely on historical CLV for forward-looking decisions.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
