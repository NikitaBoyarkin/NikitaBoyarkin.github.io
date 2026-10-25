---
title: TaskFlow — PostHog Product Analytics Pipeline
description: "Онбординг-тест на сидированном потоке событий: завершение 55.9% → 70.8% (+26.6%), χ² = 40.10, p < 0.0001 при SRM p = 0.90; 6.3% завершивших регистрацию доходят до платного апгрейда."
star:
  situation: "Аналитическое портфолио обычно начинается с готового CSV; здесь работа стартует раньше — с инструментирования приложения"
  task: "Определить события без утечек PII, довести их до аналитического инструмента и превратить в решения"
  action: "Каталог событий и скрабинг PII; A/B с chi-square, uplift, Wilson CI и SRM; SQL-зеркало метрик, Streamlit-дашборд, CI и Docker"
  result: "Онбординг-тест на сидированном потоке: завершение 55.9% → 70.8% (+26.6%, χ² = 40.10, p < 0.0001, SRM p = 0.90), а до платного апгрейда доходят 6.3% завершивших регистрацию"
track: product
hero: images/posthog.svg
ogImage: /images/og/posthog.png
impact:
  - Типизированный каталог событий (единый источник правды) + PostHog capture/identify/group со скрабингом PII
  - Feature-flag → A/B-вариант онбординга; анализ A/B с χ², uplift, Wilson CI и проверкой SRM
  - Day-N cohort retention, time-to-convert, revenue/LTV, конверсия first-feature → upgrade
  - Те же метрики на SQL (для BI и интервью) + интерактивный Streamlit-дашборд
  - "A/B онбординга: 55.9% → 70.8% (+26.6% относительно), χ² = 40.10, p < 0.0001, SRM p = 0.90 — бакеты чистые"
  - "Воронка до денег: 6.3% завершивших регистрацию доходят до апгрейда (107 из 1 709), $1 712 выручки при ARPU $1.00; медиана до первого ключевого действия — 2.0 ч"
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
date: 2026-08-14
updated: 2026-10-25
private: true
demo: demos/posthog/index.html
related:
  - /projects/supabase/
---

# TaskFlow — PostHog Product Analytics Pipeline

**▶ [Схема потока данных](/diagrams/posthog-saas-analytics.html)** — самодостаточный HTML, открывается в браузере — без установки и сборки

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

- **Онбординг:** завершение 55.9% → 70.8% (+26.6% относительно), χ² = 40.10, p < 0.0001 при SRM p = 0.90 — расхождение бакетов эффект не объясняет.
- **Деньги и скорость:** 6.3% завершивших регистрацию доходят до платного апгрейда (107 из 1 709) — $1 712 выручки при ARPU $1.00; медиана от регистрации до первого ключевого действия — 2.0 ч.

## Ограничения

Трафик генерирует симулятор, а не реальные пользователи: поток событий сидирован, поэтому все числа выше — демонстрация методов, а не продовый результат. Ценность — в дисциплине инструментирования и в полном цикле, где каждый шаг воспроизводим.

## Документация

- [GitHub → posthog-saas-analytics](https://github.com/NikitaBoyarkin/posthog-saas-analytics)
