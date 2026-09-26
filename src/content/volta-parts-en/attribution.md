---
title: "Volta — Marketing Attribution"
description: "First-touch, last-touch, linear and Shapley attribution. Shapley (data-driven) reallocates budget and leads with referral; the conclusion is robust to model choice."
part: attribution
order: 8
layer: extended
impact:
  - "4 attribution models, incl. Shapley"
  - "Shapley: referral €264K vs display €125K"
  - "Referral leads in all four models"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "attribution-models"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Marketing Attribution

## Situation

Different attribution models give different answers about which channel 'brings' revenue — we compare them on the same data.

## Task

I needed to settle which channel can be credited with revenue, so I owned the side-by-side run of the competing attribution models on one dataset.

## Actions

- Journey dataset (touch_order × channel × revenue).
- First-touch, last-touch, linear and Shapley attribution.

## Result

- Referral leads in all four models (**€218–264K**).
- Shapley reallocates: referral rises to **€263.7K**, display falls to **€125.0K** vs ~€180K under the heuristics.
- Heuristics understate upper funnels and overstate the last click.

## Recommendations

- Reallocate budget per Shapley, not last-touch.
- Protect referral as the leading channel.
- Don't make channel decisions on a single attribution model.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
