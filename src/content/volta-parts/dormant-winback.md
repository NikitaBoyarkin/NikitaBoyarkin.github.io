---
title: "Volta — Win-back дормантов 45+"
description: "Трёхармный win-back: human +5,34 п.п. и light-touch +2,77 п.п. против control. Light-touch окупается на 30–90d (ROI 2,54 / 1,26), human ROI 0,40 — kill как массовый канал."
part: dormant-winback
order: 22
layer: rat-v2
impact:
  - "human +5,34 п.п., light-touch +2,77 п.п."
  - "Light-touch ROI 2,54 (30–60d) и 1,26 (60–90d)"
  - "human ROI 0,40 — не окупается"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "dormant-reactivation"
  - "dormant-roi"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Win-back дормантов 45+

## Контекст

Последний проект RAT v2: Project 13 утверждал, что дормантность 45+ — UX-барьер. Проверяем, возвращает ли ассистированная реактивация таких дормантов и окупается ли она.

## Данные и метод

- Трёхармный рандомизированный win-back: автоматический / light-touch / human.
- Четыре корзины дормантности; z-тесты по arm и корзине с поправкой Holm.
- ROI на 10K обработанных, граница таргетинга, безубыточный LTV.

## Выводы

- Механизм подтверждён: **human +5,34 п.п.** и **light-touch +2,77 п.п.** против control (оба значимы); сильнее всего на 30–60d (human **+11,37 п.п.**).
- Экономика уточняет: light-touch окупается на **30–60d (ROI 2,54)** и **60–90d (1,26)**; human теряет деньги везде (**overall 0,40**).
- На 180d+ эффект почти исчезает.

## Рекомендации

- Запускать light-touch win-back, нацеленный на дормантов **30–90 дней** (Ship узко).
- Human-звонок — эскалация для high-value/high-balance, не массовый канал (Kill).
- Не трогать 180d+ — экономика отрицательная.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
