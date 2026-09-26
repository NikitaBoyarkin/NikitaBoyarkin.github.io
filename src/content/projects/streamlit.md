---
title: Product Analytics Dashboard (Streamlit)
description: "Продуктовый дашборд на синтетическом SaaS-датасете (8 000 пользователей): AARRR-воронка, cohort retention, выручка (MRR, ARPU, churn) и сегментация — 5 страниц на Streamlit."
track: product
hero: images/streamlit.svg
impact:
  - 8 000 синтетических пользователей, Jan 2024 – Jun 2025, детерминированный seed = 42
  - "AARRR-воронка: app_open → signup → activate → start_trial → subscribe с пошаговым drop-off"
  - Когортная heatmap удержания (месяц signup × месяцев с signup)
  - "Выручка: рост MRR, MRR по тарифам, ARPU, logo churn"
  - "Сегменты: распределения + конверсия + ARPU по сегменту / каналу / стране / устройству"
tools:
  - Python
  - Streamlit
  - pandas / NumPy
github: https://github.com/NikitaBoyarkin/streamlit-app
updated: 2026-08-14
private: true
related:
  - /projects/supabase/
---

# Product Analytics Dashboard (Streamlit)

## Ситуация

Аналитическое портфолио должно показывать весь AARRR-цикл на одном согласованном датасете, а не одну метрику изолированно. Этот дашборд — self-contained приложение: данные генерируются детерминированно, метрики воспроизводимы между запусками, а тот же UI позже стал слоем презентации для full-stack Supabase-проекта.

## Задача


От меня требовалось собрать метрики так, чтобы они читались как один связный сюжет, а не как набор отдельных графиков.

## Действия

**Данные:** синтетический SaaS-датасет, 8 000 пользователей, Jan 2024 – Jun 2025. Генерируется in-memory с детерминированным seed = 42 и кэшируется через `@st.cache_data` — датасет идентичен между запусками и разделяем между страницами в сессии.

### Страницы

| Page | Что показывает |
|------|----------------|
| Overview | KPI (users, paid, MRR, active 30d, stickiness), DAU trend, monthly signups, conversion by channel |
| Funnel | `app_open → signup → activate → start_trial → subscribe` с пошаговым drop-off |
| Retention | Cohort retention heatmap (месяц signup × месяцев с момента signup) |
| Revenue | MRR growth, MRR by plan, ARPU, logo churn |
| Segments | Распределения + конверсия + ARPU по сегменту / каналу / стране / устройству |

### Запуск

```bash
uv sync
uv run streamlit run app.py
```

## Результат

Все AARRR-вопросы читаются на одной согласованной базе. Детерминированный seed означает, что Funnel, Retention, Revenue и Segments говорят об одних и тех же пользователях, а числа можно проверить. Позже этот же UI стал слоем презентации для full-stack Supabase-проекта — сменился только слой данных.

## Ограничения

Данные синтетические и сгенерированы in-memory: числа воспроизводимы, но не описывают реальный продукт. Ценность дашборда — в полноте цикла и согласованности метрик между страницами, а не в конкретных значениях.

## Документация

- [GitHub → streamlit-app](https://github.com/NikitaBoyarkin/streamlit-app)
