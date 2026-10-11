---
title: "Volta — JTBD × Cohorts"
description: "Job segments and behavioral cohorts are not independent (chi² p<0.001): Dormant concentrates in Digital Newcomers 45+ (39.4%) vs Family Budgeters (15.1%)."
star:
  situation: "The first Market & Jobs project: do job segments (JTBD) match the behavioral cohorts from segmentation"
  task: "Check whether job-to-be-done segments line up with the behavioral cohorts that segmentation produced"
  action: "Cross-table JTBD segment × cohort; chi-square for independence and a two-proportion z-test for Dormant; UX-friction contrast"
  result: "JTBD segment × cohort are NOT independent (p<0.001); Dormant 39.4% among Digital Newcomers 45+ vs 15.1% among Family Budgeters"
part: jtbd
order: 13
layer: market-jobs
impact:
  - "chi² p<0.001: job segments ≠ cohorts"
  - "Dormant 39.4% among 45+ vs 15.1% among families"
  - "Dormancy is driven by UX friction, not 'no job'"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "jtbd-cohort-heatmap"
github: https://github.com/NikitaBoyarkin/case-jtbd
---

# Volta — JTBD × Cohorts

## Situation

The first Market & Jobs project: do job segments (JTBD) match the behavioral cohorts from segmentation.

## Task

I owned testing the hypothesis that two independent cuts of the customer base — by job and by behaviour — describe the same people, and whether one retention decision can rest on both cuts at once.

## Actions

I framed the check as a statistical comparison of two splits rather than a visual one. I first joined both cuts on one key, then tested independence and unpacked the largest deviations.

**Data preparation.** I joined the JTBD job segments to the behavioural cohorts from segmentation on a single user key, dropped users missing a label in either cut, and built a segment-by-cohort cross-table.

**Dependency test.** I tested independence with a chi-square test, which asks whether the observed table filling differs from what independence would predict. I also read the standardized residuals to see which cells drive the dependency.

**Targeted test.** For the largest cell — where the Dormant cohort meets digital newcomers in the older segment — I ran a two-proportion z-test to see whether the Dormant share is significantly above the base rate or just noise.

**Friction contrast.** I unpacked that same intersection by UX friction: support ticket counts and KYC duration for Dormant versus the other cohorts. That separates 'no suitable job' from 'friction gets in the way'.

## Result

- Chi-square: JTBD segment × cohort are **NOT independent (p<0.001)**.
- **Dormant 39.4%** among Digital Newcomers 45+ vs **15.1%** among Family Budgeters (z-test significant).
- Dormant 45+ show more UX friction → dormancy is driven by UX, not a missing job.

## Recommendations

- The retention lever is assisted onboarding and UX simplification, not accepting churn.
- Don't scale one playbook across all job segments.
- Test the assisted-recovery hypothesis (Project 22).

## Documentation

- [GitHub → case-jtbd](https://github.com/NikitaBoyarkin/case-jtbd)
