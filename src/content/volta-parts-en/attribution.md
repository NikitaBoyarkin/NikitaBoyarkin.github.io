---
title: "Volta — Marketing Attribution"
description: "First-touch, last-touch, linear and Shapley attribution. Shapley (data-driven) reallocates budget and leads with referral; the conclusion is robust to model choice."
star:
  situation: "Different attribution models disagree about which channel brings revenue — the comparison runs on one dataset"
  task: "Own the side-by-side run of competing attribution models to see how much the credited channel depends on model choice"
  action: "Journey dataset (touch_order × channel × revenue), first-touch, last-touch, linear and Shapley attribution"
  result: "Referral leads in all four models (€218–264K); Shapley takes referral to €263.7K and drops display to €125.0K"
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
github: https://github.com/NikitaBoyarkin/case-attribution
---

# Volta — Marketing Attribution

## Situation

Different attribution models give different answers about which channel 'brings' revenue — we compare them on the same data.

## Task

I owned giving marketing a budget basis that survives the choice of model: showing where the models agree, where they diverge, and why. The decision had to rest on more than one convenient model.

## Actions

I started by turning the customer path into one ordered sequence of touches, and only then credited channels against it. The point is to compare models on the same touch log, not on different exports.

**Data preparation.** I built a touch log where each event carries an order, a channel and attributed revenue, collapsed duplicates, and mapped channels onto one reference list. I checked that every conversion has at least one touch and labelled the path as a step sequence.

**Model implementation.** I implemented the heuristic models — first-touch, last-touch and linear — as simple credit rules, and computed Shapley attribution as a channel's contribution in a cooperative game over all touch orders. Every model received the same input, so the differences reflect the method, not the data.

**Comparison.** I put the results into one channel-by-model table and looked at whether the leader changes and how budget shifts between the top and bottom of the funnel. I noted which models understate upper channels and overstate the last click.

**Validation.** I checked that credited revenue across channels sums to the total, and that Shapley keeps the additive property of the linear model. I then tested the conclusion: the leader stays the leader under every model.

## Result

- Referral leads in all four models (**€218–264K**).
- Shapley reallocates: referral rises to **€263.7K**, display falls to **€125.0K** vs ~€180K under the heuristics.
- Heuristics understate upper funnels and overstate the last click.

## Recommendations

- Reallocate budget per Shapley, not last-touch.
- Protect referral as the leading channel.
- Don't make channel decisions on a single attribution model.

## Documentation

- [GitHub → case-attribution](https://github.com/NikitaBoyarkin/case-attribution)
