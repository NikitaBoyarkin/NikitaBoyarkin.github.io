---
title: "Segmentation"
description: "Segmentation splits a base into homogeneous groups by behaviour or value, so different groups receive different treatment."
aka: ["segmentation", "customer segmentation"]
category: data
tags: ["segmentation", "rfm"]
related: ["/glossary/rfm/", "/glossary/cohort/", "/glossary/churn/", "/glossary/ltv/", "/projects/rfm/"]
keywords: ["segmentation", "clusters", "segments"]
updated: 2026-10-01
---

## Definition

Segmentation is the division of users into groups that are similar in behaviour or value within a group and different between groups. Segments are rule-based (RFM, metric thresholds) or discovered algorithmically (clustering). The goal is the same: different groups need a different product and a different message.

## How to compute

First choose the axes — behaviour, value, channel, lifecycle. Rule-based segments are set by metric thresholds. For clustering, normalise features and feed them to k-means, hierarchical clustering, or a mixture model; pick the number of clusters by internal metrics and by interpretability.

## Pitfalls

A segment with no action delivers nothing — start from a hypothesis and an intervention, then split. Clusters overfit noise and fall apart on a rerun. Segment composition drifts over time, so recompute regularly. Mixing behavioural and value axes in one split yields uninterpretable groups.
