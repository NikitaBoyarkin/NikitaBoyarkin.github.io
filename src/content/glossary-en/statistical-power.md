---
title: "Statistical power"
description: "Statistical power is the probability of detecting an effect of a given size when it truly exists. It equals one minus the Type II error rate."
aka: ["power", "statistical power"]
category: statistics
tags: ["statistics", "ab-testing"]
related: ["/glossary/mde/", "/glossary/p-value/", "/glossary/aa-test/", "/projects/ab/"]
keywords: ["power", "sample size", "Type II error"]
updated: 2026-10-01
---

## Definition

Power is the probability of rejecting the null hypothesis when the true effect equals a specified size. It is written $1-\beta$, where $\beta$ is the Type II error rate. Power of 0.8 means an effect of the required size will be found in 80% of repetitions; in the rest the test misses it and returns a non-significant result.

## How to compute

Power rises with sample size, effect size, and significance level, and falls with variance. For a two-sample mean, approximately: $n \approx 2 (z_{1-\alpha/2} + z_{1-\beta})^2 \sigma^2 / \Delta^2$ per arm. Take the variance from historical data and the effect from the MDE the product deems meaningful.

## Pitfalls

Compute power before the experiment: post-hoc power on an observed effect is meaningless and almost always low. Power does not describe the effect you found; it describes the sensitivity of the design. Several metrics in one test lower the power of each, and CUPED restores it by shrinking $\sigma^2$.
