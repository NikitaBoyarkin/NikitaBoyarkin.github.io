---
title: "Volta — RFM Analysis"
description: "R/F/M scoring 1–5 splits the base into lifecycle segments from Champions to Lost; recency and monetary diverge — 'frequent but cheap' and 'rare but large'."
part: rfm
order: 6
impact:
  - "7 lifecycle segments (Champions→Lost)"
  - "Champions — 23.9% of the base with high R/F/M"
  - "Different profiles need different campaigns"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "rfm-heatmap"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — RFM Analysis

## Context

We need a simple, interpretable customer-value layer complementing cluster segmentation.

## Data & Method

- R/F/M quintile scoring → lifecycle tiers.
- Heatmap of mean R/F/M by segment.

## Findings

- R/F/M scoring splits the base into lifecycle segments from **Champions** to **Lost**.
- **Champions (23.9%)** hold all three axes high (R 91, F 93, M 93); **New** has high R (100) but low F/M (~30–35).
- **At Risk (11.5%)** and **Lost (23.2%)** are a large reactivation reserve.

## Recommendations

- Champions/Loyal — upsell and defend; At Risk/Lost — reactivate.
- Don't apply one offer to all RFM profiles.
- Tie RFM tiers to the win-back economics (Project 22).

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
