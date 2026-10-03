---
title: "Retention curve"
description: "A retention curve plots the share of returning users by period after start. Its shape is the signature of the product and its stability."
aka: ["retention curve"]
category: product
tags: ["retention", "cohort-analysis"]
related: ["/glossary/retention/", "/glossary/cohort/", "/glossary/churn/", "/glossary/dau-mau/", "/projects/cohort/"]
keywords: ["retention curve", "plateau", "retention"]
updated: 2026-10-01
---

## Definition

A retention curve is the share of users still active as a function of time since start. It shows a trajectory rather than a single number: how fast the bulk churns and whether the curve flattens into a plateau. The shape distinguishes a product with real habit formation from a one-off one.

## How to compute

For a cohort, compute $R_t$ for each period $t$ and join them into a line, often on a log scale so tail differences are visible. To compare cohorts, normalise curves by age and overlay them. A plateau can be estimated by fitting a decaying function and extrapolating its asymptote.

## Pitfalls

Curves cannot be compared at different lengths or without normalisation. A plateau means part of the audience stayed, not that retention is high. The early segment is the noisiest. Extrapolation without a model misleads: real curves do not always decay monotonically.
