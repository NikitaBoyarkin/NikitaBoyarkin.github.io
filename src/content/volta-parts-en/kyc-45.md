---
title: "Volta — 45+ KYC Deep-Dive"
description: "Age-sliced A/B HTE: 35–44 +11.0pp and 18–24 +5.3pp, but 45+ +1.4pp (ns). Referral (trust) converts 45+ best — friction is trust, not UX."
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
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — 45+ KYC Deep-Dive

## Situation

The KYC fix lifted conversion overall — but does it close the 45+ segment specifically, which dropped off the funnel the most.

## Task

With the overall lift confirmed, my job was to isolate the senior segment — the one that fell out of the funnel hardest — and see whether the KYC fix closes it too.

## Actions

- Age-sliced A/B HTE of KYC (two-proportion z-test).
- 45+ vs 25–34 KYC completion by channel.
- Chi-square age × completion within treatment.

## Result

- **35–44 +11.0pp** (p<0.001) and **18–24 +5.3pp** (p<0.05) — significant; **45+ +1.4pp** (p=0.59, ns) — the fix does not close 45+.
- The 45+ gap persists in treatment: **53.2% vs 61.2%** for 25–34 (chi² p<0.001).
- **Referral (trust)** converts 45+ best (**64.1%**) with the smallest gap (−2.4pp vs −10.6pp on the website).

## Recommendations

- Don't ship a UX-only fix for 45+ — the barrier is trust.
- Separate track: assisted onboarding (video call / in-branch KYC) + partner/referral channel.
- Test the economics of the trust track (Project 18).

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
