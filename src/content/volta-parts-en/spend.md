---
title: "Volta — Spend Analysis"
description: "Spend breakdown by category and channel: bills (25.8%) and travel (20.2%) make up nearly half the turnover, groceries is the most frequent category."
star:
  situation: "Where and on what customers spend — the basis for cashback and offer strategy"
  task: "Own the structure of the spend breakdown and its fitness for product decisions"
  action: "Spend aggregation by category, channel and merchant; decline rate by category and monthly trend"
  result: "Bills (25.8%) and travel (20.2%) — nearly half the turnover; groceries most frequent (18,238 transactions, €45.8 ticket)"
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
github: https://github.com/NikitaBoyarkin/case-spend
---

# Volta — Spend Analysis

## Situation

Where and on what customers spend — the basis for cashback and offer strategy.

## Task

I owned the structure of the spend breakdown and its fitness for product decisions.

## Actions

I split spending along several axes at once, so that behind the total you can see the type of expense, the channel and the specific merchant.

- **Aggregation.** Rolled transactions into breakdowns by category, channel and merchant — the same turnover read from three sides.
- **Frequency vs volume.** Compared categories by transaction count and by amount, so the most frequent category is not confused with the largest.
- **Average ticket.** Computed the average ticket by category, to separate frequent small spends from rare large ones.
- **Declines.** Added the decline rate by category as a separate signal about payment quality, not just demand.
- **Trend.** Built a monthly trend to tell a lasting shift from a one-off spike.
- **Tooling.** Python and pandas/NumPy for the aggregations, Matplotlib/Seaborn for the breakdown and the trend.

## Result

- **Bills (25.8%)** and **travel (20.2%)** are the largest categories; together nearly half the turnover.
- **Groceries** is the most frequent (18,238 transactions, €45.8 average ticket).
- Travel is thin-margin (see Project 14).

## Recommendations

- Build cashback/offers around top categories (bills, groceries).
- Watch travel margin as volume grows.
- Monitor the decline rate as a payment-UX signal.

## Documentation

- [GitHub → case-spend](https://github.com/NikitaBoyarkin/case-spend)
