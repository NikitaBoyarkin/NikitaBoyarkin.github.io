---
title: "Volta — Premium Upsell"
description: "Free→Premium conversion concentrates in the anchor (17.3%) and status-seekers (41.2%); Digital Newcomers 45+ convert just 1.8% — the value prop doesn't transfer."
star:
  situation: "Second Market & Jobs project: does the upsell found in the anchor carry over to new segments"
  task: "Own the assessment of whether the upsell transfers and an honest boundary for where it holds"
  action: "Free→Premium conversion by JTBD segment and cohort, chi-square and z-test, upgrade drivers, offer-channel effect"
  result: "Premium Status 41.2%, anchor 17.3% vs Digital Newcomers 45+ 1.8% (z=34, p<0.001)"
part: premium-upsell
order: 15
layer: market-jobs
impact:
  - "Premium Status 41.2%, anchor 17.3%"
  - "Digital Newcomers 45+ 1.8% (z=34, p<0.001)"
  - "The gap persists within cohorts"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "premium-upsell-by-segment"
github: https://github.com/NikitaBoyarkin/case-premium-upsell
---

# Volta — Premium Upsell

## Situation

The second Market & Jobs project: does the upsell found in the anchor transfer to new segments.

## Task

I owned the assessment of whether the upsell transfers and an honest boundary for where the finding holds.

## Actions

I tested the upsell across JTBD segments rather than on the base average, to see where the mechanic works and where it breaks.

- **Conversion cut.** Computed Free→Premium conversion per JTBD segment and within cohorts, to separate a segment effect from a timing effect.
- **Difference test.** Compared the anchor with the gap segments using a chi-square and a z-test, not raw conversion levels.
- **Drivers.** Estimated the importance of upgrade reasons with logistic regression, to see what each segment actually pays for.
- **Offer channel.** Checked how the channel that shows the offer affects conversion.
- **Boundaries.** Stated explicitly that the transferability claim is bounded and cannot be generalised to every segment.
- **Tooling.** Python and pandas/NumPy for the cuts, SciPy/Statsmodels for the tests, scikit-learn for the logistic regression, Matplotlib/Seaborn for the charts.

## Result

- Conversion concentrates: **Premium Status 41.2%**, anchor **17.3%** vs **Digital Newcomers 45+ 1.8%** (z=34, p<0.001).
- The gap persists within every cohort (Power 26% vs Dormant 2%).
- Converters upgrade for different reasons — one upsell doesn't fit all.

## Recommendations

- Introduce segment offers: cashback for families, support for 45+, FX features for travelers.
- Don't expect parity with the anchor — plan for a residual gap.
- Test segment offers in an A/B (Project 20).

## Documentation

- [GitHub → case-premium-upsell](https://github.com/NikitaBoyarkin/case-premium-upsell)
