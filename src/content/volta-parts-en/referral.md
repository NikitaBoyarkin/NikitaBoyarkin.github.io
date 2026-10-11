---
title: "Volta — Referral Segments"
description: "Referral funnel by JTBD segment: anchor 29.6% vs Digital Newcomers 45+ 4.8% and families 8.6%. The gap opens at accept, not KYC."
star:
  situation: "Referral is the best funnel channel: I test whether it scales beyond the anchor segment"
  task: "Own the check of whether the channel's strength holds outside the anchor, and not to scale it blindly"
  action: "Referral funnel by JTBD segment, chi² segment × status, two-proportion z-test, channel effect within gap segments"
  result: "Anchor 29.6% vs 45+ 4.8% and families 8.6%; the gap opens at accept (78% vs 26% vs 40%), in-app 20.6% vs link 14.3%"
part: referral
order: 17
layer: market-jobs
impact:
  - "Anchor 29.6% vs 45+ 4.8% and families 8.6%"
  - "Gap at accept (78% vs 26% vs 40%)"
  - "chi² p<0.001; z anchor vs gap = 43.3"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "referral-conversion-by-segment"
github: https://github.com/NikitaBoyarkin/case-referral
---

# Volta — Referral Segments

## Situation

Referral is the best funnel channel. We test whether it scales beyond the anchor.

## Task

I owned the check of whether the channel's strength holds outside the anchor, and the rule not to scale it blindly.

## Actions

I broke referral down by funnel step and by segment to see exactly where the channel's strength is lost outside the anchor.

- **Funnel.** Built the referral funnel (sent→accepted→KYC→first-tx) separately for each JTBD segment.
- **Difference test.** Compared segments with a chi-square over the 'segment × status' table and a two-proportion z-test (anchor vs gap).
- **Where it breaks.** Located the step at which the gap opens, rather than stopping at the end-to-end conversion.
- **Channel.** Checked how the invitation method affects conversion, within the gap segments.
- **Scaling verdict.** Recorded that the budget cannot be scaled without segment incentives.
- **Tooling.** Python and pandas/NumPy for the funnel, SciPy/Statsmodels for the tests, Matplotlib/Seaborn for the conversion-by-segment chart.

## Result

- **Anchor 29.6%** vs **45+ 4.8%** and **families 8.6%** (chi² p<0.001, z=43.3).
- The gap opens at **accept** (78% vs 26% vs 40%), not at KYC.
- In-app 20.6% vs link 14.3% overall, but within the gap still far below the anchor.

## Recommendations

- Don't scale the referral budget blindly.
- Segment incentives first (assisted for 45+, cashback for families), then expand referral.
- Rework the referral value prop for gap segments.

## Documentation

- [GitHub → case-referral](https://github.com/NikitaBoyarkin/case-referral)
