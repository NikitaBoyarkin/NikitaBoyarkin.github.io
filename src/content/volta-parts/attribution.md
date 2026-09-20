---
title: "Volta — Маркетинговая атрибуция"
description: "First-touch, last-touch, linear и Shapley-атрибуция. Shapley (data-driven) перераспределяет бюджет и ведёт реферал; вывод устойчив к выбору модели."
part: attribution
order: 8
impact:
  - "4 модели атрибуции, включая Shapley"
  - "Shapley: referral €264K против display €125K"
  - "Реферал ведёт во всех четырёх моделях"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "attribution-models"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Маркетинговая атрибуция

## Контекст

Разные модели атрибуции дают разные ответы о том, какой канал «приносит» выручку — нужно сравнить их на одних данных.

## Данные и метод

- Journey-датасет (touch_order × channel × revenue).
- First-touch, last-touch, linear и Shapley-атрибуция.

## Выводы

- Реферал ведёт во всех четырёх моделях (**€218–264K**).
- Shapley перераспределяет: referral растёт до **€263,7K**, display падает до **€125,0K** против ~€180K у эвристик.
- Эвристики недооценивают верхние воронки и переоценивают последний клик.

## Рекомендации

- Перераспределять бюджет по Shapley, а не по last-touch.
- Защищать реферал как ведущий канал.
- Не принимать решения о каналах на одной модели атрибуции.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
