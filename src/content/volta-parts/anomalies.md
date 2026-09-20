---
title: "Volta — Поиск аномалий"
description: "Z-score, IQR и Isolation Forest против ground truth. IF — лучший F1 (50,4%), ловит аномалии суммы, ночных часов и частоты; Z-score точен, но осторожен."
part: anomalies
order: 9
layer: extended
impact:
  - "IF — лучший F1 (50,4%), 401 детекция"
  - "Z-score precision 80,5% при recall 24,7%"
  - "Скоринг сверен с ground truth"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "anomaly-detection"
  - "anomaly-hour-amount"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Поиск аномалий

## Контекст

Фрод/аномалии — задача с сильным дисбалансом классов: нужно сравнить детекторы честно, против ground truth.

## Данные и метод

- Признаки: сумма, час, частота.
- Z-score, IQR, Isolation Forest; precision/recall/F1 против truth.

## Выводы

- **Isolation Forest** — лучший F1 (**50,4%**, 401 детекция).
- **Z-score** точен, но осторожен: precision **80,5%** при recall **24,7%** (123 детекции).
- IQR — компромисс, но уступает IF.

## Рекомендации

- IF — для широкого скрининга, Z-score — для высокоточных алертов.
- Мониторить кластеры «ночные часы × крупная сумма».
- Калибровать порог под допустимый уровень ложных срабатываний.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
