---
title: "p-value"
description: "A p-value is the probability of seeing an effect at least as large as observed when the null hypothesis is true. It is not the chance the effect is random."
aka: ["p-value", "p value"]
category: statistics
tags: ["statistics", "ab-testing"]
related: ["/glossary/statistical-power/", "/glossary/mde/", "/glossary/aa-test/", "/glossary/srm/", "/glossary/bootstrap/", "/projects/ab/"]
keywords: ["p-value", "null hypothesis", "significance"]
updated: 2026-10-01
---

## Definition

A p-value is the probability of observing a test statistic at least as extreme as the one obtained, assuming the null hypothesis is true. It is not the probability that the effect is random, nor $P(H_0 \mid \text{data})$. A small p only shows the data are hard to reconcile with the null; it says nothing about the size of the effect.

## How to compute

Compute it from the test statistic and its null distribution: $p = P(T \ge t_{\text{obs}} \mid H_0)$. Analytically for t- and z-tests, or via a permutation test and the bootstrap when the distribution is unknown. The two-sided version doubles the tail.

## Pitfalls

A p-value does not replace a confidence interval or an effect size: a significant effect can be trivial. Multiple testing inflates the false-discovery share, so apply a correction (BH, Holm). Peeking and stopping on significance inflate the Type I error. A p-value does not prove a hypothesis, it merely fails to reject it.

## Related

- Statistical power
- MDE
- A/A test
- SRM
- Bootstrap
