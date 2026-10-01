---
title: "Retention"
description: "Retention is the share of users who return to the product after their first interaction. It is a core measure of value and stickiness."
aka: ["retention", "user retention"]
category: product
tags: ["retention", "cohort-analysis"]
related: ["/glossary/cohort/", "/glossary/retention-curve/", "/glossary/churn/", "/glossary/funnel/", "/projects/cohort/"]
keywords: ["retention", "return", "cohort"]
updated: 2026-10-01
---

## Definition

Retention is the share of users who return after their first action, over a given period. Classic retention counts those returning strictly on a specific day, rolling retention within a window, and unbounded retention on any day after start. The meaning of the metric depends entirely on how "returned" is defined and which window is used.

## How to compute

Group users into cohorts by start day and, for each period, compute the share still active: $R_t = \text{returned on day } t / N_0$. Assemble the result into a cohort matrix whose columns are periods since start. State the activity definition separately: opening the app, a key action, or a payment.

## Pitfalls

Without an explicit activity definition retention is meaningless: the same number yields different metrics at different thresholds. The first period is the noisiest. Compare cohorts over the same window length. Calendar events and seasonality distort cohort-to-cohort comparisons.

## Related

- Cohort
- Retention curve
- Churn
- Funnel
