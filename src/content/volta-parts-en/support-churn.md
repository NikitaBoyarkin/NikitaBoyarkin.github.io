---
title: "Volta — Support & Churn"
description: "Churn rises with ticket count: 37.1% at zero contacts vs 81.1% at 3+. Support is a measurable retention lever, not just a cost center."
star:
  situation: "We test whether a bad support experience drives churn and whether it can be influenced"
  task: "Check whether a poor support experience actually drives churn, and whether that link is something the team can act on"
  action: "Ticket–churn merge per user; churn by ticket count, by unresolved, and by CSAT band"
  result: "Churn rises with ticket count: 37.1% (0) → 81.1% (3+); users with 3+ tickets churn 2.2× more; CSAT bands barely discriminate (52–55%)"
part: support-churn
order: 11
layer: extended
impact:
  - "Churn 37.1% (0 tickets) → 81.1% (3+)"
  - "Unresolved tickets amplify churn"
  - "CSAT bands barely discriminate churn"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "cs-churn-by-tickets"
github: https://github.com/NikitaBoyarkin/case-support-churn
---

# Volta — Support & Churn

## Situation

We test whether a bad support experience drives churn and whether it can be influenced.

## Task

I owned testing the link between support contacts and churn: separating a real signal from noise and showing where the team has a lever. A plausible link was not to be taken as a proven one.

## Actions

I tested the link across bands of experience, not averages: what matters is not that a contact happened but how many and how they ended. So I built churn by group and compared the groups.

**Data preparation.** I joined support tickets to churn data per user and computed each user's contact count, unresolved share and satisfaction score. I kept users with no contacts as the comparison base.

**Churn by experience.** I computed the churn share in groups by contact count and by unresolved-ticket share. That shows whether churn rises monotonically with experience or breaks at some point.

**Comparison with the base.** I compared the heaviest-experience group with the base and computed how many times higher churn runs. That makes the link measurable rather than descriptive.

**Role of satisfaction.** I checked separately whether the satisfaction score discriminates churn: if the score bands barely differ, it is a weak predictor even when it looks plausible.

**Validation.** I tested the conclusion for stability to the choice of band edges and confirmed the link is not explained by contact volume alone.

## Result

- Churn rises with ticket count: **37.1%** (0) → **46.3%** (1) → **65.2%** (2) → **81.1%** (3+).
- Users with 3+ tickets churn **2.2×** more than the base.
- CSAT bands barely discriminate churn (52–55%) — a weak signal.

## Recommendations

- Cut ticket volume via self-serve and clearer errors.
- Resolve unresolved tickets faster — they amplify churn.
- Don't rely on CSAT as a retention predictor.

## Documentation

- [GitHub → case-support-churn](https://github.com/NikitaBoyarkin/case-support-churn)
