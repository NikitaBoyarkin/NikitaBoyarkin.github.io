---
title: "Volta — Dormant 45+ Win-back"
description: "Three-arm win-back: human +5.34pp and light-touch +2.77pp vs control. Light-touch pays off at 30–90d (ROI 2.54 / 1.26), human ROI 0.40 — kill as a mass channel."
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
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Dormant 45+ Win-back

## Situation

The last RAT v2 project: Project 13 argued that 45+ dormancy is a UX barrier. We test whether assisted reactivation recovers these dormant users and whether it pays off.

## Task

I owned the closing check of the validation round: whether assisted reactivation actually brings dormant senior users back, and whether that effort pays for itself.

## Actions

- Three-arm randomized win-back: automated / light-touch / human.
- Four dormancy buckets; z-tests by arm and bucket with Holm correction.
- ROI per 10K treated, targeting boundary, break-even LTV.

## Result

- Mechanism confirmed: **human +5.34pp** and **light-touch +2.77pp** vs control (both significant); strongest at 30–60d (human **+11.37pp**).
- Economics refine it: light-touch pays off at **30–60d (ROI 2.54)** and **60–90d (1.26)**; human loses money everywhere (**overall 0.40**).
- At 180d+ the effect nearly vanishes.

## Recommendations

- Launch light-touch win-back targeting **30–90 day** dormant users (ship narrowly).
- Human calls are an escalation for high-value/high-balance, not a mass channel (kill).
- Don't touch 180d+ — the economics are negative.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
