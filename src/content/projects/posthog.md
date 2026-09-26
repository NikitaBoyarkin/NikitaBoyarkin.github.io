---
title: TaskFlow — PostHog Product Analytics Pipeline
description: "SaaS-продукт, инструментированный PostHog end-to-end: типизированный каталог событий, генерация трафика и 7 анализов — воронка, retention, A/B, revenue/LTV, time-to-convert."
track: product
hero: images/posthog.svg
impact:
  - Типизированный каталог событий (единый источник правды) + PostHog capture/identify/group со скрабингом PII
  - Feature-flag → A/B-вариант онбординга; анализ A/B с χ², uplift, Wilson CI и проверкой SRM
  - Day-N cohort retention, time-to-convert, revenue/LTV, конверсия first-feature → upgrade
  - Те же метрики на SQL (для BI и интервью) + интерактивный Streamlit-дашборд
  - CI (pytest + ruff) + Docker + render.yaml для one-click deploy
tools:
  - Python
  - PostHog
  - FastAPI
  - Streamlit
  - pandas / matplotlib
  - pytest / ruff
  - Docker
github: https://github.com/NikitaBoyarkin/posthog-saas-analytics
updated: 2026-09-15
private: true
related:
  - /projects/supabase/
---

# TaskFlow — PostHog Product Analytics Pipeline

## Ситуация

Большинство аналитических портфолио начинаются с готового CSV. Этот проект начинается раньше — с инструментирования приложения: определить события без утечек PII, довести их до аналитического инструмента и превратить сырые события в решения. Пайплайн проходит весь цикл — генерация трафика, захват событий, анализ, дашборд и деплой.

## Задача


От меня требовалось показать этот ранний участок работы: от решения, какие события вообще нужны, до момента, когда по ним можно принимать продуктовые решения.

## Действия

### Пайплайн

```
app/                Demo SaaS (FastAPI + Jinja2): routes + server-side capture
  analytics/        typed event catalog · PostHog wrapper (PII scrub) · feature flag
scripts/            simulate_events.py — 30 days of realistic funnel traffic
analysis/           funnel · cohort · A/B · revenue/LTV · time-to-convert · feature-usage · SQL
dashboard/          interactive Streamlit dashboard
```

### Что демонстрирует

- **Инструментирование:** типизированный каталог событий как единый источник правды; server-side capture; скрабинг PII.
- **A/B:** feature-flag → вариант онбординга; chi-square, uplift, Wilson CI, проверка SRM.
- **Метрики:** funnel, Day-N cohort retention, time-to-convert, revenue/LTV, first-feature → upgrade.
- **SQL-зеркало:** те же метрики как SQL — референс для BI и собеседований.
- **Инженерка:** pytest + ruff в CI, Dockerfile, render.yaml для one-click deploy.

## Результат

Ценность — в полноте цикла. Типизированный каталог событий и скрабинг PII отделяют production-инструментацию от демо: события определены в одном месте, PII не утекает, а метрики воспроизводимы и в Python, и в SQL. Один репозиторий покрывает весь lifecycle аналитики — instrument → generate → analyze → dashboard → deploy.

## Ограничения

Трафик генерирует симулятор, а не реальные пользователи, поэтому числа анализов иллюстрируют корректность пайплайна, а не продуктовые инсайты. Ценность — в дисциплине инструментирования и в полном цикле, где каждый шаг воспроизводим.

## Документация

- [GitHub → posthog-saas-analytics](https://github.com/NikitaBoyarkin/posthog-saas-analytics)
