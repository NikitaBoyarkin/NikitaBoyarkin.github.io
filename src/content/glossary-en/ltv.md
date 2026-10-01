---
title: "LTV"
description: "LTV is the total value of a user over their entire lifetime. It is the key benchmark for acquisition and retention economics."
aka: ["LTV", "lifetime value"]
category: business
tags: ["customer-analytics"]
related: ["/glossary/arpu/", "/glossary/churn/", "/glossary/retention/", "/glossary/segmentation/", "/projects/rfm/"]
keywords: ["LTV", "value", "margin"]
updated: 2026-10-01
---

## Definition

LTV (lifetime value) is the total value of a user over their entire lifetime in the product. It is usually measured in margin, not revenue, to reflect true contribution. Historical LTV is observed for completed cohorts, while predicted LTV is an estimate for those still alive, and the two are fundamentally different numbers.

## How to compute

Roughly: $\text{LTV} \approx \text{ARPU in margin} \times \text{average lifetime}$, where lifetime is the inverse of churn. More precisely, sum margin over the cohort's periods of life, discounted. Retention and churn always underpin it: raising retention increases LTV non-linearly.

## Pitfalls

LTV without a horizon and without margin misleads. Never mix revenue and margin: an LTV on revenue overstates the return. A predicted LTV from a short cohort requires extrapolation and is easily overstated. Comparing LTV with CAC is only valid over the same horizon.

## Related

- ARPU
- Churn
- Retention
- Segmentation
