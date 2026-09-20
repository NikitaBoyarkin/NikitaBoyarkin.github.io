---
title: "Volta — Support & Churn"
description: "Churn rises with ticket count: 37.1% at zero contacts vs 81.1% at 3+. Support is a measurable retention lever, not just a cost center."
part: support-churn
order: 11
layer: extended
impact:
  - "Churn 37.1% (0 tickets) → 81.1% (3+)"
  - "Unresolved tickets amplify churn"
  - "CSAT bands barely discriminate churn"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "cs-churn-by-tickets"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Support & Churn

## Context

We test whether a bad support experience drives churn and whether it can be influenced.

## Data & Method

- Ticket–churn merge per user.
- Churn by ticket count, by unresolved, by CSAT band.

## Findings

- Churn rises with ticket count: **37.1%** (0) → **46.3%** (1) → **65.2%** (2) → **81.1%** (3+).
- Users with 3+ tickets churn **2.2×** more than the base.
- CSAT bands barely discriminate churn (52–55%) — a weak signal.

## Recommendations

- Cut ticket volume via self-serve and clearer errors.
- Resolve unresolved tickets faster — they amplify churn.
- Don't rely on CSAT as a retention predictor.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
