---
title: "Volta — Assisted CAC vs LTV"
description: "Does the 45+ trust track pay off: 45+ LTV/CAC = 0.66 against a ≥3 gate; assisted CAC €120 is ~3× referral and doesn't pay back (50-month payback)."
star:
  situation: "First project in the validation round: the earlier recommendation of a separate trust track for 45+ is put to a money test"
  task: "Own the money test of the earlier recommendation — a separate trust track for the senior segment"
  action: "LTV per user, blended CAC by segment and channel, LTV/CAC with bootstrap CIs, payback, Welch t-test on assisted LTV"
  result: "The anchor clears the ≥3 gate only via referral at LTV/CAC 3.62; 45+ clears none: assisted 0.41; blended 0.66; 50-month payback"
part: assisted-cac
order: 18
layer: rat-v2
impact:
  - "45+ LTV/CAC 0.66 (gate ≥3)"
  - "Anchor clears 3.62 only via referral"
  - "Assisted CAC €120; 50-month payback"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "assisted-ltv-cac"
github: https://github.com/NikitaBoyarkin/case-assisted-cac
---

# Volta — Assisted CAC vs LTV

## Situation

The first RAT v2 validation project: the v1 recommendation 'a separate trust track for 45+' is tested in money.

## Task

I owned the money verdict on the earlier recommendation: whether a separate track for the senior segment pays for itself, not merely whether it lifts retention. The call had to rest on a calculation, not on the direction of the effect.

## Actions

I built the check as an economic comparison of two segments across channels, not as a verdict on one channel. I assembled value and acquisition cost first, then reduced them to a gate and tested the gap statistically.

**Data preparation.** For each user I assembled value as revenue times contribution margin times retention months, and split acquisition cost by segment and channel: referral, assisted, blended. I kept channels separate so the assisted price is not diluted by cheaper sources.

**Ratio estimate.** I reduced value and cost to LTV/CAC and compared it against the gate the team holds for a launch. I also computed the acquisition payback — how many months of value it takes to return the cost.

**Uncertainty.** I added bootstrap confidence intervals to the ratio so the verdict does not hinge on a single point estimate. That separates a stable clearing of the gate from noise.

**Statistical test.** I compared assisted value across the two segments, anchor and 45+, with a Welch t-test, which does not assume equal variances. That tests whether the gap between segments is significant rather than scatter.

**Validation.** I recomputed acquisition cost from an independent source and checked that changing the retention assumption does not flip the verdict.

## Result

- The **anchor** clears the ≥3 gate only via referral: LTV/CAC **3.62**.
- **45+** clears no channel: assisted **0.41**; blended 45+ **0.66**.
- Assisted gives the best retention (churn ×0.75), but the €120 CAC outweighs it — **50-month payback**.
- Welch t-test: anchor − 45+ = **€43.99** (p≈2e-13).

## Recommendations

- The v1 'trust track' is right in direction but not yet affordable — hold.
- Cut assisted CAC (remote video KYC, partner cost-sharing).
- Combine with a 45+ monetization lever before scaling.

## Documentation

- [GitHub → case-assisted-cac](https://github.com/NikitaBoyarkin/case-assisted-cac)
