---
title: "Volta — Анализ трат"
description: "Разбивка трат по категориям и каналам: bills (25,8%) и travel (20,2%) дают почти половину оборота, groceries — самая частая категория."
part: spend
order: 10
layer: extended
impact:
  - "Bills 25,8% и travel 20,2% — почти половина оборота"
  - "Groceries — 18 238 транзакций"
  - "Доля отказов и месячный тренд"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "spend-by-category"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Анализ трат

## Ситуация

Где и на что уходят деньги клиентов — база для cashback- и офферной стратегии.

## Задача

Мне нужно было увидеть, куда и на что уходят деньги клиентов. От меня требовалось дать основу для cashback- и офферной стратегии.

## Действия

- Агрегация трат по категориям/каналам/мерчантам.
- Доля отказов по категориям, месячный тренд.

## Результат

- **Bills (25,8%)** и **travel (20,2%)** — крупнейшие категории; вместе почти половина оборота.
- **Groceries** — самая частая (18 238 транзакций, средний чек €45,8).
- Travel — тонкая маржа (см. Project 14).

## Рекомендации

- Строить cashback/офферы вокруг топ-категорий (bills, groceries).
- Следить за маржой travel при росте объёма.
- Мониторить decline rate как индикатор UX оплаты.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
