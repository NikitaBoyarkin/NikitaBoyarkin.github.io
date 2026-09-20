---
title: "Volta — Assisted CAC vs LTV"
description: "Does the 45+ trust track pay off: 45+ LTV/CAC = 0.66 against a ≥3 gate; assisted CAC €120 is ~3× referral and doesn't pay back (50-month payback)."
part: assisted-cac
order: 18
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
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Assisted CAC vs LTV

## Context

The first RAT v2 validation project: the v1 recommendation 'a separate trust track for 45+' is tested in money.

## Data & Method

- LTV per user (ARPU × contribution margin × retention months).
- Blended CAC by segment × channel, LTV/CAC with bootstrap CIs, payback.
- Welch t-test anchor vs 45+ on assisted LTV.

## Findings

- The **anchor** clears the ≥3 gate only via referral: LTV/CAC **3.62**.
- **45+** clears no channel: assisted **0.41**; blended 45+ **0.66**.
- Assisted gives the best retention (churn ×0.75), but the €120 CAC outweighs it — **50-month payback**.
- Welch t-test: anchor − 45+ = **€43.99** (p≈2e-13).

## Recommendations

- The v1 'trust track' is right in direction but not yet affordable — hold.
- Cut assisted CAC (remote video KYC, partner cost-sharing).
- Combine with a 45+ monetization lever before scaling.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
