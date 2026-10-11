---
title: "Volta — RFM Analysis"
description: "R/F/M scoring 1–5 splits the base into lifecycle segments from Champions to Lost; recency and monetary diverge — 'frequent but cheap' and 'rare but large'."
star:
  situation: "Needed a simple, interpretable customer-value layer to complement cluster segmentation"
  task: "Own the interpretability of the layer and its consistency with the segmentation already in place"
  action: "R/F/M quintile scoring → lifecycle tiers, plus a heatmap of mean R/F/M by segment"
  result: "Champions — 23.9% of the base with all three axes high (91/93/93); At Risk 11.5% and Lost 23.2% are a large reactivation reserve"
part: rfm
order: 6
layer: extended
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
github: https://github.com/NikitaBoyarkin/case-rfm
---

# Volta — RFM Analysis

## Situation

We need a simple, interpretable customer-value layer complementing cluster segmentation.

## Task

I owned the interpretability of the layer and its consistency with the segmentation already in place.

## Actions

I built the value layer to stay simple and explainable: each axis went onto a readable scale, and the axes then assembled into lifecycle tiers.

- **Scoring.** Gave each axis (recency, frequency, monetary) a quintile score, so the scales are comparable and do not depend on absolute magnitudes.
- **Tiers.** Assembled the three scores into lifecycle segments from Champions to Lost — a profile that reads without extra explanation.
- **Axis divergence.** Checked where recency and monetary diverge, to separate 'frequent but cheap' from 'rare but large'.
- **Visualisation.** Built a heatmap of mean R/F/M by segment — every tier's profile in one picture.
- **Reactivation reserve.** Read the size of the already-lost tiers separately, as an estimate of win-back potential.
- **Tooling.** Python and pandas/NumPy for the scoring, Matplotlib/Seaborn for the heatmap.

## Result

- R/F/M scoring splits the base into lifecycle segments from **Champions** to **Lost**.
- **Champions (23.9%)** hold all three axes high (R 91, F 93, M 93); **New** has high R (100) but low F/M (~30–35).
- **At Risk (11.5%)** and **Lost (23.2%)** are a large reactivation reserve.

## Recommendations

- Champions/Loyal — upsell and defend; At Risk/Lost — reactivate.
- Don't apply one offer to all RFM profiles.
- Tie RFM tiers to the win-back economics (Project 22).

## Documentation

- [GitHub → case-rfm](https://github.com/NikitaBoyarkin/case-rfm)
