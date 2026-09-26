---
title: "Volta — KYC Progress-Bar A/B Test"
description: "A KYC progress bar lifted conversion +5.72pp (Z=5.82, p<0.0001) against a +5pp MDE. CUPED, AA-test and Bonferroni protect the conclusion; +€656K/yr at 44× ROI."
part: ab
order: 2
layer: core
impact:
  - "+5.72pp KYC conversion (Z=5.82, p<0.0001), above MDE"
  - "Ship-gate: significance ∧ lift≥MDE ∧ no SRM → ship"
  - "+€656K/yr at 44× ROI on €15K dev-cost"
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
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — KYC Progress-Bar A/B Test

## Situation

Validating the funnel finding: a snapshot is not proof, so the hypothesis (split KYC into steps with a progress bar) was tested as an experiment.

## Task

I needed to show that the onboarding snapshot held up under a controlled test, so I owned the experiment that split KYC into steps with a progress bar.

## Actions

- Sample-size calculation for the MDE, SRM check (p=1.00), bootstrap CI.
- **CUPED** with 'sessions before the test' as covariate (control-only θ).
- **AA-test** under H₀ (type-I = 0.050) and multiple-comparison correction (Bonferroni/Holm/BH).
- Sensitivity at the MDE (not post-hoc power).

## Result

- Control **55.8%** → treatment **61.5%**: **+5.72pp**, 95% CI [+3.78%, +7.66%], p<0.0001 — above the +5pp MDE.
- No SRM; covariate balance confirmed.
- 6/11 segments naively significant, 4/11 after Bonferroni.
- Ship-gate passed → roll the progress bar out to 100%; business impact **+€656K/yr**.

## Recommendations

- Ship the progress bar to 100% — the gate is passed.
- Keep the three-condition ship-gate: it protects against statistically-significant but business-insignificant changes.
- Re-test the segment effects individually after Bonferroni.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
