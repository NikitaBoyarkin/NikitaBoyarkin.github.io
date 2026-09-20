---
title: "Volta — RFM-анализ"
description: "R/F/M-скоринг 1–5 делит базу на жизненные сегменты от Champions до Lost; recentness и monetary расходятся — «частые, но дешёвые» и «редкие, но крупные»."
part: rfm
order: 6
layer: extended
impact:
  - "7 жизненных сегментов (Champions→Lost)"
  - "Champions — 23,9% базы с высокими R/F/M"
  - "Разные профили требуют разных кампаний"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "rfm-heatmap"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — RFM-анализ

## Контекст

Нужен простой, интерпретируемый слой ценности клиента, дополняющий кластерную сегментацию.

## Данные и метод

- R/F/M-скоринг по квинтилям → жизненные тиры.
- Heatmap средних R/F/M по сегментам.

## Выводы

- R/F/M-скоринг разделяет базу на жизненные сегменты от **Champions** до **Lost**.
- **Champions (23,9%)** держат высокие все три оси (R 91, F 93, M 93); **New** — высокий R (100), но низкие F/M (~30–35).
- **At Risk (11,5%)** и **Lost (23,2%)** — крупный резерв реактивации.

## Рекомендации

- Champions/Loyal — апсейл и защита; At Risk/Lost — реактивация.
- Не применять один оффер ко всем RFM-профилям.
- Связать RFM-тиры с win-back экономикой (Project 22).

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
