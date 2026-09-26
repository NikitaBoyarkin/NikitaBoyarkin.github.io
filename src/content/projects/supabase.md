---
title: Product Analytics + A/B on Supabase
description: "Full-stack аналитика на Supabase: A/B-эксперимент дал +5,1 пп (p = 0.0034, chi-square), а Streamlit-дашборд читает живые данные через Row Level Security и SQL-вьюхи."
track: product
hero: images/supabase.svg
impact:
  - "Full-stack: Streamlit UI + Supabase Postgres + Edge Function ingest (auth по API-ключу)"
  - Row Level Security на каждой таблице — пользователь видит только строки своей организации
  - SQL-вьюхи считают funnel, cohort, MRR, DAU и channel conversion — дашборд переформатирует, а не агрегирует
  - "A/B-результат в базе: control 32.1% против treatment 37.2%, p = 0.0034 (χ²)"
tools:
  - Python
  - Streamlit
  - Supabase (Postgres + RLS + Edge Functions)
  - SQL
  - supabase-py
github: https://github.com/NikitaBoyarkin/supabase-product-analytics
updated: 2026-09-15
private: true
related:
  - /projects/streamlit/
---

# Product Analytics + A/B on Supabase

## Ситуация

Аналитическое портфолио чаще всего показывает метрики на чистом CSV. Трудная часть остаётся невидимой: как аналитика встраивается в реальный multi-tenant продукт — авторизация, изоляция данных по организациям, путь инжеста событий и эксперимент, результат которого считается в базе, а не в ноутбуке.

## Задача


От меня требовалось собрать этот слой целиком — от приёма событий до результата эксперимента — и сделать его пригодным для реальных пользователей, а не только для локального запуска.

## Действия

### Архитектура

```
Client/seed  ── POST /functions/v1/ingest (x-api-key) ──►  Edge Function (Deno)
                                                              │
Streamlit    ◄── email/password auth + SQL (RLS-scoped) ──►  Supabase Postgres
dashboard        (supabase-py, anon key)                      analytics + experiments
```

- **Схемы:** `analytics` (organizations, api_keys, users, events, subscriptions, org_members) и `experiments` (experiments, variants, assignments, metrics).
- **Аналитика в БД:** SQL-views считают funnel, cohort retention, MRR, DAU и channel conversion (`sql/002_views.sql`) — дашборд переформатирует, но не агрегирует.
- **A/B в БД:** `experiments.v_results` считает по варианту assigned/converted/conversion; χ²-тест запускается поверх в дашборде.
- **Ingest:** Edge Function валидирует API-ключ (SHA-256 hash, не plaintext) и вставляет событие через `security definer` функцию.

### Модель безопасности (RLS)

На каждой таблице включён Row Level Security. Пользователь видит только строки своей организации — дашборд безопасно открывать реальным пользователям, а не только запускать локально.

## Результат

Аналитика считается там же, где лежат данные: SQL-views и `v_results` означают, что метрики и экспериментальные результаты согласованы между любым клиентом, который подключается к базе — дашборд, BI-инструмент или ad-hoc SQL-запрос видят одни и те же цифры. Завершённый A/B даёт control 32.1% против treatment 37.2%, **+5,1 пп** при p = 0.0034 (χ²).

## Ограничения

События для A/B сгенерированы сидом, поэтому ценность не в самой величине эффекта, а в том, что эксперимент считается в базе, изолирован по тенантам и воспроизводим любым клиентом. Продуктовой истории за числами нет — это демонстрация архитектуры, а не результат реального запуска.

## Документация

- [GitHub → supabase-product-analytics](https://github.com/NikitaBoyarkin/supabase-product-analytics)
