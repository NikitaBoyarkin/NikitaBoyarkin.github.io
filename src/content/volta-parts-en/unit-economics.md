---
title: "Volta — Traveler Unit Economics"
description: "Travelers lose €0.45 per €100 FX transaction; break-even needs FX cost cut from 1.00% to 0.55%, otherwise the loss grows with volume."
part: unit-economics
order: 14
layer: market-jobs
impact:
  - "Margin −€0.45 per €100 FX"
  - "Break-even: FX cost 1.00% → 0.55%"
  - "The loss grows linearly with volume"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "traveler-fx-break-even"
  - "traveler-fx-sensitivity"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Traveler Unit Economics

## Situation

The traveler segment promises a 'fair rate' — we test whether it survives economically.

## Task

I needed to know whether the traveler segment's promise of a fair rate survives economically, so I owned the unit economics behind it.

## Actions

- Revenue/cost/margin per transaction by segment.
- FX break-even (cost vs spread), one-at-a-time sensitivity.
- Scale projection to SOM.

## Result

- Net margin is **−€0.45** per €100 FX transaction — a loss on every transaction.
- Break-even requires FX cost **1.00% → 0.55%**.
- Raising the spread **0.40% → 0.85%** is possible but breaks the fair-rate promise.

## Recommendations

- Don't scale travel until the unit economics are fixed.
- Negotiate interbank rates, hedge, introduce a paid travel tier.
- Test on 10% of the segment, not the whole volume.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
