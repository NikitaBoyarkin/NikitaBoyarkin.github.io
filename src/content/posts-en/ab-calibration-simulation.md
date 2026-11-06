---
title: "Calibrating A/B methods with simulation: how to verify a method before production"
date: 2026-08-05
updated: 2026-08-23
category: guide
image: /images/og/ab-calibration-simulation.png
tags:
  - ab-testing
  - statistics
  - python
excerpt: "A p-value from a textbook doesn't prove a method — a simulation does. How to test every A/B module with an A/A check under the null and a power curve under the effect: CUPED, peeking, ratio metrics, mSPRT."
related:
  - /projects/ab/
  - /posts/bayesian-ab-testing/
  - /projects/volta/
keywords:
  - calibrate A/B methods simulation
  - A/A test type I error
  - power curve A/B
  - CUPED variance reduction
  - peeking type I error
  - always-valid mSPRT
draft: false
---

## Short version

Statistical methods are sold on asymptotic promises: "with large samples the t-test behaves like this."

But in product A/B testing you almost never work in the conditions those promises were proven for: you peek at the data mid-experiment, compare ratio metrics (CTR, RPC), add covariates, slice by segments.

The only honest way to learn how a method will behave on your data is to run it on a simulation where the true effect is known. Two mandatory tests per module:

- **A/A test under the null**: no effect, check that the share of "significant" results ≈ α (usually 0.05), not 0.12.
- **Power curve under a real effect**: an effect exists, check the method catches it with the expected probability instead of staying silent.

## Example

An A/A simulation over 1,000 runs: load two identical groups, count the share of p < 0.05.

```python
import numpy as np
from scipy import stats

rng = np.random.default_rng(42)
N = 10_000
alpha = 0.05

hits = 0
for _ in range(1_000):
    a = rng.normal(0, 1, N)
    b = rng.normal(0, 1, N)
    _, p = stats.ttest_ind(a, b)
    hits += p < alpha

print(f"Type I error: {hits / 1_000:.3f} (target <= {alpha})")
```

Power curve: the same loop, but group B gets an effect `d`, and we plot the share of significant results against `d`.

```python
effects = np.linspace(0, 0.15, 16)
powers = []
for d in effects:
    hits = 0
    for _ in range(500):
        a = rng.normal(0, 1, N)
        b = rng.normal(d, 1, N)
        _, p = stats.ttest_ind(a, b)
        hits += p < alpha
    powers.append(hits / 500)
```

The curve shows: effect 0.05 at N = 10,000 is caught almost always; effect 0.01 almost never. That's the answer to "is the sample big enough" — no asymptotics required.

## How to write it

1. **A generator with a known truth.** Always seeded, known true effect (0 or `d`), repeatable runs.
2. **Null check (A/A).** Run at effect = 0. The share of significant results must sit within noise around α. Drift up = the method imagines significance that isn't there.
3. **Power/coverage check.** Run at effect `d` from a realistic range. The share of significant results is power. Plus "coverage" for confidence intervals: the interval should cover the true value in ~95% of runs.
4. **Run your real pipeline's special cases.** Not an abstract t-test, but the exact transformations used in production: CUPED, ratio metric, segment cuts, multiple-comparison correction.

## How to understand it

### Why naive peeking inflates Type I

If you look at the data every day and stop at p < 0.05, the chance of seeing "significance" under the null grows. By day 100 it happens almost surely. Formal fixes are alpha-spending boundaries (Pocock, O'Brien–Fleming) or always-valid methods (mSPRT), which don't penalize early stopping.

### How CUPED actually helps

CUPED uses a covariate measured before randomization (pre-test retention, number of sessions) to strip noise out of the outcome. Effect variance shrinks by `(1 − ρ²)`, where ρ is the covariate-outcome correlation. At ρ = 0.7 the SE drops by about 29% — like adding ~2× sample without growing it.

### Ratio metrics break the naive t-test

CTR = clicks / impressions. If you sum clicks and impressions and compare "per user", the standard error is biased — the denominator is random. The right path is the delta method: asymptotics via a Taylor expansion. A naive per-unit t-test will flag "significance" where there is none.

### mSPRT: look whenever you want

mSPRT (mixture Sequential Probability Ratio Test) is built so the probability of a false positive at any number of interim looks stays controlled. Not "look less often", but "you can look as much as you want."

## Tips

- An A/A test is calibration, not a ritual: if type I = 0.12, the method is broken, not "just noise."
- Simulate on your own distribution (lognormal revenue, discrete impressions), not a gaussian — otherwise you calibrate for someone else's product.
- Check both the "good" scenario and degradation: small samples, rare events, imbalanced groups.
- Check interval coverage separately from power: an interval can be "narrow and wrong."
- After any method change, re-run the whole calibration — one tweak to the SE breaks everything downstream.

## In practice

In the [A/B Testing Methodology Toolkit](/projects/ab/) every one of the 15 modules follows this recipe: a seeded generator, an A/A check, power/coverage curves.

The result is not "use the t-test" but a set of verified choices: an SRM check on entry, CUPED, delta method for CTR, alpha-spending boundaries, segment ATEs with Benjamini–Hochberg correction, novelty/primacy checks. The tests live in the repo and re-run in CI — a method can't silently rot without anyone noticing.

## Interview Q&A

<details>
<summary>❓ How do you make sure a new A/B analysis method works?</summary>

Run it on a simulation with a known truth. The first test is A/A: at effect 0 the share of "significant" results should sit within noise around α (usually 0.05).

The second is power/coverage: at a realistic effect the method should catch it with the expected probability, and confidence intervals should cover the true value in ~95% of runs. Calibrate on your own data distribution, including production special cases (ratio metrics, peeking, segment cuts).

— Nikita Boyarkin
</details>

<details>
<summary>❓ Why is naive peeking dangerous and what to do about it?</summary>

With constant monitoring of the p-value, the chance of seeing "significance" under the null grows with every look — by the end of the experiment it is far from the advertised 5%.

Either alpha-spending boundaries (Pocock, O'Brien–Fleming), which spend the error budget across looks in advance, or always-valid methods like mSPRT, which allow looking any time without penalty. Both approaches are verified by the same A/A simulation.

— Nikita Boyarkin
</details>

## Links

- [A/B Testing Methodology Toolkit](/projects/ab/) — 15 calibrated modules with simulations
- [Volta Neobank](/projects/volta/) — applied end-to-end: CUPED + A/A test + Bonferroni
- [Why we moved to Bayesian A/B testing](/posts/bayesian-ab-testing/) — an alternative take on peeking