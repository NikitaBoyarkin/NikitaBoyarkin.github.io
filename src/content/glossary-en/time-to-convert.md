---
title: "Time to convert"
description: "Time to convert is the delay from entry to a target action. It shows how fast a cohort converts, not just its final share."
aka: ["time to convert", "time-to-convert"]
category: product
tags: ["cohort-analysis"]
related: ["/glossary/funnel/", "/glossary/cohort/", "/glossary/retention/", "/projects/cohort/"]
keywords: ["time to convert", "conversion", "accumulation"]
updated: 2026-10-01
---

## Definition

Time to convert is the delay from a first interaction to a target action. Instead of a single overall conversion it shows how the share of converted users accumulates over days since entry. This answers how long the product usually takes to "mature" and how quickly a channel pays back.

## How to compute

For a cohort, build the cumulative share converted by day $t$ — the empirical CDF of conversion time. Take the median and percentiles from it, not the mean. To compare channels and segments, overlay curves over the same observation horizon.

## Pitfalls

Unfinished cohorts are censored: later days are not yet filled in, so the share is understated. Conversion time is heavily right-skewed, so the mean misleads and the median is needed. Time to convert does not replace retention: a fast action and long-lasting use are different questions. Fix the observation horizon, or comparison is unfair.

## Related

- Funnel
- Cohort
- Retention
