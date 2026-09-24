---
title: RFM Analysis of Bank Clients
description: "Segmented a bank's clients into 4 RFM groups and showed that a small high-value share drives most revenue. Marketing moved from mass sends to targeted scenarios."
track: analytics
hero: images/rfm.svg
impact:
  - High-value RFM segments identified across the client base
  - Marketing got clear personas for targeting
  - Budget reallocated toward retention and reactivation
tools:
  - Python
  - SQL
  - Tableau
github: https://github.com/NikitaBoyarkin/rfm-analysis-of-bank-clients
updated: 2026-09-17
demo: demos/rfm/index.html
related:
  - /posts/rfm-segmentation-practical/
---

# RFM Analysis of Bank Clients

## Goal

The bank accumulates client transaction data, but marketing campaigns ran "flat": the same offer for everyone. The task is to split the client base into homogeneous segments along three dimensions — **Recency** (when the last purchase happened), **Frequency** (operation count), and **Monetary** (total revenue) — and build a separate retention and growth strategy for each group.

## Data & Method

**Data:** client transaction history, including operation date, amount, and transaction type.

**Analysis steps:**

1. **Cleaning & preparation** — duplicates removed, missing values handled, relevant operation types selected.
2. **RFM metric calculation** per client:
   - Recency: days since last transaction
   - Frequency: number of operations over the period
   - Monetary: total revenue from the client
3. **RFM scoring** — each dimension scored, clients grouped into segments by score combination.
4. **Segment distribution visualization** in Tableau with time and product filters.

**Tools:** Python (Pandas, Scikit-learn), SQL, Tableau.

## Result

Four key groups emerged:

- **High-value customers** — recent, frequent, high-revenue clients. The main contribution to revenue.
- **Medium-value customers** — moderate activity and revenue. Upsell growth potential.
- **Low-value customers** — rare and low-revenue. Inefficient to invest in expensive channels.
- **At-risk customers** — previously active but long inactive. Need reactivation.

Key insight: a small share of high-value clients generates a disproportionate share of revenue, while the at-risk segment decays faster than new-client inflow grows. Marketing got clear personas and moved from mass mailings to segmented scenarios.

## Limitations

The segmentation runs on a historical transaction extract; the card does not disclose its size or observation period, so no effect numbers are given here — only the qualitative result and the group distribution. RFM is a rule, not a model: the score thresholds are set by the analyst and would need revision on a different dataset.

## Documentation

- [GitHub → rfm-analysis-of-bank-clients](https://github.com/NikitaBoyarkin/rfm-analysis-of-bank-clients)
