---
title: "RFM segmentation"
description: "RFM segmentation splits customers by recency, frequency, and monetary value. A classic rule-based way to find valuable and lapsing segments."
aka: ["RFM", "RFM segmentation"]
category: data
tags: ["rfm", "segmentation"]
related: ["/glossary/segmentation/", "/glossary/ltv/", "/glossary/churn/", "/projects/rfm/"]
keywords: ["RFM", "segmentation", "recency"]
updated: 2026-10-01
---

## Definition

RFM is a segmentation method built on three behavioural axes: Recency (how recently a customer bought), Frequency (how often), and Monetary (how much). Each customer gets a score per axis, and the combination of scores defines a segment. The method needs no training and is directly interpretable by the business.

## How to compute

Build 1–5 scores per axis from the base's percentiles, giving a triple such as 5-4-5. Define segments by rules: "champions" are high R, F, M; "at risk" are high F, M with low R. Then assign an action to each segment: retain, reactivate, upsell.

## Pitfalls

Bin boundaries are arbitrary and strongly change the result, so choose them deliberately rather than by default. Monetary correlates with Frequency, so two axes partly duplicate each other. On a small base the scores are noisy. A segment with no assigned action is useless: the point of RFM is working the groups, not drawing a chart.
