---
title: "Minimum detectable effect (MDE)"
description: "The MDE is the smallest effect a test can reliably detect given its sample size, significance level, and power."
aka: ["MDE", "minimum detectable effect"]
category: statistics
tags: ["statistics", "ab-testing"]
related: ["/glossary/statistical-power/", "/glossary/p-value/", "/glossary/srm/", "/glossary/cuped/", "/projects/ab/"]
keywords: ["MDE", "sensitivity", "effect"]
updated: 2026-10-01
---

## Definition

The MDE is the smallest effect size a test will detect with a given power, at significance level $\alpha$ and the available sample. It is a property of the design's sensitivity, not a forecast: the MDE states which effects the test can distinguish from noise at all.

## How to compute

Solving the power formula for the effect in a two-arm test: $\Delta = (z_{1-\alpha/2} + z_{1-\beta}) \sqrt{2\sigma^2 / n}$. The value is inversely proportional to the square root of the sample: to catch half the effect you need four times the observations. Estimate $\sigma^2$ from historical data on the same metric.

## Pitfalls

The MDE depends on variance, so CUPED lowers it directly. Never confuse the MDE with the expected effect: a small MDE means high sensitivity, not that an effect exists. Computing the MDE on a peeked sample is invalid. Ratio metrics need a correct standard error, or the MDE comes out too optimistic.

## Related

- Statistical power
- p-value
- SRM
- CUPED
