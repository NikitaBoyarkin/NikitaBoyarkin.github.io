---
title: "Why the aggregate lies: cohort retention triangles"
date: 2026-08-10
updated: 2026-08-23
category: guide
image: /images/og/cohort-triangles-retention.png
tags:
  - retention
  - cohort-analysis
  - python
  - pandas
excerpt: "Average retention across all cohorts mixes customers with different lifetimes and lies upward. How to build a triangular cohort matrix, read observation age, and compare cohorts honestly."
related:
  - /projects/cohort/
  - /posts/cohort-retention-guide/
  - /posts/ab-calibration-simulation/
  - /projects/volta/
  - /posts/volta-neobank-case-study/
keywords:
  - cohort retention matrix
  - retention triangle pandas
  - observation age cohorts
  - why average retention lies
  - cohort retention ltv
draft: false
---

## Short version

"Our retention is 45%" — usually that's an average across all cohorts. And it almost always lies upward. Why: at the cut date, young cohorts have little "age", and their high early values (R1 for a one-month-old cohort ≈ 100%) drag the average up. Old cohorts that have actually survived to month 12 are barely represented in that average.

The honest picture is a **triangular cohort matrix**: rows = cohorts (acquisition month), columns = age (months since start), cells = share of survivors. The bottom-right triangle is empty — that's not "no data", it's cohorts that haven't reached that age yet.

## Example

Building the matrix in pandas: for each "cohort × age" pair, count unique users.

```python
import pandas as pd

# One row per user-month: user_id, cohort (signup month), age (month since signup), active (0/1)
# df = ...

retention = (
    df.groupby(["cohort", "age"])["user_id"]
    .nunique()
    .unstack("age")
)
```

The user count at `age = 0` is the cohort size. Divide every column by the cohort size to get the share of survivors.

```python
size = retention[0]
retention_pct = retention.div(size, axis=0)
```

## How to write it

1. Define the cohort — by an acquisition event (signup, first purchase), not by calendar.
2. Define age — a whole number of periods since the cohort (days, weeks, months).
3. Define "survived" — what counts as activity: any event, a paying event, a session.
4. Pivot to cohort × age and normalize by cohort size.
5. Leave the diagonal / bottom-right triangle empty — that's where you cut in the `observation age`.

## How to understand it

### Why the average across all cohorts lies

Take the cut "right now". It contains cohorts aged 0 to 36 months. Averaging over rows mixes "1 month after launch" (holding ~40–50%) with "36 months" (holding ~10–15%). The average lands around 25% and says nothing about the product or any single cohort. The only honest question — "what share of cohort X survived to age Y" — is answered by the triangle.

### Observation age — the main pitfall

A 12-month-old cohort has no data for month 24 — and never will until it lives through it. If you fill those cells with zeros and average, retention "drops" simply because the cut is early. The empty triangle is a feature: it literally shows these cohorts aren't old enough for conclusions yet.

### Compare cohorts only at the same age

"The new cohort is better than the old one" — only when comparing R1 to R1, R3 to R3. Comparing "new average" to "old average" catches the age effect, not quality. Product conclusions are built along horizontals and "age-for-age".

### ARPU/LTV: the same trap

Cohort LTV is the sum of revenue across ages. For a young cohort only the tail up to the current cut is available — LTV is underestimated, and that's not an error, it's under-observation. Reports must say "LTV over 6 observed months", not "LTV".

## Tips

- Fix the cohort size at `age = 0` and never change it: the denominator must be identical for every column.
- Don't fill the empty triangle with zeros — you'll get a fake "drop" from the cut moving.
- Define "survived" by one rule for all cohorts, or comparison breaks.
- For weekly/monthly products pick age to fit the cycle: subscriptions survive 12 months, retail — a season.
- Watch that new cohorts don't "hog" the first row of the matrix via small age.

## In practice

In the [Cohort Analysis Dashboard](/projects/cohort/) the triangular matrix with triangular decay is built on synthetic data: signup-month cohorts, month ages, retention and ARPU/LTV with an explicit observation-age caveat.

The analysis folder is assembled into a pandas + matplotlib/seaborn pipeline, and the output exports to CSV and a `.hyper` extract for Tableau. The same matrix powers the [Volta](/projects/volta/) write-up: retention was read along triangle diagonals, not from the "average".

## Interview Q&A

<details>
<summary>❓ Why can't retention be computed as the average across all cohorts?</summary>

Because at the cut date cohorts have different ages, and averaging mixes "young" cohorts (month one, high values) with "old" ones (survived to month 12, low values). The average is inflated and answers no practical question. The right question — "what share of cohort X survived to age Y" — is answered by the triangular matrix, where each cell is its own cohort at its own age.

— Nikita Boyarkin
</details>

<details>
<summary>❓ What do you do with the empty bottom-right corner of the matrix?</summary>

Nothing — leave it empty and label it as observation age. Those cohorts haven't lived through the corresponding age yet. Filling with zeros and averaging produces a fake retention "drop" unrelated to the product. If you need a column average, compute it only over cohorts that have already reached that age, and say so explicitly.

— Nikita Boyarkin
</details>

## Links

- [Cohort Analysis Dashboard](/projects/cohort/) — triangular matrix + ARPU/LTV with the observation-age caveat
- [Cohort retention guide](/posts/cohort-retention-guide/) — the basics of the matrix and its limits
- [Volta case study](/posts/volta-neobank-case-study/) — retention read from triangle diagonals