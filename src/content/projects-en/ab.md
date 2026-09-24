---
title: A/B Testing Methodology Toolkit
description: "15 A/B methodology modules, each calibrated by simulation: an A/A null check holds Type I error at α, and power curves show the effect size each method can actually detect."
track: experiments
hero: images/ab.svg
impact:
  - "15 modules, each calibrated by simulation: Type I error ≈ α, power curves"
  - "CUPED drops variance by ρ², so the standard error by ~ρ"
  - "Naive peeking inflates Type I error — Pocock/OBF and mSPRT keep it under control"
  - "Delta method gives the correct SE for ratio metrics (CTR, RPC) — the naive per-unit t-test is biased"
  - "End-to-end pipeline: SRM → CUPED → delta-method CTR → per-segment ATE + BH → novelty check"
tools:
  - Python
  - NumPy / SciPy
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/ab_test
updated: 2026-09-17
related:
  - /projects/volta/
---

# A/B Testing Methodology Toolkit

## Goal

An A/B testing method is only as good as its Type I error under the null and its power under a real effect. In practice those promises are rarely checked: naive peeking, a wrong SE for ratio metrics, and multiple testing silently break decisions. The toolkit implements 15 methods from the primary literature and calibrates each one by simulation instead of trusting asymptotics.

## Data & Method

### Modules

| Module | Method | What the demo shows |
|--------|--------|---------------------|
| `srm_test.py` | Sample Ratio Mismatch (χ²) | catches bucketing/traffic bugs before any downstream test |
| `sample_size.py` | Fixed-horizon sizing | n/arm for proportions and means |
| `delta_method_ratio.py` | Ratio metrics (CTR, RPC) | correct SE for ΣY/ΣX; the naive per-unit t-test is biased |
| `cuped.py` | Variance reduction | variance ↓ by ρ², SE by ~ρ, using pre-period data |
| `group_sequential.py` | Alpha-spending boundaries | Pocock/OBF control Type I while naive peeking inflates it |
| `msprt_always_valid.py` | Always-valid p-values | mSPRT lets you peek and stop any time, validly |
| `sequential_ratio.py` | Sequential ratio metrics | delta-method + mSPRT for CTR under continuous monitoring |
| `sequential_ab_testing.py` | Evan Miller's sequential rule | reproduces the size table, validates Type I/power, sample savings |
| `bayesian_ab_test.py` | Analytic Bayesian A/B | Beta-Binomial / Normal-Normal, P(B>A), expected loss, ROPE |
| `bootstrap_ci.py` | Bootstrap CIs | percentile & BCa for skewed metrics |
| `heterogeneous_treatment_effects.py` | HTE by segment | interaction model reveals Simpson-paradox-like cancellation |
| `multiple_comparisons.py` | Multiple-testing correction | Bonferroni (FWER) vs Benjamini-Hochberg (FDR) |
| `novelty_primacy.py` | Time-varying effects | treat×day interaction detects novelty decay / primacy growth |
| `switchback.py` | Cluster & switchback designs | cluster-robust SE; naive over-/under-rejects; carryover bias |
| `test_simulator.py` | Generic test calibration | plug any DGP + test → empirical Type I and power curve |

### End-to-end pipeline

`scripts/run_full_pipeline.py` ties the modules into one realistic flow on synthetic data: SRM check → CUPED → delta-method CTR test → per-segment ATE with BH correction → novelty check → a markdown report in `outputs/report.md`.

### Run

```bash
uv sync --all-groups
uv run pytest                 # calibration test suite
uv run python scripts/run_full_pipeline.py   # end-to-end demo → outputs/report.md
```

## Result

The `tests/` suite re-runs every calibration with assertions:

- Type I error ≈ α (± tolerance) for each method under its null;
- CI coverage ≈ 95% for the bootstrap;
- naive peeking inflates Type I, always-valid / alpha-spending control it;
- the naive per-unit ratio SE is inaccurate, the delta-method SE is accurate;
- correctness on known-answer fixtures (SRM splits, segment uplifts, etc.).

## Limitations

The numbers come from simulations with a known DGP, not production traffic: calibration confirms the implementation is correct, but it does not guarantee that real data satisfies the assumptions. This is a set of tools, not a substitute for a sound experiment design.

## Documentation

- [GitHub → ab_test](https://github.com/NikitaBoyarkin/ab_test)
