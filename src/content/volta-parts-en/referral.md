---
title: "Volta — Referral Segments"
description: "Referral funnel by JTBD segment: anchor 29.6% vs Digital Newcomers 45+ 4.8% and families 8.6%. The gap opens at accept, not KYC."
star:
  situation: "Referral is the best funnel channel: I test whether it scales beyond the anchor segment"
  task: "Find out whether referral holds up outside the anchor and stays the strongest channel as it widens"
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
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Referral Segments

## Situation

Referral is the best funnel channel. We test whether it scales beyond the anchor.

## Task

Since referral is the strongest channel in the funnel, my job was to find out whether it holds up outside the anchor segment.

## Actions

- Referral funnel (sent→accepted→KYC→first-tx) by JTBD segment.
- Chi² segment × status, two-proportion z-test anchor vs gap.
- Channel effect within gap segments.

## Result

- **Anchor 29.6%** vs **45+ 4.8%** and **families 8.6%** (chi² p<0.001, z=43.3).
- The gap opens at **accept** (78% vs 26% vs 40%), not at KYC.
- In-app 20.6% vs link 14.3% overall, but within the gap still far below the anchor.

## Recommendations

- Don't scale the referral budget blindly.
- Segment incentives first (assisted for 45+, cashback for families), then expand referral.
- Rework the referral value prop for gap segments.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
