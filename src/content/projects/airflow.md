---
title: Airflow DAG Platform
description: "Платформа отчётов на Airflow 3: полный DAG проходит за 440 с, задача forecast — за 413 с; каждый отчёт — версионируемый DAG с DQ-валидацией, алертами и метриками запусков."
star:
  situation: "Ручной отчёт из Postgres в Google Sheets давал задержки, ошибки копирования и полное отсутствие воспроизводимости"
  task: "Заменить ручную выгрузку воспроизводимым идемпотентным пайплайном с DQ-валидацией, алертами и метриками запусков"
  action: "Платформа на Airflow 3: DAG-шаблон fetch → validate → write → record_metrics и shared-модули config, dq, alerts, metrics, output, windows"
  result: "Три DAG-а по общему шаблону, 72 теста без Airflow-сервисов и БД; полный прогон DAG занимает 440 с, из них задача forecast — 413 с"
track: engineering
hero: images/airflow.svg
ogImage: /images/og/airflow.png
impact:
  - "Каждый отчёт — версионируемый DAG по шаблону fetch → validate → write → record_metrics на декораторах @task (Airflow 3 SDK)"
  - "Окно — полуинтервал [logical_date − N, logical_date); catchup=False, пропущенные периоды берутся явным backfill"
  - "DQ-валидация перед записью: заголовок, неотрицательные revenue и orders, пустой результат как отдельный NoDataError"
  - "Observability: каждый успешный запуск пишет строку в dag_metrics, падение — в on_failure_callback (алерт + failed-метрика)"
  - "Конфиг целиком из Airflow Variables с префиксом AIRFLOW_CFG_ — без хардкода, dev-фолбэк пишет CSV вместо Sheets"
  - "Замеренный прогон: полный DAG — 440 с, задача forecast — 413 с"
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
  - /posts/reproducible-data-pipelines/
  - /posts/github-actions-automation/
faq:
  - question: "Почему отчёт — это DAG, а не скрипт?"
    answer: "DAG даёт версионирование, расписание, ретраи и метрики запусков из коробки; ручная выгрузка SQL-клиентом → копирование в Sheets не оставляет ни одного из этих следов."
  - question: "Что проверяет DQ-валидация?"
    answer: "Заголовок результата, неотрицательные revenue и orders и пустой набор как отдельный NoDataError — до того, как данные уйдут в приёмник."
  - question: "Как устроена observability?"
    answer: "Каждый успешный запуск пишет строку в dag_metrics (status, duration_s, rows_written, logical_date); провал фиксируется в on_failure_callback. scripts/metrics_report.py агрегирует success rate и p95."
  - question: "Работает ли проект без внешних API?"
    answer: "Да: в dev-режиме AIRFLOW_CFG_sales_report_output=file пишет CSV в data/out/, а Google Sheets нужен реальный сервисный аккаунт."
  - question: "Как добавить новый отчёт?"
    answer: "По общему шаблону переиспользования shared-модулей: новый DAG собирается из тех же config, dq, alerts, metrics и windows, без копирования логики."
---

# Airflow DAG Platform

**▶ [Схема потока данных](/diagrams/airflow.html)** — самодостаточный HTML, открывается в браузере — без установки и сборки

## Ситуация

Ручной отчёт по продажам — SQL-клиент, копирование агрегата в Google Sheets — давал задержки, ошибки копирования и никакой воспроизводимости. Пропущенный или упавший прогон оставался незамеченным, а новый отчёт приходилось собирать заново.

## Задача

От меня требовалось заменить ручную выгрузку воспроизводимым и идемпотентным пайплайном: данные доходят до приёмника по расписанию без ручного вмешательства, падения видны сразу, а новый отчёт добавляется по общему шаблону, а не с нуля.

## Действия

### DAG-и

| DAG | Расписание | Что делает | Приёмник |
|-----|-----------|------------|----------|
| `daily_sales_report` | `@daily` | Агрегат продаж за сутки (`sale_date`, `product_id`, `revenue`, `orders`) | Google Sheets (или CSV-фолбэк) |
| `weekly_sales_summary` | `@weekly` | Сводка за неделю по `category` (`category`, `revenue`, `orders`) | CSV (Sheets опционально) |
| `delivery_control_tower` | вручную (`schedule=None`) | 8 задач: CSV → staging → DQ-гейт → витрины DuckDB → 5 анализов параллельно | файлы проекта `delivery-control-tower` |

Каждый DAG строится по шаблону `fetch → validate → write → record_metrics` на `@task`-декораторах Airflow 3 SDK. Окно — полуинтервал `[logical_date − N, logical_date)`; `catchup=False`, backfill — явной командой.

### Переиспользуемые модули

```
dags/shared/
  config.py    # конфиг из Airflow Variables, без хардкода
  dq.py        # DQ-валидация перед записью
  alerts.py    # формат и callback алертов при падении
  metrics.py   # observability: запись в dag_metrics
  output.py    # CSV-райтер (dev-фолбэк), идемпотентная перезапись
  windows.py   # daily/weekly окна по logical_date
```

### Стек и запуск

```bash
uv sync
uv run pytest                                 # тесты без Airflow runtime
uv run python scripts/generate_sales_data.py --days 7 --rows-per-day 10000
export AIRFLOW_HOME=$(pwd) && uv run airflow standalone   # UI :8082, логин admin, пароль генерируется при первом запуске
docker compose up -d --build                  # Postgres + Airflow в контейнерах, без локального Airflow
uv run python scripts/metrics_report.py --days 7
```

### Гейты CI

```bash
uv run ruff check .          # линт: E,W,F,I,B,C4,UP
uv run ruff format --check .
uv run mypy                  # dags/, scripts/, tests/
uv run pytest                # 72 теста, хуки замоканы
```

## Результат

Платформа доводит три отчёта до приёмника по расписанию, каждый — отдельный версионируемый DAG. Качество держится на четырёх гейтах CI: `ruff check`, `ruff format --check`, `mypy` и `pytest` проходят на 72 тестах, которым не нужны ни Airflow-сервисы, ни живая БД (хуки замоканы). Конфигурация целиком вынесена в Airflow Variables с префиксом `AIRFLOW_CFG_`, а dev-режим `output="file"` работает без внешних API.

- **Замер прогона:** полный DAG проходит за 440 с, из них задача `forecast` — 413 с.

## Ограничения

Источник данных синтетический (`scripts/generate_sales_data.py`), поэтому платформа проверена на демо-данных, а не на прод-потоке. Google Sheets как приёмник требует реального сервисного аккаунта; без него остаётся только CSV-фолбэк. Проект портфельный: надёжность поведения Airflow под нагрузкой на больших объёмах не измерялась.

## Документация

- [GitHub → airflow](https://github.com/NikitaBoyarkin/airflow)
