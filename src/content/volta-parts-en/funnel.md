---
title: "Volta — Funnel Analysis"
description: "The neobank onboarding funnel: KYC is the bottleneck at 56.6% step conversion, registration loses the most in absolute terms (2,682). Broken down by channel and platform."
star:
  situation: "First project in the discover loop: where «Volta» loses users in onboarding"
  task: "Own the reproducibility of the dataset and the step-by-step measurement of loss, not one aggregate estimate"
  action: "Step conversion and absolute/relative drop-off at every step, chi-square across channels, iOS vs Android"
  result: "KYC — 56.6% step conversion; registration — 2,682 users; 1,269 of 10,000 reach the first transaction"
part: funnel
order: 1
layer: core
impact:
  - "KYC Complete — largest relative drop-off (56.6%)"
  - "Registration — largest absolute loss (2,682, 73.2%)"
  - "Referral +11.7pp over paid social; iOS 13.6% vs Android 11.7%"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "onboarding-funnel"
  - "funnel-waterfall"
  - "funnel-age-heatmap"
  - "channel-end-to-end-conversion"
github: https://github.com/NikitaBoyarkin/case-funnel
---

# Volta — Funnel Analysis

## Situation

The first project in the **discover** loop: find where the fictional neobank «Volta» loses users in onboarding. Data is synthetic, seeded generator → reproducible CSV.

## Task

I owned the reproducibility of the dataset and the step-by-step measurement of loss, rather than one aggregate estimate.

## Actions

I broke the funnel down step by step so the loss is visible at every transition, not just at the end of the path.

- **Data assembly.** Built onboarding events from the seeded generator and shaped them into a 'user × step × status' table, so the steps are comparable to one another.
- **Step metrics.** For every transition I computed step conversion and two kinds of loss: absolute (how many people leave) and relative (what share fails to pass).
- **Breakdowns.** Compared platforms (iOS vs Android) and acquisition channels (referral vs paid social) at each step to see exactly where the trajectories diverge.
- **Difference test.** Checked the channel difference with a chi-square test rather than eyeballing averages.
- **Visualisation.** Built the funnel, a drop-off waterfall and an age heatmap so the bottleneck reads at a glance.
- **Data quality.** Checked that users move through the steps monotonically (nobody can complete KYC without registering) and that there are no duplicates — or the funnel steps would not reconcile.
- **Tooling.** Python and pandas/NumPy for the aggregation, SciPy/Statsmodels for the test, Matplotlib/Seaborn for the charts; the generator is seeded, so a run reproduces exactly.

## Result

- **KYC Complete** — largest relative drop-off: **56.6% step conversion** (2,781 of 4,917).
- **Registration** — largest absolute loss: **2,682 users, 73.2% step conv**.
- **Referral** converts **+11.7pp** better than paid social; **iOS** beats Android (**13.6% vs 11.7%**).
- Only **1,269 of 10,000** reach the first transaction (12.7%) — the funnel loses ~87%.

## Recommendations

- Rework the KYC UX — progress bar (validated in Project 2), real-time photo hints.
- Simplify registration — A/B test on removing the phone field (largest absolute loss).
- Strengthen referral and reallocate 15% of the paid-social budget.
- Run an Android sprint — QA audit to close the gap with iOS.

## Documentation

- [GitHub → case-funnel](https://github.com/NikitaBoyarkin/case-funnel)
