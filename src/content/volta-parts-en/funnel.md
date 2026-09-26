---
title: "Volta — Funnel Analysis"
description: "The neobank onboarding funnel: KYC is the bottleneck at 56.6% step conversion, registration loses the most in absolute terms (2,682). Broken down by channel and platform."
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
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Funnel Analysis

## Situation

The first project in the **discover** loop: find where the fictional neobank «Volta» loses users in onboarding. Data is synthetic, seeded generator → reproducible CSV.

## Task

My job was to open the discover loop by locating exactly where onboarding loses users, working on a synthetic dataset built for reproducible runs.

## Actions

- Step conversion and absolute/relative drop-off at each funnel step (Install → Registration → KYC → Card → First TX).
- Chi-square test for acquisition-channel differences.
- Platform (iOS vs Android) and channel (referral vs paid social) comparison at each step.

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

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
