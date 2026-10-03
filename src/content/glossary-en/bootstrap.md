---
title: "Bootstrap"
description: "The bootstrap estimates a statistic's distribution by resampling with replacement, without relying on asymptotic formulas or normality."
aka: ["bootstrap", "resampling"]
category: statistics
tags: ["statistics", "bayesian"]
related: ["/glossary/p-value/", "/glossary/uplift/", "/projects/causal/"]
keywords: ["bootstrap", "resampling", "confidence interval"]
updated: 2026-10-01
---

## Definition

The bootstrap estimates the distribution of a statistic by repeatedly resampling the data with replacement. Instead of deriving a formula for the standard error, the empirical distribution is built from $B$ resamples of the same size. It works for statistics with no convenient asymptotics: medians, percentiles, ratio metrics, composite business measures.

## How to compute

Draw $B$ resamples of $n$ observations with replacement, compute the statistic on each, and collect the distribution. The confidence interval is the percentile interval of that distribution (say 2.5 and 97.5), or BCa to correct for bias and skew. $B$ is typically 2000–10000.

## Pitfalls

The percentile interval is biased on small samples and skewed statistics. Data are dependent by user, not by row, so you must resample users or the interval comes out falsely narrow. The bootstrap does not fix SRM and does not replace a split check. It refines the standard error but does not raise power dramatically.
