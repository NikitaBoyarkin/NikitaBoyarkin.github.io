---
title: RFM Analysis of Bank Clients
description: "Segmented a bank's clients into 6 RFM segments: the top 20% hold 38.2% of revenue (Gini 0.324). Synthetic dataset — 1,983 clients, 9,492 transactions."
star:
  situation: "The bank accumulates client transactions, but marketing sends everyone the same offer"
  task: "Replace the single offer with targeted segments, each with its own retention strategy"
  action: "Cleaned the transactions, scored Recency, Frequency and Monetary, segmented clients, visualized the distribution in Tableau"
  result: "Six named segments; the top 20% of clients hold 38.2% of revenue (Gini 0.324), and Champions — 6.4% of the base — drive 12.1% of revenue"
track: analytics
hero: images/rfm.svg
ogImage: /images/og/rfm.png
impact:
  - High-value RFM segments identified across the client base
  - "Revenue concentration measured, not asserted: the top 20% of clients hold 38.2% of revenue (Gini 0.324)"
  - At Risk + Hibernating ≈ 50% of the base — the main reactivation pool
  - Marketing got clear personas for targeting
tools:
  - Python
  - SQL
  - Tableau
github: https://github.com/NikitaBoyarkin/rfm-analysis-of-bank-clients
date: 2025-12-06
updated: 2026-10-12
demo: demos/rfm/index.html
related:
  - /posts/rfm-segmentation-practical/
---

# RFM Analysis of Bank Clients

## Situation

The bank accumulates client transaction data, but marketing campaigns ran "flat": the same offer for everyone. The task is to split the client base into homogeneous segments along three dimensions — **Recency** (when the last purchase happened), **Frequency** (operation count), and **Monetary** (total revenue) — and build a separate retention and growth strategy for each group.

## Task

I needed campaigns to stop sending the same offer to every client, so I owned the split of the client base along recency, frequency, and monetary value, and the separate retention strategy that follows for each group.

## Actions

**Data:** synthetic transaction history (seed = 42): 10,000 transactions → 9,492 after the anomaly drop, **1,983 active clients**, period 2023-01-01 → 2024-03-30.

**Analysis steps:**

1. **Cleaning & preparation** — duplicates removed, rows flagged `is_anomaly` dropped.
2. **RFM metric calculation** per client:
   - Recency: days since last transaction
   - Frequency: number of operations over the period
   - Monetary: total revenue from the client
3. **RFM scoring** — each dimension scored in quartiles 1..4; segments are combo-based, not sum-based (so `444` and `233` no longer share a bucket).
4. **Business-sense check** — Lorenz curve and Gini coefficient, plus per-segment `concentration_ratio`.
5. **Segment distribution visualization** in Tableau with time and product filters.

**Tools:** Python (Pandas, Scikit-learn), SQL, Tableau.

## Result

**Six named segments** emerged (quartile-score combinations):

- **Champions** (R≥4, F≥4, M≥4) — 126 clients, 6.4% of the base, driving **12.1% of revenue** (concentration ratio 1.91).
- **Loyal** — loyal clients, just below Champions on all three axes.
- **Potential Loyalists** — recent with moderate frequency: upsell potential.
- **At Risk** — previously active but long inactive: need reactivation.
- **Hibernating** — 643 clients, 32% of the base, under-indexing on revenue (ratio 0.61).
- **Need Attention** — the remaining combinations.

Revenue concentration is measured, not asserted: **Gini = 0.324**, and the top 20% of clients hold **38.2%** of revenue. At Risk + Hibernating ≈ **50%** of the base — the main reactivation pool, described as concrete personas for targeting.

## Limitations

The segmentation runs on a synthetic, reproducible extract (seed = 42) — the effect size here is not the point; the value is the scoring methodology and the concentration check. RFM is a rule, not a model: the score thresholds are set by the analyst and would need revision on a different dataset.

## Documentation

- [GitHub → rfm-analysis-of-bank-clients](https://github.com/NikitaBoyarkin/rfm-analysis-of-bank-clients)
