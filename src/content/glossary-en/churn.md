---
title: "Churn"
description: "Churn is the share of users who stop being active over a period. It is the flip side of retention and a direct input to LTV."
aka: ["churn", "attrition"]
category: product
tags: ["retention", "customer-analytics"]
related: ["/glossary/retention/", "/glossary/ltv/", "/glossary/uplift/", "/glossary/rfm/", "/projects/churn/"]
keywords: ["churn", "attrition", "loss"]
updated: 2026-10-01
---

## Definition

Churn is the share of users who stop being active over a period. It is the flip side of retention: the higher the retention, the lower the churn. Churn is voluntary (the user left) or involuntary (a payment failed), and each has its own mechanics and its own remediation.

## How to compute

Simple churn over a window is $1 - \text{retention}$ for the same period. Periodic churn is the share of users lost out of those active at the start of the period; survival-based churn goes through average lifetime. For subscription businesses, distinguish user churn from revenue churn.

## Pitfalls

Churn without an explicit window and activity definition is meaningless: "churned" depends on the inactivity threshold. Low churn does not mean growth — the product may simply not be acquiring new users. Involuntary churn is treated very differently from voluntary and needs its own cut. Averaging over the whole base hides segments with churn several times higher.

## Related

- Retention
- LTV
- Uplift modelling
- RFM segmentation
