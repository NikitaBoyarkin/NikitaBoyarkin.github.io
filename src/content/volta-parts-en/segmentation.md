---
title: "Volta — User Segmentation"
description: "KMeans with data-driven K=4: Power 12% drive 41% of revenue, 68% drive 92%. Cross-segment migration is worth up to +€310K/yr."
part: segmentation
order: 4
impact:
  - "K=4 chosen from data (elbow + silhouette)"
  - "12% of users → 41% of revenue; 68% → 92%"
  - "Cross-segment migration: up to +€310K/yr"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "segmentation-size-vs-revenue"
  - "segmentation-pareto-cumulative"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — User Segmentation

## Context

The effect held — the remaining question was who these users are and how to monetize them.

## Data & Method

- StandardScaler + KMeans, K from data (marginal-gain elbow, silhouette validation).
- PCA projection and per-cluster silhouette.
- Lorenz concentration and cross-segment migration scenarios.

## Findings

- **K=4**: Power 12% / Growth 24% / Casual 32% / Dormant 32% (sizes derived from data).
- **Power** drive **41%** of revenue on 12% of users; **68%** → **92%**.
- Dormant (32%) still drives **7.8%** — win-back has potential.
- Migration scenarios: **+€26K/mo (€310K/yr)**.

## Recommendations

- Defend Power, upgrade Growth/Casual, win back Dormant.
- Build strategy on probabilities, not hard labels (boundaries are soft).
- Validate the strategy with the 4 recommended A/B tests.

## Visualization

![Segment PCA projection](/images/volta/segmentation_pca_scatter.png)

*K=4 segments in PCA projection.*

![K selection](/images/volta/segmentation_k_selection.png)

*Data-driven K selection: elbow and silhouette (plateau K=2–4, collapse at K=5).*

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
