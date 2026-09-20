---
title: "Volta — Premium-апселл"
description: "Конверсия Free→Premium концентрируется в якоре (17,3%) и статус-сикерах (41,2%); у Цифровых новичков 45+ всего 1,8% — ценность не переносится."
part: premium-upsell
order: 15
layer: market-jobs
impact:
  - "Premium Status 41,2%, якорь 17,3%"
  - "Digital Newcomers 45+ 1,8% (z=34, p<0,001)"
  - "Разрыв сохраняется внутри когорт"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "premium-upsell-by-segment"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Premium-апселл

## Контекст

Второй проект слоя Market & Jobs: переносится ли апселл, найденный в якоре, на новые сегменты.

## Данные и метод

- Конверсия Free→Premium по JTBD-сегменту и когорте.
- Chi² + z-тест (якорь vs gap), важность драйверов (логистическая регрессия).
- Эффект канала оффера и топ-причина апгрейда по сегментам.

## Выводы

- Конверсия концентрируется: **Premium Status 41,2%**, якорь **17,3%** против **Digital Newcomers 45+ 1,8%** (z=34, p<0,001).
- Разрыв сохраняется внутри каждой когорты (Power 26% против Dormant 2%).
- Конвертеры апгрейдятся по разным причинам — один апселл не подходит всем.

## Рекомендации

- Ввести сегментные офферы: cashback для семейных, поддержка для 45+, FX-фичи для путешественников.
- Не ждать паритета с якорем — планировать остаточный разрыв.
- Проверить сегментные офферы A/B-тестом (Project 20).

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
