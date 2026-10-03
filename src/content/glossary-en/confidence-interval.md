---
title: "Confidence interval"
description: "A confidence interval is the range that would contain the true effect at a stated rate across repetitions — unlike a p-value, it shows both the effect size and the uncertainty."
aka: ["confidence interval", "interval estimate"]
category: statistics
tags: ["statistics", "ab-testing"]
related: ["/glossary/p-value/", "/glossary/bootstrap/", "/glossary/mde/", "/glossary/ab-test/"]
keywords: ["confidence interval", "estimate", "uncertainty"]
updated: 2026-10-03
---

## Definition

A confidence interval is a range around a point estimate that would cover the true effect in a stated share of repeated experiments. Its width reflects the uncertainty of the estimate, not the spread of the data itself.

## How to compute

For a mean: the estimate plus or minus a critical value times the standard error. For proportions and ratio metrics, use the delta method or bootstrap. In an A/B test the interval is built for the difference between arms; if it excludes zero, the effect is significant at the same level.

## Pitfalls

The interval does not mean the true effect lies inside one computed range "with 95% probability" — that phrasing is wrong for frequentist statistics. Bootstrap intervals are biased on small samples, and a naive bootstrap understates the width on paired data. A wide interval signals too little data, not a missing effect.
