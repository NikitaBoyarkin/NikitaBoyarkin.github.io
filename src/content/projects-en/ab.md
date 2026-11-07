---
title: A/B Testing Methodology Toolkit
description: "18 A/B modules, each calibrated: CUPED cuts variance 17.7% (SE 0.00360 → 0.00327), the delta method finds a +0.51 pp CTR lift at p < 0.0001, and SRM p = 0.8376."
star:
  situation: "An A/B method is only as good as its Type I error under the null and its power under a real effect"
  task: "Make the method guarantees verifiable, backed by a simulation run rather than by a citation"
  action: "Modules from the primary literature — SRM, CUPED, delta method, mSPRT, HTE, BH — each calibrated by simulation"
  result: "CUPED cuts variance 17.7% (SE 0.00360 → 0.00327) and the delta method finds a +0.51 pp CTR lift at p < 0.0001 with SRM p = 0.8376 — all 18 modules calibrated by simulation"
track: experiments
hero: images/ab.svg
ogImage: /images/og/ab.png
impact:
  - "18 modules, each calibrated by simulation: Type I error ≈ α, power curves"
  - "CUPED drops variance by ρ², so the standard error by ~ρ"
  - "Naive peeking inflates Type I error — Pocock/OBF and mSPRT keep it under control"
  - "Delta method gives the correct SE for ratio metrics (CTR, RPC) — the naive per-unit t-test is biased"
  - "End-to-end pipeline: SRM → CUPED → delta-method CTR → per-segment ATE + BH → novelty check"
  - "CUPED on the pipeline run: variance −17.7%, SE 0.00360 → 0.00327"
  - "Delta-method CTR: +0.51 pp lift at p < 0.0001; SRM p = 0.8376 — clean buckets"
tools:
  - Python
  - NumPy / SciPy
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/ab_test
date: 2026-08-22
updated: 2026-11-01
demo: demos/ab/index.html
related:
  - /projects/volta/
  - /projects/crm-experiment-lab/
  - /projects/linkedin/
  - /projects/product-ab-funnel/
  - /projects/serp-rank/
  - /glossary/confidence-interval/
  - /glossary/sample-size/
faq:
  - question: "How is a method's correctness verified?"
    answer: "By simulation calibration: an A/A run holds Type I error at α and bootstrap CI coverage sits near 95% — the property is backed by a run, not by a citation."
  - question: "How much variance does CUPED remove?"
    answer: "ρ² of it, which is the standard error by roughly a factor of ρ."
  - question: "Why is naive peeking dangerous?"
    answer: "It inflates Type I error; Pocock/OBF and mSPRT keep it under control."
  - question: "How should ratio metrics like CTR be tested?"
    answer: "The delta method gives the correct SE for CTR and RPC — the naive per-unit t-test is biased on a ratio metric."
  - question: "What does the end-to-end pipeline contain?"
    answer: "SRM → CUPED → delta-method CTR → per-segment ATE with a BH correction → novelty check."
sources:
  - trustworthy-online-controlled-experiments
---

# A/B Testing Methodology Toolkit

**▶ [Architecture diagram](/diagrams/ab-test.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

An A/B testing method is only as good as its Type I error under the null and its power under a real effect. In practice those promises are rarely checked: naive peeking, a wrong SE for ratio metrics, and multiple testing silently break decisions. The toolkit implements 18 methods from the primary literature and calibrates each one by simulation instead of trusting asymptotics.

## Task

I needed a testing toolkit whose methods hold up under the null and under a real effect, so I owned the calibration layer and checked every method by simulation instead of trusting asymptotics.

## Actions

### Modules

| Module | Method | What the demo shows |
|--------|--------|---------------------|
| `srm_test.py` | Sample Ratio Mismatch (χ²) | catches bucketing/traffic bugs before any downstream test |
| `sample_size.py` | Fixed-horizon sizing | n/arm for proportions and means |
| `delta_method_ratio.py` | Ratio metrics (CTR, RPC) | correct SE for ΣY/ΣX; the naive per-unit t-test is biased |
| `ratio_cuped.py` | CUPED on a ratio metric | linearise Z = Y − R·X: pre-period data cuts SE without new sample |
| `cuped.py` | Variance reduction | variance ↓ by ρ², SE by ~ρ, using pre-period data |
| `cupac.py` | CUPAC | OLS over every pre-period column removes more variance than one covariate |
| `post_stratification.py` | Post-stratification | repairs a drifted split using pre-registered strata |
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
uv run python scripts/cli.py --help          # run any method from the terminal
```

## Result

The `tests/` suite re-runs every calibration with assertions:

- Type I error ≈ α (± tolerance) for each method under its null;
- CI coverage ≈ 95% for the bootstrap;
- naive peeking inflates Type I, always-valid / alpha-spending control it;
- the naive per-unit ratio SE is inaccurate, the delta-method SE is accurate;
- correctness on known-answer fixtures (SRM splits, segment uplifts, etc.);
- CUPED on the pipeline run: variance −17.7%, SE 0.00360 → 0.00327;
- delta-method CTR: +0.51 pp lift at p < 0.0001, SRM p = 0.8376.

## What I learned

A method is correct not because the literature says so but because a run could have failed. The claim that Type I error holds at alpha becomes a property only when it shows up under the null on an actual run, and power shows up on the curve under a real effect. So the toolkit collects demonstrations rather than formulas: each one shows the assumption whose violation breaks the method.

The second point is that every correction is paid for with an assumption, and that assumption travels with the result. CUPED needs a pre-period covariate that correlates with the outcome and is untouched by assignment; always-valid inference trades the freedom to peek for wider boundaries; a multiple-testing correction controls exactly the family you declared in advance. The design lets you assert a controlled error rate within a declared stopping rule and a declared metric family — and forbids extending it to a metric added after you looked at the data.

## Discussion points

- **Why calibration by simulation instead of a citation.** Asymptotics assumes what the data may not deliver; only a run under a known generator shows the actual error rate.
- **Why CUPED instead of buying more traffic.** The pre-period is already collected and independent of assignment, so variance drops without new users.
- **Why alpha-spending boundaries instead of a promise not to peek.** The observer chooses the stopping time, and a fixed-horizon p-value no longer means what it is credited with at that moment.
- **Where validity ends.** One generator, one metric family, one randomization scheme: a clean calibration is a property of the implementation, not a guarantee for production traffic.

## Limitations

The numbers come from simulations with a known DGP, not production traffic: calibration confirms the implementation is correct, but it does not guarantee that real data satisfies the assumptions. This is a set of tools, not a substitute for a sound experiment design.

## Documentation

- [GitHub → ab_test](https://github.com/NikitaBoyarkin/ab_test)
