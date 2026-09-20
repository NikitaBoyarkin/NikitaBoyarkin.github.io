---
title: "Volta — Causal Validation of KYC (DiD)"
description: "A DiD test shows the KYC fix causally lifted M3 retention by +9.09pp (95% CI [+6.21, +11.96]) — flat pre-trends, placebo ≈ 0, max |SMD| 0.157 < 0.2."
part: causal-kyc
order: 23
layer: causal
impact:
  - "M3 retention: DiD ATT +9.09pp (95% CI [+6.21, +11.96]), p<0.001"
  - "Naive pre/post overstates activation: +6.29pp vs DiD +4.92pp"
  - "Diagnostics pass: pre-trends p=0.29–0.70; placebo ≈ 0; max |SMD| 0.157"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "causal-naive-vs-did"
  - "causal-recovery"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Causal Validation of KYC (DiD)

## Context

Project 3 showed the KYC fix coincided with better retention, but a pre/post Welch t-test is a correlation, not a causal estimate: it ignores the shared monthly trend. This project tests the same claim with a difference-in-differences design against a flow the fix did not touch.

## Data & Method

- Design: treated — in-app KYC (subject to the progress bar), comparison — partner KYC (agent-assisted; the fix does not apply), cutoff 2024-09.
- N = 84,000 (50,400 treated / 33,600 comparison), 24 registration cohorts (2023-01 … 2024-12).
- Estimates: naive pre/post, 2×2 DiD, and a covariate-adjusted DiD (age, device, pre-activity) with cohort-clustered SE.
- Diagnostics: parallel trends (pre-period gap slope), a placebo at a fake 2024-01 cutoff, covariate balance (SMD), propensity overlap.
- The data is synthetic: the generator injects a known ATT (+5.7 / +8.5 / +9.0 pp), so this is a methods demonstration — the estimator must recover the effect.

## Findings

- **M3 retention: DiD ATT +9.09pp** (95% CI [+6.21, +11.96], p<0.001) — the causal estimate matches Project 3 (+9.2pp).
- **Activation: naive +6.29pp → DiD +4.92pp** (95% CI [+4.07, +5.77]) — pre/post overstates the effect because it does not net out the shared trend.
- M1 retention: DiD +7.49pp (95% CI [+5.92, +9.05]).
- Diagnostics pass: pre-trends flat (p = 0.70 / 0.36 / 0.29), placebo ≈ 0 (every CI covers 0), max |SMD| = 0.157 < 0.2.
- Recovery: 3/3 95% CIs cover the injected effect — the estimator recovers the truth.

## Recommendations

- Separate the evidence: the randomized A/B (+5.72pp) drives the ship decision; DiD validates observational claims (retention) causally.
- Label pre/post numbers as correlation: naive activation +6.29pp vs DiD +4.92pp — pre/post overstates.
- Keep the diagnostic gate (parallel trends + placebo + SMD < 0.2) before publishing any causal claim.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
