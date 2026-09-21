---
title: SQL Analytics Case Study
description: "26 SQL cases: 25 on a ~183k-event synthetic dataset + 1 real-data case on UCI Online Retail II. Funnel, retention, LTV, attribution, anomalies, plus a dbt layer. Runs on DuckDB with one command; live report on GitHub Pages."
track: analytics
hero: images/sql.svg
impact:
  - 26 self-contained SQL cases (funnel → RFM) + 1 real-data case
  - dbt model layer on DuckDB (staging → marts, 17 dbt tests)
  - Regression tests with deterministic invariants per case
  - Synthetic deterministic data (seed=42 + additive seed=43) + UCI Online Retail II
  - Live interactive report on GitHub Pages
tools:
  - SQL
  - dbt
  - DuckDB
  - Python
  - pandas / NumPy
  - pytest
github: https://github.com/NikitaBoyarkin/sql-analytics-case-study
updated: 2026-09-19
demo: https://nikitaboyarkin.github.io/sql-analytics-case-study/
caseStudy:
  problem: "An analyst needs to show SQL skill on product tasks, but there is no production data, and textbook exercises do not demonstrate systems thinking. How do you prove SQL is a working tool rather than a set of memorised syntax?"
  approach: "26 end-to-end cases: 25 on a synthetic dataset (seed=42, ~183k events, 20k signups) plus 1 on the real UCI Online Retail II data. Each case is one self-contained .sql file with the question and approach in a leading comment. DuckDB builds the data and the database in one command, with no server or credentials. Regression tests with deterministic invariants protect the SQL from regressions. A second batch (churn, refunds, Pareto, anomaly detection, upsell conversion) was added on a separate RNG stream (seed=43) — the first 20 cases' numbers did not change. Plus a dbt layer (staging → marts, 17 tests) and a real-data table loaded from a committed parquet."
  result: "26 cases from funnel to RFM: sessionization validated against ground truth (99.6%), lifecycle composition, a revenue-retention triangle, an in-SQL z-test for A/B, MAD anomaly analysis, dbt parity on the same numbers, and a real-data case where the same SQL yields the opposite business conclusion (72.4% repeat vs 3.5%). The cases are self-checking: pytest + dbt confirm the SQL keeps returning the expected metrics. The report is published to GitHub Pages automatically."
  metrics:
    - label: "SQL cases"
      value: "26"
    - label: "Dataset events"
      value: "~183k"
    - label: "Real-data rows"
      value: "1.07M"
    - label: "Tests (pytest + dbt)"
      value: "43 + 17"
---

# SQL Analytics Case Study

## Goal

A take-home format: prove SQL skill on product tasks when there is no production data, and textbook exercises do not demonstrate systems thinking. 25 end-to-end cases on a synthetic product dataset **plus one real-data case** on UCI Online Retail II. Each case is one self-contained `.sql` file with the question and approach in a leading comment. No server, no credentials — a single command builds the data and a DuckDB database. Plus a **dbt layer** (staging → marts, 17 tests) on the same database.

## Data & Method

**Data model** (synthetic, seed=42, deterministic):

| Entity | Volume | Fields |
|---|---|---|
| **Users** | 20,000 signups (Jan–Jun 2024) | `channel`, `country`, `device`, `ab_variant` |
| **Events** | ~183k funnel events | `app_open → view_item → add_to_cart → checkout → purchase`, ~80k sessions |
| **Orders** | 928 purchases | amount, product category |
| **Subscriptions** | 268 conversions | monthly / annual plans |
| **Cancellations** (seed=43) | 98 | `subscription_cancellations` |
| **Refunds** (seed=43) | 53 | `refunds` |
| **Online Retail II** (real) | 1,067,371 rows | UCI dataset 502, CC BY 4.0 — case 26 |

Schema: `data/schema.sql`. Generator: `data/generate_data.py`. Engagement decays geometrically from signup; retention is weighted by acquisition channel. Additive tables (cases 21–25) are generated on a separate RNG stream (seed=43) so the seed-42 numbers in cases 1–20 never move. The real-data table (case 26) is loaded from a committed parquet (`data/realdata/`) into the same database.

**25 cases:**

| # | Case | Technique |
|---|---|---|
| 01 | Funnel conversion | cumulative counts, `LAG` / `FIRST_VALUE` |
| 02 | N-day retention by cohort | `DATE_TRUNC('month', signup_date)` |
| 03 | Rolling 30-day retention | `EXISTS` subqueries per window |
| 04 | DAU / MAU / stickiness | trailing-28d range join |
| 05 | LTV by cohort | left join + `COALESCE` for zero-revenue |
| 06 | Top-N categories per country | `ROW_NUMBER() OVER (PARTITION BY ...)` |
| 07 | Cumulative revenue | `SUM() ... UNBOUNDED PRECEDING` |
| 08 | Longest active-day streak | gaps-and-islands (`row_number` → island key) |
| 09 | A/B conversion by variant | in-SQL z-test + p-value (Abramowitz–Stegun) |
| 10 | Revenue attribution | first-touch vs lifetime, correlated subquery |
| 11 | 7-day moving average of DAU | `AVG() OVER (... ROWS BETWEEN 6 PRECEDING ...)` |
| 12 | Top-2 revenue users per country | `QUALIFY` |
| 13 | Monthly revenue by category | `PIVOT` long → wide |
| 14 | Subscription MRR | recursive CTE (billing rows per subscription) |
| 15 | Order amount distribution | `MEDIAN`, `QUANTILE_CONT` (p90/p99) |
| 16 | Sessionization + session depth | gaps-and-islands on timestamps, validation vs ground truth |
| 17 | Weekly lifecycle (new/returning/resurrecting/dormant) | state transitions, `LAG`/`LEAD` |
| 18 | Cohort revenue retention (triangle) | months-since-signup, % of period-0 |
| 19 | Repeat purchase & time between orders | `LAG` within user |
| 20 | RFM segmentation | `NTILE` quintiles, segment-score rules |
| 21 | Subscription churn (logo & MRR) | monthly churn, `FILTER` aggregates |
| 22 | Refunds & net revenue | left join, gross-vs-net |
| 23 | Pareto / revenue concentration | `NTILE(10)`, cumulative-share curve |
| 24 | Daily revenue anomaly detection | robust MAD z-score, rolling baseline |
| 25 | Purchase → subscription conversion | join to subscriptions, time-to-convert |
| 26 | **Real data** — repeat purchase & concentration | invoice→customer rollup, order-count buckets, revenue shares |

### Quick start

```bash
uv run python data/generate_data.py   # data/analytics.duckdb (incl. real-data table)
uv run python run.py            # list cases
uv run python run.py 1          # run case 1
uv run python run.py 26         # real-data case
uv run --extra dev pytest -q    # 43 regression tests
uv run python scripts/report.py # reports/index.html
cd dbt && uv run dbt build --profiles-dir .   # dbt: models + 17 tests
```

The runner prints the case question, executes the SQL against `data/analytics.duckdb`, and renders the result as a table. The charted report is published to GitHub Pages automatically on every push.

## Result

Each case covers a specific window-function pattern, and the findings are honest rather than engineered. Three teaser signals (numbers pinned to `cases.md`):

- the funnel drops **54%** at add-to-cart → checkout;
- retention falls from **~21%** (D1) to **~5%** (D30) — the leak is the onboarding window;
- only **3.5%** of buyers repeat (896 buyers, 31 repeat) — a one-and-done purchase engine.

Also:

- RFM degenerates into a recency story; the top decile delivers only 22% of revenue (no whales);
- logo churn climbs to ~15%/month even as MRR compounds;
- sessionization reproduces 80k pre-assigned sessions at **99.6%** fidelity;
- **real data flips the conclusion**: on UCI Online Retail II, 72.4% of customers repeat and the top 15% drive 65% of revenue — same SQL, opposite business answer.

Splitting question and SQL in one file plus regression invariants makes the cases self-checking: 43 pytest tests and 17 dbt tests keep `cases.md` and the code in sync, and `dbt build` is green in CI.

## Limitations

25 of 26 cases are synthetic: their numbers describe the shape of generated data, not a real product's behavior. Case 26 on UCI Online Retail II shows how far the conclusion can flip on real data (72.4% repeat vs 3.5%) — that is the honest boundary of applicability: the SQL patterns transfer, the specific metrics do not.

## Documentation

- [Live report → nikitaboyarkin.github.io/sql-analytics-case-study](https://nikitaboyarkin.github.io/sql-analytics-case-study/)
- [GitHub → sql-analytics-case-study](https://github.com/NikitaBoyarkin/sql-analytics-case-study)
