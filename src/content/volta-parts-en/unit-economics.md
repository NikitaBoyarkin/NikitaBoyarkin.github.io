---
title: "Volta — Traveler Unit Economics"
description: "Travelers lose €0.45 per €100 FX transaction; break-even needs FX cost cut from 1.00% to 0.55%, otherwise the loss grows with volume."
star:
  situation: "The traveler segment promises a 'fair rate' — I test whether it survives economically"
  task: "Find out whether the traveler segment's fair-rate promise survives economically and give an assessment, not take it on faith"
  action: "Revenue, cost and margin per transaction by segment, FX break-even against spread, one-at-a-time sensitivity, SOM projection"
  result: "Net margin −€0.45 per €100 FX; break-even needs FX cost cut 1.00% → 0.55%"
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
github: https://github.com/NikitaBoyarkin/case-unit-economics
---

# Volta — Traveler Unit Economics

## Situation

The traveler segment promises a 'fair rate' — we test whether it survives economically.

## Task

I owned giving the traveler segment a calculation, not an opinion: where the economics lose money and what has to change for it to break even. The question could not be closed with a vague 'it's profitable'.

## Actions

I built the economics per source of revenue and cost on a transaction, not on an average, to see exactly where the segment loses money. I then tested the condition under which it breaks even.

**Data preparation.** I collected per transaction the revenue from spread and fees and the cost of the interbank rate, processing and support, and folded them into a contribution margin. I attached the segment volume separately so the result can scale to different levels.

**Break-even model.** I built the break-even point on the key parameter — the cost of an FX transaction: I solved for the level at which margin turns to zero. That turns the question from 'worth it or not' into a concrete condition.

**Sensitivity.** I ran a one-parameter-at-a-time sensitivity on the spread, the interbank rate and the repeat-transaction share. That shows which lever moves the result most and which barely matters.

**Scale.** I projected margin onto the target market volume and checked how the loss behaves as volume grows: linearly or with saturation. That decides whether volume alone can fix the economics.

**Validation.** I reconciled revenue and cost totals against the source extracts and recomputed margin a second way. I kept the scenario assumptions explicit so the decision does not rest on hidden estimates.

## Result

- Net margin is **−€0.45** per €100 FX transaction — a loss on every transaction.
- Break-even requires FX cost **1.00% → 0.55%**.
- Raising the spread **0.40% → 0.85%** is possible but breaks the fair-rate promise.

## Recommendations

- Don't scale travel until the unit economics are fixed.
- Negotiate interbank rates, hedge, introduce a paid travel tier.
- Test on 10% of the segment, not the whole volume.

## Documentation

- [GitHub → case-unit-economics](https://github.com/NikitaBoyarkin/case-unit-economics)
