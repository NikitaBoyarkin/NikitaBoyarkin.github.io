---
title: "ARPU"
description: "ARPU is the average revenue per user over a period. A basic input to LTV and unit economics, sensitive to the mix of the active base."
aka: ["ARPU", "average revenue per user"]
category: business
tags: ["customer-analytics"]
related: ["/glossary/ltv/", "/glossary/dau-mau/", "/glossary/nps/", "/projects/rfm/"]
keywords: ["ARPU", "revenue", "income"]
updated: 2026-10-01
---

## Definition

ARPU (average revenue per user) is the average revenue attributed to a user over a period. It is computed over the whole active base, including non-payers. Its sibling ARPPU divides revenue only by payers, so it is always higher and describes a different audience.

## How to compute

$\text{ARPU} = \text{revenue over the period} / \text{active users over the period}$. The denominator is active users, not all registered ones, or the metric is understated and incomparable across periods. Compute it separately by currency and by product line.

## Pitfalls

ARPU shifts with the composition of the base (mix-shift): a rising ARPU may reflect the churn of cheap users rather than better monetisation. Fix the period — daily and monthly ARPU are not comparable. Never present ARPPU as ARPU. As a ratio metric it needs a correct standard error, usually via the delta method.

## Related

- LTV
- DAU / MAU and stickiness
- NPS
