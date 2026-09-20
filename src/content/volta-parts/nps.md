---
title: "Volta — Тренды NPS"
description: "Месячный NPS держится около нуля; сильнейшие драйверы — app quality (+30,3) и product (+29,4), главный источник недовольства — fees (−59,4)."
part: nps
order: 12
layer: extended
impact:
  - "NPS около нуля — клиенты нейтральны"
  - "app_quality +30,3 и product +29,4 — вверх"
  - "fees −59,4 и onboarding −23,6 — вниз"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "nps-monthly"
  - "nps-drivers"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Тренды NPS

## Контекст

Клиенты — промоутеры или нейтралы? И какие драйверы двигают NPS.

## Данные и метод

- Месячный NPS по 18 месяцам опросов.
- NPS по драйверам и микс промоутеров.

## Выводы

- NPS колеблется около нуля: пик **+12,9** (2024-10), минимум **−1,8** (2024-09).
- **app_quality +30,3** и **product +29,4** — сильнейшие драйверы; **fees −59,4** — главный источник недовольства.
- **onboarding −23,6** согласуется с KYC-узким местом из Project 1.

## Рекомендации

- Проработать восприятие fees (прозрачность, тарифы) — крупнейший минус.
- Дочистить onboarding (связка с KYC-фиксом).
- Опираться на app quality как на сильную сторону в коммуникации.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
