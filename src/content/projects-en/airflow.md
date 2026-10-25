---
title: Airflow DAG Platform
description: "A report platform on Airflow 3: the full DAG runs in 440 s and the forecast task alone takes 413 s; every report is a versioned DAG with DQ validation, alerts and run metrics."
star:
  situation: "A hand-run report from Postgres into Google Sheets produced delays, copy errors and no reproducibility at all"
  task: "Replace the manual export with a reproducible, idempotent pipeline with DQ validation, failure alerts and run metrics"
  action: "A platform on Airflow 3: the DAG template fetch → validate → write → record_metrics and the shared modules config, dq, alerts, metrics, output, windows"
  result: "Three DAGs on one shared template and 69 tests without Airflow services or a DB; the full DAG runs in 440 s, 413 s of it in the forecast task"
track: engineering
hero: images/airflow.svg
ogImage: /images/og/airflow.png
impact:
  - "Every report is a versioned DAG on a fetch → validate → write → record_metrics template built from @task decorators (Airflow 3 SDK)"
  - "The window is the half-open interval [logical_date − N, logical_date); catchup=False, misses recovered by an explicit backfill"
  - "DQ validation before writing: header, non-negative revenue and orders, and an empty result as a distinct NoDataError"
  - "Observability: every successful run writes a row to dag_metrics, a failure lands in on_failure_callback (alert + failed metric)"
  - "Config comes entirely from Airflow Variables under the AIRFLOW_CFG_ prefix — no hardcoding, and a dev fallback writes CSV instead of Sheets"
  - "Measured run: the full DAG takes 440 s, the forecast task alone 413 s"
tools:
  - Python
  - Apache Airflow 3
  - PostgreSQL
  - Docker Compose
  - Google Sheets API
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/airflow
date: 2026-09-27
updated: 2026-10-25
demo: demos/airflow/index.html
related:
  - /projects/volta/
  - /projects/sql/
faq:
  - question: "Why is a report a DAG and not a script?"
    answer: "A DAG gives versioning, scheduling, retries and run metrics out of the box; a manual SQL client → copy into Sheets leaves none of those traces."
  - question: "What does the DQ validation check?"
    answer: "The result header, non-negative revenue and orders, and an empty result set as a distinct NoDataError — all before the data reaches the sink."
  - question: "How is observability wired?"
    answer: "Every successful run writes a row to dag_metrics (status, duration_s, rows_written, logical_date); failures land in on_failure_callback. scripts/metrics_report.py aggregates success rate and p95."
  - question: "Does it run without external APIs?"
    answer: "Yes: in dev mode AIRFLOW_CFG_sales_report_output=file writes CSV to data/out/, and Google Sheets needs a real service account."
  - question: "How is a new report added?"
    answer: "On the shared-module reuse template: a new DAG is assembled from the same config, dq, alerts, metrics and windows, with no logic copied."
---

# Airflow DAG Platform

**▶ [Data-flow diagram](/diagrams/airflow.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

A hand-run sales report — a SQL client, then a copy of the aggregate into Google Sheets — produced delays, copy errors and no reproducibility. A missed or failed run went unnoticed, and a new report had to be built from scratch.

## Task

I needed to replace the manual export with a reproducible, idempotent pipeline: data reaches the sink on schedule without hand-holding, failures are visible immediately, and a new report is added from a shared template instead of from zero.

## Actions

### DAGs

| DAG | Schedule | What it does | Sink |
|-----|----------|--------------|------|
| `daily_sales_report` | `@daily` | Daily sales aggregate (`sale_date`, `product_id`, `revenue`, `orders`) | Google Sheets (or a CSV fallback) |
| `weekly_sales_summary` | `@weekly` | Weekly summary by `category` (`category`, `revenue`, `orders`) | CSV (Sheets optional) |
| `delivery_control_tower` | manual (`schedule=None`) | 8 tasks: CSV → staging → DQ gate → DuckDB marts → 5 analyses in parallel | files of the `delivery-control-tower` project |

Each DAG follows the `fetch → validate → write → record_metrics` template on Airflow 3 SDK `@task` decorators. The window is the half-open interval `[logical_date − N, logical_date)`; `catchup=False`, with backfill as an explicit command.

### Reusable modules

```
dags/shared/
  config.py    # config from Airflow Variables, no hardcoding
  dq.py        # DQ validation before writing
  alerts.py    # alert format and failure callback
  metrics.py   # observability: writes to dag_metrics
  output.py    # CSV writer (dev fallback), idempotent rewrite
  windows.py   # daily/weekly windows keyed on logical_date
```

### Stack and run

```bash
uv sync
uv run pytest                                 # tests without an Airflow runtime
uv run python scripts/generate_sales_data.py --days 7 --rows-per-day 10000
export AIRFLOW_HOME=$(pwd) && uv run airflow standalone   # UI :8082, login admin, password generated on first run
docker compose up -d --build                  # Postgres + Airflow in containers, no local Airflow needed
uv run python scripts/metrics_report.py --days 7
```

### CI gates

```bash
uv run ruff check .          # lint: E,W,F,I,B,C4,UP
uv run ruff format --check .
uv run mypy                  # dags/, scripts/, tests/
uv run pytest                # 69 tests, hooks mocked
```

## Result

The platform drives three reports to their sink on schedule, each a versioned DAG of its own. Quality rests on four CI gates: `ruff check`, `ruff format --check`, `mypy` and `pytest` all pass across 69 tests that need neither Airflow services nor a live database (hooks are mocked). Configuration is fully externalised into Airflow Variables under the `AIRFLOW_CFG_` prefix, and the dev mode `output="file"` runs without any external API.

- **Measured run:** the full DAG takes 440 s, with the `forecast` task alone at 413 s.

## Limitations

The data source is synthetic (`scripts/generate_sales_data.py`), so the platform is verified on demo data, not on a production stream. Google Sheets as a sink needs a real service account; without it only the CSV fallback remains. This is a portfolio project: Airflow's behaviour under heavy load at large volumes was not measured.

## Documentation

- [GitHub → airflow](https://github.com/NikitaBoyarkin/airflow)
