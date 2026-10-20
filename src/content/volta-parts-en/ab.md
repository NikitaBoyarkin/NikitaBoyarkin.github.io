---
title: "Volta — KYC Progress-Bar A/B Test"
description: "A KYC progress bar lifted conversion +5.72pp (Z=5.82, p<0.0001) against a +5pp MDE. CUPED, AA-test and Bonferroni protect the conclusion; +€208.5K over 12 months at 13.9× ROI."
star:
  situation: "Validating the funnel finding: a snapshot is not proof, so the KYC progress-bar hypothesis was tested as an experiment"
  task: "Own the correctness of the experiment: design the test, run it, and protect the conclusion from statistical pitfalls"
  action: "Sample-size calculation for the MDE, SRM check, bootstrap CI, CUPED with a sessions covariate, AA-test and Bonferroni"
  result: "KYC conversion 55.8% → 61.5%: +5.72pp at p<0.0001, above the MDE; gate passed, +€208.5K over 12 months"
part: ab
order: 2
layer: core
impact:
  - "+5.72pp KYC conversion (Z=5.82, p<0.0001), above MDE"
  - "Ship-gate: significance ∧ lift≥MDE ∧ no SRM → ship"
  - "+€208.5K over 12 months at 13.9× ROI on €15K dev-cost (5.6-month payback)"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "kyc-ab-conversion"
  - "ab-power-curve"
github: https://github.com/NikitaBoyarkin/case-ab
---

# Volta — KYC Progress-Bar A/B Test

## Situation

Validating the funnel finding: a snapshot is not proof, so the hypothesis (split KYC into steps with a progress bar) was tested as an experiment.

## Task

I owned the correctness of the experiment: designing the hypothesis test, running it, and protecting the conclusion from statistical pitfalls.

## Actions

The project is built as a full experiment, not a comparison of two snapshots: I fixed the design and the decision metric first, verified the split, then estimated the effect and its robustness.

- **Design.** Set the primary metric (KYC step conversion), the hypothesis and the minimum detectable effect, then sized each arm against that effect.
- **Split hygiene.** Checked SRM (p=1.00) to confirm traffic was divided without systematic skew, and compared the covariate distributions before the test started.
- **Effect estimate.** Compared the group proportions and built a bootstrap confidence interval for the lift.
- **CUPED** with 'sessions before the test' as covariate (control-only θ) — cuts variance without biasing the estimate.
- **AA-test** under H₀ (type-I = 0.050) and multiple-comparison correction (Bonferroni/Holm/BH) for the segment cuts.
- **Sensitivity and segments.** Looked at behaviour at the MDE rather than post-hoc power, and read the segments separately to separate a real effect from multiple-comparison noise.
- **Tooling.** Python and pandas/NumPy to prepare the data, SciPy/Statsmodels for the tests, scikit-learn for the covariates, Matplotlib/Seaborn for the charts; runs are reproducible through uv + ruff.

## Result

- Control **55.8%** → treatment **61.5%**: **+5.72pp**, 95% CI [+3.78%, +7.66%], p<0.0001 — above the +5pp MDE.
- No SRM; covariates balanced descriptively (crosstabs by device / age_group / channel) — the script computes no formal SMD test.
- 6/11 segments naively significant, 4/11 after Bonferroni.
- Ship-gate passed → roll the progress bar out to 100%; business impact **+€208.5K over 12 months** (13.9× ROI, 5.6-month payback).

## Recommendations

- Ship the progress bar to 100% — the gate is passed.
- Keep the three-condition ship-gate: it protects against statistically-significant but business-insignificant changes.
- Re-test the segment effects individually after Bonferroni.

## Documentation

- [GitHub → case-ab](https://github.com/NikitaBoyarkin/case-ab)
