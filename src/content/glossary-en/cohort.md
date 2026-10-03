---
title: "Cohort"
description: "A cohort is a group of users sharing a common start time or event. It is the foundation of cohort-based retention analysis."
aka: ["cohort", "cohort analysis"]
category: product
tags: ["retention", "cohort-analysis"]
related: ["/glossary/retention/", "/glossary/retention-curve/", "/glossary/segmentation/", "/glossary/time-to-convert/", "/projects/cohort/"]
keywords: ["cohort", "start", "retention"]
updated: 2026-10-01
---

## Definition

A cohort is a group of users sharing a common entry signal, typically the week or month of their first action. Cohort analysis fixes the start moment and observes what happens to the group afterwards. This separates the effect of product and traffic changes from the illusions of aggregate metrics.

## How to compute

Tag users with a cohort by start date and, for each cohort, compute the metric by period of life (day 1, 7, 30). Assemble a "cohort × period" matrix. Compare cohorts at the same age — a young cohort's day 30 cannot be matched against an old cohort's day 90.

## Pitfalls

Small cohorts are noisy, so an effect is easily mistaken for a trend. Mix-shift between cohorts distorts comparison: the product may have changed its acquisition channel. Calendar period and cohort age are different axes; confusing them explains the product by seasonality. An aggregate without a cohort split hides failures in new groups.
