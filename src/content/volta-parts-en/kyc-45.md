---
title: "Volta — 45+ KYC Deep-Dive"
description: "Age-sliced A/B HTE: 35–44 +11.0pp and 18–24 +5.3pp, but 45+ +1.4pp (ns). Referral (trust) converts 45+ best — friction is trust, not UX."
star:
  situation: "The KYC fix lifted conversion overall — I check whether it closes the 45+ segment specifically"
  task: "Own the segment-level breakdown and the rule that the overall lift is not a fix for the senior segment"
  action: "Age-sliced A/B HTE by age group (two-proportion z-test), KYC completion by channel, chi-square age × completion"
  result: "35–44 +11.0pp (p<0.001), 45+ +1.4pp (ns), 45+ in treatment 53.2% vs 61.2%"
part: kyc-45
order: 16
layer: market-jobs
impact:
  - "35–44 +11.0pp (p<0.001); 45+ +1.4pp (ns)"
  - "45+ in treatment 53.2% vs 25–34 61.2%"
  - "Referral converts 45+ best (64.1%)"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "kyc-lift-by-age"
github: https://github.com/NikitaBoyarkin/case-kyc-45
---

# Volta — 45+ KYC Deep-Dive

## Situation

The KYC fix lifted conversion overall — but does it close the 45+ segment specifically, which dropped off the funnel the most.

## Task

I owned the segment-level breakdown and the rule that the overall lift must not be sold as a fix for the senior segment.

## Actions

I broke the overall lift down by age group to check whether it works the same for everyone — and whether the conversion gain hides a failure among senior users.

- **HTE cut.** Computed the KYC lift separately per age group and tested each with a two-proportion z-test.
- **Within-treatment check.** Confirmed the gap between age groups persists inside treatment too, not only in control.
- 45+ vs 25–34 KYC completion by channel.
- **Chi-square.** Tested the association between age and completion inside treatment with a contingency table.
- **Channels.** Compared how different acquisition channels complete KYC and found which channel narrows the gap best.
- **Scope.** Recorded that the UX fix alone does not close the senior segment — so it is not shipped as a universal solution.
- **Tooling.** Python and pandas/NumPy for the cuts, SciPy/Statsmodels for the tests, Matplotlib/Seaborn for the lift-by-age chart.

## Result

- **35–44 +11.0pp** (p<0.001) and **18–24 +5.3pp** (p<0.05) — significant; **45+ +1.4pp** (p=0.59, ns) — the fix does not close 45+.
- The 45+ gap persists in treatment: **53.2% vs 61.2%** for 25–34 (chi² p<0.001).
- **Referral (trust)** converts 45+ best (**64.1%**) with the smallest gap (−2.4pp vs −10.6pp on the website).

## Recommendations

- Don't ship a UX-only fix for 45+ — the barrier is trust.
- Separate track: assisted onboarding (video call / in-branch KYC) + partner/referral channel.
- Test the economics of the trust track (Project 18).

## Documentation

- [GitHub → case-kyc-45](https://github.com/NikitaBoyarkin/case-kyc-45)
