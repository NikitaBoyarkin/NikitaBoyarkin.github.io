---
title: "Correlation and causation"
description: "Correlation shows that two quantities move together; causation means one drives the other. A relationship with no mechanism or control does not prove an effect."
aka: ["correlation and causation", "correlation is not causation", "correlation vs causation"]
category: statistics
tags: ["statistics", "causal-inference"]
related: ["/glossary/uplift/", "/glossary/cuped/", "/glossary/bootstrap/", "/glossary/ab-test/"]
keywords: ["correlation", "causation", "confounder"]
updated: 2026-10-03
---

## Definition

Correlation is a statistical association: two quantities move together. Causation claims that changing one makes the other change. Observational data gives the first; only an intervention with a control gives the second.

## How to compute

Test an observed association for confounders: a common factor driving both quantities, or reverse direction. Remove the bias with randomisation (an A/B test), instrumental variables or control methods, and read the effect size and its uncertainty from an interval.

## Pitfalls

The textbook case is seasonality and selection: ice-cream sales and drownings rise together, but the shared cause is summer. Regression controlling for observed variables does not rescue you from unmeasured confounders, nor does it yield a causal estimate. Regression to the mean after a spike or a dip also looks like an intervention effect.
