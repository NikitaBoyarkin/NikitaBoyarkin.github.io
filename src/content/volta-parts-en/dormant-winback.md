---
title: "Volta — Dormant 45+ Win-back"
description: "Three-arm win-back: human +5.34pp and light-touch +2.77pp vs control. Light-touch pays off at 30–90d (ROI 2.54 / 1.26), human ROI 0.40 — kill as a mass channel."
star:
  situation: "Closing project of the validation round: an earlier part tied senior dormancy to a UX barrier but never tested reactivation"
  task: "Own the reactivation test and an honest verdict on its economics, including a possible kill of the channel"
  action: "Three-arm win-back, four dormancy buckets, z-tests by arm and bucket with Holm correction, ROI and targeting boundary"
  result: "human +5.34pp, light-touch +2.77pp; light-touch pays off at 30–60d (ROI 2.54) and 60–90d (1.26), human overall 0.40"
part: dormant-winback
order: 22
layer: rat-v2
impact:
  - "human +5.34pp, light-touch +2.77pp"
  - "Light-touch ROI 2.54 (30–60d) and 1.26 (60–90d)"
  - "human ROI 0.40 — doesn't pay back"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "dormant-reactivation"
  - "dormant-roi"
github: https://github.com/NikitaBoyarkin/case-dormant-winback
---

# Volta — Dormant 45+ Win-back

## Situation

The last RAT v2 project: Project 13 argued that 45+ dormancy is a UX barrier. We test whether assisted reactivation recovers these dormant users and whether it pays off.

## Task

I owned the reactivation test and an honest verdict on its economics, including a possible kill of the channel.

## Actions

I built the win-back as a three-arm randomized experiment, so both the mechanism and the economics are measured on comparable groups rather than historical cuts.

- **Three arms.** Split users into automated, light-touch and human, plus control — so both the effect and its price are visible.
- **Dormancy buckets.** Divided dormant users by how long they had been away, so targeting rests on recency rather than an average segment.
- **Tests.** Checked the lift for each arm and bucket with a Holm correction — otherwise multiple comparisons produce false wins.
- **Economics.** ROI per 10K treated, targeting boundary, break-even LTV — to separate a statistically significant effect from a payable one.
- **Randomisation.** Checked group balance before the start, so a difference in response could not be explained by a different mix of dormant users.
- **Tooling.** Python and pandas/NumPy for the calculations, SciPy/Statsmodels for the tests, Matplotlib/Seaborn for the reactivation and ROI charts.

## Result

- Mechanism confirmed: **human +5.34pp** and **light-touch +2.77pp** vs control (both significant); strongest at 30–60d (human **+11.37pp**).
- Economics refine it: light-touch pays off at **30–60d (ROI 2.54)** and **60–90d (1.26)**; human loses money everywhere (**overall 0.40**).
- At 180d+ the effect nearly vanishes.

## Recommendations

- Launch light-touch win-back targeting **30–90 day** dormant users (ship narrowly).
- Human calls are an escalation for high-value/high-balance, not a mass channel (kill).
- Don't touch 180d+ — the economics are negative.

## Documentation

- [GitHub → case-dormant-winback](https://github.com/NikitaBoyarkin/case-dormant-winback)
