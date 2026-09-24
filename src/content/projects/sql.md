---
title: SQL Analytics Case Study
description: "26 SQL-кейсов: 25 на синтетическом датасете (~183k событий) + 1 real-data на UCI Online Retail II. Воронка, retention, LTV, атрибуция, аномалии, dbt-слой. Запуск на DuckDB одной командой, живой отчёт на GitHub Pages."
track: analytics
hero: images/sql.svg
impact:
  - 26 self-contained SQL-кейсов (funnel → RFM) + 1 real-data кейс
  - dbt-слой на DuckDB (staging → marts, 17 dbt-тестов)
  - Regression-тесты с детерминированными инвариантами на каждый кейс
  - Синтетика seed=42 (+ аддитивный seed=43) и UCI Online Retail II
  - Живой интерактивный отчёт на GitHub Pages
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
---

# SQL Analytics Case Study

## Задача

Take-home–формат: показать владение SQL на продуктовых задачах, когда продакшен-данных нет, а учебные задачи не демонстрируют системное мышление. 25 end-to-end кейсов на синтетическом продуктовом датасете **плюс один real-data кейс** на UCI Online Retail II. Каждый кейс — один самодостаточный `.sql` файл с вопросом и подходом в leading-комментарии. Без сервера, без кредов — одна команда строит данные и базу DuckDB. Дополнительно — **dbt-слой** (staging → marts, 17 тестов) на той же базе.

## Данные и метод

**Модель данных** (синтетическая, seed=42, детерминированная):

| Сущность | Объём | Поля |
|---|---|---|
| **Users** | 20,000 signups (Jan–Jun 2024) | `channel`, `country`, `device`, `ab_variant` |
| **Events** | ~183k funnel-событий | `app_open → view_item → add_to_cart → checkout → purchase`, ~80k sessions |
| **Orders** | 928 покупок | amount, product category |
| **Subscriptions** | 268 конверсий | monthly / annual plans |
| **Cancellations** (seed=43) | 98 | `subscription_cancellations` |
| **Refunds** (seed=43) | 53 | `refunds` |
| **Online Retail II** (real) | 1,067,371 строк | UCI датасет 502, CC BY 4.0 — кейс 26 |

Схема: `data/schema.sql`. Генератор: `data/generate_data.py`. Engagement геометрически убывает от signup; retention взвешен каналом привлечения. Аддитивные таблицы (кейсы 21–25) генерируются на отдельном RNG-потоке (seed=43) — числа кейсов 1–20 не меняются. Real-data таблица (кейс 26) грузится из закоммиченного parquet (`data/realdata/`) в ту же базу.

**25 кейсов:**

| # | Кейс | Техника |
|---|---|---|
| 01 | Funnel conversion | cumulative counts, `LAG` / `FIRST_VALUE` |
| 02 | N-day retention by cohort | `DATE_TRUNC('month', signup_date)` |
| 03 | Rolling 30-day retention | `EXISTS` subqueries per window |
| 04 | DAU / MAU / stickiness | trailing-28d range join |
| 05 | LTV by cohort | left join + `COALESCE` для zero-revenue |
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
| 16 | Sessionization + session depth | gaps-and-islands на timestamps, валидация vs ground truth |
| 17 | Weekly lifecycle (new/returning/resurrecting/dormant) | state transitions, `LAG`/`LEAD` |
| 18 | Cohort revenue retention (triangle) | months-since-signup, % of period-0 |
| 19 | Repeat purchase & time between orders | `LAG` внутри пользователя |
| 20 | RFM segmentation | `NTILE` quintiles, segment-score rules |
| 21 | Subscription churn (logo & MRR) | monthly churn, `FILTER` aggregates |
| 22 | Refunds & net revenue | left join, gross-vs-net |
| 23 | Pareto / revenue concentration | `NTILE(10)`, cumulative-share curve |
| 24 | Daily revenue anomaly detection | robust MAD z-score, rolling baseline |
| 25 | Purchase → subscription conversion | join к subscriptions, time-to-convert |
| 26 | **Real data** — repeat purchase & concentration | rollup invoice→customer, order-count buckets, revenue shares |

### Запуск

```bash
uv run python data/generate_data.py   # data/analytics.duckdb (incl. real-data table)
uv run python run.py            # список кейсов
uv run python run.py 1          # запустить кейс 1
uv run python run.py 26         # real-data кейс
uv run --extra dev pytest -q    # 43 regression-теста
uv run python scripts/report.py # reports/index.html
cd dbt && uv run dbt build --profiles-dir .   # dbt: модели + 17 тестов
```

Runner печатает вопрос кейса, выполняет SQL против `data/analytics.duckdb`, рендерит результат таблицей. Отчёт с графиками публикуется на GitHub Pages автоматически при push.

## Результат

Каждый кейс покрывает конкретный оконно-функциональный паттерн, а находки — честные, а не подогнанные. Три сигнала из teaser (числа сверены с `cases.md`):

- воронка теряет **54%** на шаге add-to-cart → checkout;
- retention падает с **~21%** (D1) до **~5%** (D30) — утечка в onboarding-окне;
- повторных покупок всего **3.5%** (896 покупателей, 31 повторный) — one-and-done purchase engine.

Дополнительно:

- RFM вырождается в recency-историю; топ-дециль даёт лишь 22% выручки (нет «китов»);
- лого-churn растёт до ~15%/мес при растущем MRR;
- sessionization воспроизводит 80k предразмеченных сессий с точностью **99.6%**;
- **real data переворачивает вывод**: на UCI Online Retail II 72.4% клиентов возвращаются, а топ-15% дают 65% выручки — тот же SQL, противоположный бизнес-вывод.

Расхождение вопрос/подход в одном файле + regression-инварианты делают кейсы самопроверяемыми: 43 pytest-теста и 17 dbt-тестов держат `cases.md` и код в синхроне, `dbt build` зелёный в CI.

## Ограничения

25 из 26 кейсов — синтетика: их числа описывают форму сгенерированных данных, а не поведение реального продукта. Кейс 26 на UCI Online Retail II показывает, насколько вывод может перевернуться на реальных данных (72.4% repeat против 3.5%), и это честная граница применимости — паттерны SQL переносятся, конкретные метрики нет.

## Документация

- [Live report → nikitaboyarkin.github.io/sql-analytics-case-study](https://nikitaboyarkin.github.io/sql-analytics-case-study/)
- [GitHub → sql-analytics-case-study](https://github.com/NikitaBoyarkin/sql-analytics-case-study)
