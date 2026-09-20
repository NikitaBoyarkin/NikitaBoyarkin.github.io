---
title: "Volta — Spend Analysis"
description: "Spend breakdown by category and channel: bills (25.8%) and travel (20.2%) make up nearly half the turnover, groceries is the most frequent category."
part: spend
order: 10
layer: extended
impact:
  - "Bills 25.8% and travel 20.2% — nearly half the turnover"
  - "Groceries — 18,238 transactions"
  - "Decline rate and monthly trend"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "spend-by-category"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Spend Analysis

## Context

Where and on what customers spend — the basis for cashback and offer strategy.

## Data & Method

- Spend aggregation by category/channel/merchant.
- Decline rate by category, monthly trend.

## Findings

- **Bills (25.8%)** and **travel (20.2%)** are the largest categories; together nearly half the turnover.
- **Groceries** is the most frequent (18,238 transactions, €45.8 average ticket).
- Travel is thin-margin (see Project 14).

## Recommendations

- Build cashback/offers around top categories (bills, groceries).
- Watch travel margin as volume grows.
- Monitor the decline rate as a payment-UX signal.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
