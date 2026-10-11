---
title: "Volta — User Segmentation"
description: "KMeans with data-driven K=4: Power 12% drive 41% of revenue, 68% drive 92%. Cross-segment migration is worth up to +€310K/yr."
star:
  situation: "The effect held — the remaining question was who these users are and how to monetize them"
  task: "Own the base segmentation and the rule that the number of clusters comes from the data, not convenience"
  action: "StandardScaler + KMeans, K chosen from data (marginal-gain elbow, silhouette), PCA projection, migration scenarios"
  result: "K=4 (Power 12% / Growth 24% / Casual 32% / Dormant 32%); Power drive 41% of revenue, 68% → 92%; migration +€310K/yr"
part: segmentation
order: 4
layer: core
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
  - "segmentation-pca-scatter"
  - "segmentation-k-selection"
github: https://github.com/NikitaBoyarkin/case-segmentation
---

# Volta — User Segmentation

## Situation

The effect held — the remaining question was who these users are and how to monetize them.

## Task

I owned the base segmentation and the rule that the number of clusters had to come from the data, not from convenience.

## Actions

I built the segmentation so that the number of groups and their boundaries came from the data, not from a scheme chosen in advance.

- **Features.** Assembled behavioural features per user (frequency and volume of operations, activity, product) and put them on a common scale with StandardScaler, so a high-magnitude feature would not outweigh the rest.
- **Choosing K.** Ran KMeans across a range of solutions and picked the number of clusters from a marginal-gain elbow and the silhouette score — in code, not by eye.
- **Stability.** Checked that the segments do not fall apart when the seed changes, and read the inertia and silhouette curves.
- **Projection.** Built a PCA projection to see the segment separation and confirm the clusters are not overlapping.
- **Value.** Compared each segment's size with its share of revenue and computed the Lorenz concentration.
- **Scenarios.** Estimated user migration between segments as separate scenarios, not one aggregate.
- **Tooling.** Python and pandas/NumPy, scikit-learn for KMeans and PCA, Matplotlib/Seaborn for the charts; runs through uv + ruff.

## Result

- **K=4**: Power 12% / Growth 24% / Casual 32% / Dormant 32% (sizes derived from data).
- **Power** drive **41%** of revenue on 12% of users; **68%** → **92%**.
- Dormant (32%) still drives **7.8%** — win-back has potential.
- Migration scenarios: **+€26K/mo (€310K/yr)**.

## Recommendations

- Defend Power, upgrade Growth/Casual, win back Dormant.
- Build strategy on probabilities, not hard labels (boundaries are soft).
- Validate the strategy with the 4 recommended A/B tests.

## Documentation

- [GitHub → case-segmentation](https://github.com/NikitaBoyarkin/case-segmentation)
