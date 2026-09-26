---
title: "Volta — Моделирование CLV"
description: "Три метода оценки пожизненной ценности: исторический, retention-кривая и Gamma-Gamma. Порядок Power > Growth > Casual > Dormant устойчив ко всем методам."
part: clv
order: 7
layer: extended
impact:
  - "3 метода: historical / retention-curve / Gamma-Gamma"
  - "Устойчиво Power > Growth > Casual > Dormant"
  - "Power Gamma-Gamma €5 166 против Dormant €27,7"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "clv-by-method"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Моделирование CLV

## Ситуация

Чтобы ставить потолок CAC и приоритеты удержания, нужна оценка будущей ценности, а не только прошлой выручки.

## Задача

Мне нужно было получить оценку будущей ценности клиента, а не только его прошлой выручки. От меня требовалось дать основу для потолка CAC и приоритетов удержания.

## Действия

- Исторический CLV (факт), retention-кривая (power-fit), вероятностный Gamma-Gamma.

## Результат

- Порядок **Power > Growth > Casual > Dormant** устойчив во всех трёх методах.
- Gamma-Gamma: **Power €5 166** против **Dormant €27,7** — разрыв ~187×.
- Прогнозные методы выше исторического в **2,9–5,9×**.

## Рекомендации

- Использовать прогнозный CLV как потолок CAC по сегментам.
- Приоритет удержания — Power/Growth (наибольшая потеря ценности при уходе).
- Не опираться на исторический CLV для решений о будущем.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
