---
title: "Sample Ratio Mismatch (SRM)"
description: "SRM is a gap between the observed and expected split. On a large sample it signals broken randomisation, not random noise."
aka: ["SRM", "Sample Ratio Mismatch"]
category: experiment
tags: ["ab-testing", "statistics"]
related: ["/glossary/aa-test/", "/glossary/cuped/", "/glossary/p-value/", "/projects/ab/"]
keywords: ["SRM", "split", "randomisation"]
updated: 2026-10-01
---

## Definition

Sample Ratio Mismatch is a gap between observed group shares and the intended split. With a planned 50/50, actual 49.7/50.3 on a large sample is not noise but a sign that randomisation, logging, or filtering is broken. SRM poisons the whole test: it distorts both the Type I error and the effect estimate.

## How to compute

Use a chi-square goodness-of-fit test: $\chi^2 = \sum_i (O_i - E_i)^2 / E_i$ with $k-1$ degrees of freedom, where $O_i$ are observed and $E_i$ expected group sizes. Set a strict threshold, $p < 0.001$: with many daily checks, controlling false alarms matters more than sensitivity. Check the split at the funnel entry, not only on collected metrics.

## Pitfalls

SRM is invisible on small samples, so test on full traffic. Bot filtering and survivorship can create or hide a skew. You cannot "fix" SRM by reweighting after the fact: find the cause first, then decide whether the test is usable.
