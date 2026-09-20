---
title: "Volta — Retention и когорты"
description: "Когортные треугольники показали ступенчатый сдвиг после KYC-фикса: M1 +11,8 п.п., M3 +9,2 п.п. и +€227K/год LTV. LTV Premium в 4,3× выше Free."
part: retention
order: 3
impact:
  - "M1 retention +11,8 п.п. ступенчатый сдвиг"
  - "M3 retention +9,2 п.п."
  - "+€227K/год инкрементального LTV; Premium LTV 4,3× Free"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "cohort-retention-heatmap"
  - "retention-pre-post"
  - "retention-free-vs-premium"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Retention и когорты

## Контекст

Ship — не конец: эффект KYC-фикса проверили на удержании когортными треугольниками (месяц регистрации × возраст) вместо «среднего по всем».

## Данные и метод

- Когортные кривые и матрица удержания M0–M11.
- Pre/post Welch t-test + Cohen's d, bootstrap-ДИ на M1/M3/M6.
- Plan-specific LTV с разложением ARPU × удержание.

## Выводы

- Ступенчатый сдвиг: пост-фикс когорты (2024-09+) держат M1 ≈ **61–67%** против **51–53%** у пре-фикс.
- **M3 +9,2 п.п.**; эффект не выцветает — на M6 разрыв сохраняется.
- **LTV Premium = 4,3× Free** (ARPU 2,66× × удержание 1,62×).
- Эффект на портфеле: **+€227K/год** инкрементального LTV.

## Рекомендации

- Нацелить апгрейды на high-intent Free в первые 1–2 месяца — там максимальный рычаг.
- Мониторить затухание когорт, а не только средний retention.
- Читать последние ячейки диагонали осторожно (мало периодов наблюдения).

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
