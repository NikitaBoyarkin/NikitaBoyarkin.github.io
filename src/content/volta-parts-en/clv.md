---
title: "Volta — CLV Modeling"
description: "Three lifetime-value methods: historical, retention-curve and Gamma-Gamma. The order Power > Growth > Casual > Dormant is robust across all methods."
star:
  situation: "To set CAC ceilings and retention priorities we need an estimate of future value, not just past revenue"
  task: "Own a forward-looking value estimate rather than a backward-looking revenue total to set CAC ceilings and retention priorities"
  action: "Historical CLV from actuals, a retention curve with a power fit, and probabilistic Gamma-Gamma"
  result: "Power > Growth > Casual > Dormant holds across all three methods; Gamma-Gamma Power €5,166 vs Dormant €27.7 — a ~187× gap"
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
github: https://github.com/NikitaBoyarkin/case-clv
---

# Volta — CLV Modeling

## Situation

To set CAC ceilings and retention priorities we need an estimate of future value, not just past revenue.

## Task

I owned the basis for CAC ceilings and retention priorities: comparing several ways to value a customer's future and showing which one survives scrutiny. The decision could not rest on past revenue.

## Actions

I valued customers three independent ways so the conclusion would not hang on a single method. Each method is stricter than the last — from actuals, to a retention curve, to a probabilistic model.

**Data preparation.** I split each customer's revenue into frequency and average order value, put amounts into one currency, and matched them to lifetime. I removed one-off and anomalous transactions, and split active customers by their existing segments so value is computed within each segment.

**Historical CLV.** The first method is the direct sum of actual revenue over the observed window. It is honest but systematically low: it only sees customers who already reached the end of the window and cannot see future purchases.

**Retention curve.** The second method is a power-law retention curve fitted across cohorts. It extends the observed lifetime and builds the expected revenue over the horizon, so it yields a forecast rather than a fact.

**Probabilistic model.** The third method is Gamma-Gamma over a frequency–monetary model: it estimates future value through a probability distribution over frequency and average order value. It is the most data-hungry estimate and I used it as the upper benchmark.

**Validation.** I compared the segment ordering across all methods: a stable ranking is the key test here. I then checked that the predictive methods run above the historical one, and by how much, so future value is not overstated.

## Result

- The order **Power > Growth > Casual > Dormant** is robust across all three methods.
- Gamma-Gamma: **Power €5,166** vs **Dormant €27.7** — a ~187× gap.
- Predictive methods run **2.9–5.9×** above historical.

## Recommendations

- Use predictive CLV as the per-segment CAC ceiling.
- Prioritize retention of Power/Growth (largest value at risk).
- Don't rely on historical CLV for forward-looking decisions.

## Documentation

- [GitHub → case-clv](https://github.com/NikitaBoyarkin/case-clv)
