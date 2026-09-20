---
title: "Volta — Anchor Launch CAC at Scale"
description: "LTV/CAC ≥3 holds only to ~70K users; at SOM it falls to 1.76× and a 17-month payback. The constraint is cheap-channel capacity, not budget."
part: anchor-cac
order: 21
impact:
  - "LTV/CAC ≥3 gate holds to ~70K"
  - "At SOM 1.76× and 17.0-month payback"
  - "Referral €18→61, capacity 40K"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "anchor-ltv-cac-vs-scale"
  - "anchor-marginal-cac"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Anchor Launch CAC at Scale

## Context

The 25–34 anchor is the growth point, but does the launch scale economically when taken to SOM.

## Data & Method

- Marginal-CAC curves by channel (saturation).
- Cheap-first greedy allocation, blended LTV/CAC and payback vs scale.
- Break-even scale, channel-mix and capacity analysis.

## Findings

- The LTV/CAC ≥3 gate holds only to ≈ **70K** users (31% of SOM).
- At SOM (225K): **LTV/CAC 1.76×**, **17.0-month** payback — both gates fail; the marginal SOM user costs **€80**.
- The constraint is cheap-channel capacity: referral €18→61 (capacity 40K), paid social €58→368 (200K).

## Recommendations

- Don't plan the anchor to SOM on a paid budget (hold).
- Raise referral and in-app conversion (capacity + CAC), cap paid at scale.
- Replan SOM around what cheap channels can carry.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
