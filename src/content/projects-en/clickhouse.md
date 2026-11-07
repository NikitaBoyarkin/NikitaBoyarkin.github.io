---
title: ClickHouse — ten SQL cases on 50M rows
description: "Nine SQL cases on 50 million events plus an optimisation that leaves the query text untouched: a projection reads a key range instead of a full scan, and seven DuckDB twins cross-check every case."
star:
  situation: "ClickHouse cases were checked by eye: the result snapshot was not bound to the SQL files, and the optimisation win mixed a rewritten query with a schema change"
  task: "I needed a lab where every case is scored against a snapshot and an independent engine, and the optimisation win is measured with the query text held constant"
  action: "50M synthetic events in MergeTree, ten cases from windowFunnel to RFM, DuckDB twins for seven of them, a projection on product_id, and a test asserting the slow and fast SQL are byte-identical"
  result: "The snapshot and seven DuckDB twins agree, slow and fast SQL are pinned as identical by a test, and the projection clears the ≥10× speed-up threshold the suite asserts on a full scan"
track: engineering
dataset: synthetic
hero: images/clickhouse.svg
ogImage: /images/og/clickhouse.png
impact:
  - "50,000,000 events in MergeTree, partitioned by month and ordered by date and user"
  - "10 SQL cases: funnel, retention, sessions, gaps-and-islands, LIMIT BY, LTV, argMin/argMax attribution, RFM, uniq and optimisation"
  - "7 DuckDB twins check the results against an independent engine; a divergence means a dialect semantic change, not a wrong engine"
  - "56 static tests without Docker and 3 integration tests against a live server; CI asserts the snapshot stays in the repository"
  - "The projection on product_id clears the ≥10× threshold; PREWHERE and bloom_filter are documented as empty levers with the reason"
tools:
  - ClickHouse
  - DuckDB
  - SQL
  - Python
  - Docker Compose
  - pytest
  - uv + ruff
date: 2026-11-01
updated: 2026-11-01
github: https://github.com/NikitaBoyarkin/clickhouse-analytics
bet: "The bottleneck is not syntax: the same SQL on a projection reads a key range instead of a full scan, so the win can be attributed to the schema rather than to a rewritten query."
failureBar: "A case is accepted only if the snapshot, the SQL file and an independent DuckDB twin agree, and the slow and fast SQL are byte-identical — otherwise it measures rewriting, not the schema."
retro: "Two of the three textbook levers turned out empty: PREWHERE is applied automatically, and bloom_filter is useless when insertion order is random against product_id. The negative result stayed in the case instead of being dropped."
related:
  - /projects/sql/
  - /projects/airflow/
---

# ClickHouse — ten SQL cases on 50M rows

## Situation

ClickHouse shows a pretty query plan and misleads just as easily: the dialect differs from familiar SQL, `uniq` returns an estimate, and `avg(amount)` over an event table is not an average order value. Cases assembled by eye look convincing and disagree with the data on the first recount.

Optimisation has a separate problem. Rewrite the query and add a projection at the same time, and the win cannot be attributed to either change.

## Task

I needed a lab where every case is scored against a snapshot and an independent engine, and the optimisation win is measured with the query text held constant.

## Actions

**Data.** Generated 50,000,000 events: users, products, channels, amounts. The `MergeTree` table is partitioned by month and ordered by `(event_date, user_id)`; the seed is fixed and the parquet file is about 600 MB.

**Ten cases.** A `windowFunnel` funnel, cohort retention, 30-minute sessions, gaps-and-islands, `LIMIT BY`, cohort LTV, `argMin/argMax` attribution, RFM, approximate `uniq`, and the tenth case — optimisation.

**Cross-engine checks.** Wrote a DuckDB twin for seven cases: the same question, a different engine. A divergence signals dialect semantics rather than a "correct" engine. Tolerances are explicit: 0.01 absolute and 1e-9 relative.

**Optimisation without rewriting.** Kept `slow.sql` and `fast.sql` byte-identical — asserted by a test, not a comment. The only change is `ADD PROJECTION ... ORDER BY product_id`, after which the same query reads a key range instead of a full scan.

**Negative results.** Tested `PREWHERE` and `bloom_filter`: ClickHouse applies the first automatically, and the second is useless because insertion order is random against `product_id`, so it matches almost every granule. Both findings are recorded in the case.

**Checks.** 56 static tests run without Docker: they bind snapshot keys, SQL files and the `run.py` resolver, forbid module-level `skipif`, and assert slow and fast SQL are identical. Three integration tests need a live server and skip without one.

## Result

- **Volume:** 50,000,000 events; purchase share 0.1800 (9,001,288 type-4 events), average payment 252.54.
- **Cohort LTV:** the largest cohort has 810,757 users, 81.3% payers, LTV-30 per user 418.81, and AOV-30 among payers 515.17.
- **Approximate `uniq`:** 1,001,936 against an exact 1,000,000, an error of 0.1936%.
- **Sessions:** 49,711,224 sessions under the 30-minute rule.
- **Cross-engine:** the snapshot and seven DuckDB twins agree within the stated tolerances.
- **Optimisation:** slow and fast SQL are identical, and the projection clears the **≥10×** speed-up threshold on a full scan.
- **Tests:** **56** static tests without a server and **3** integration tests; CI separately asserts that `expected.json` has not dropped out of the repository.

## What I learned

The gap between "the query works" and "the query is proven" is an external reference. A snapshot pins the expected answer, an independent engine checks dialect semantics, and a divergence between them reads as a signal about engines rather than grounds for picking the "right" one. The same move ports to any SQL work: correctness has to be checked against something that is not the same engine.

The boundary rests on what here followed from a constraint. Slow and fast SQL are pinned byte-identical by a test, because otherwise the win cannot be attributed to the schema; a speed-up threshold is recorded instead of a measured curve, because EXPLAIN and the benchmark are not attached; integration tests skip without Docker, so CI checks neither snapshots nor the speed-up. The two empty levers are a result, not a failure: the negative finding stayed in the case instead of being dropped.

## Discussion points

- **Why DuckDB and not a second ClickHouse server.** A different engine tests dialect semantics, while a second server of the same engine would reproduce the same mistake.
- **Why optimise without rewriting the query.** Change the SQL and the schema at once and the win belongs to neither change — what remains is belief, not measurement.
- **Where the claim ends.** Integration tests skip without Docker, so CI checks neither the snapshots nor the speed-up: the threshold is pinned, the curve is not measured.
- **What I would change on business data.** The fixture carries no product signal, so I would add tolerances for source drift and state what a cross-engine divergence means for the report.

## Limitations

The dataset is a benchmark fixture, not business data: channels and products carry no signal and correlations with the amount are near zero. The cases test SQL and schema correctness, not product conclusions.

`amount` is structurally zero-inflated: 82.0% of values are zero and non-zero values coincide with purchases. `avg(amount)` is therefore not an average order value; the README states this.

`data/seed.parquet` is not committed, weighs about 600 MB and is rebuilt locally. The `expected.json` snapshot predates the current generator, so numbers may move after the parquet is deleted — a known limitation of the case, not a guarantee of permanent reproducibility.

Integration tests skip without Docker, so CI checks neither the snapshots nor the speed-up. `EXPLAIN` before and after and `clickhouse-benchmark` p50/p95 are not attached: the case pins a speed-up threshold, not a measured curve.

## Documentation

- `README.md` — the ten cases, the numbers and the boundaries of the claim.
- `cases.md` — each case: question, query, result, what it proves.
- Quick start: `docker compose up -d` → `uv sync --all-groups` → `uv run python scripts/seed.py` → `uv run python scripts/run.py`.
- Without a server: `uv run python scripts/run.py --duck-only` — DuckDB twins against the snapshot.
