---
title: "Volta — Сегментация пользователей"
description: "KMeans с data-driven K=4: Power 12% дают 41% выручки, 68% — 92%. Сценарии миграции между сегментами стоят до +€310K/год."
part: segmentation
order: 4
layer: core
impact:
  - "K=4 выбрано из данных (elbow + силуэт)"
  - "12% пользователей → 41% выручки; 68% → 92%"
  - "Миграция между сегментами: до +€310K/год"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "segmentation-size-vs-revenue"
  - "segmentation-pareto-cumulative"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Сегментация пользователей

## Контекст

Эффект удержался — остался вопрос, кто эти пользователи и как их монетизировать.

## Данные и метод

- StandardScaler + KMeans, K из данных (marginal-gain elbow, валидация силуэтом).
- PCA-проекция и силуэт по кластерам.
- Концентрация по Лоренцу и сценарии миграции между сегментами.

## Выводы

- **K=4**: Power 12% / Growth 24% / Casual 32% / Dormant 32% (размеры выведены из данных).
- **Power** дают **41%** выручки, занимая 12% пользователей; **68%** → **92%**.
- Dormant (32%) всё ещё приносит **7,8%** — у win-back есть потенциал.
- Сценарии миграции: **+€26K/мес (€310K/год)**.

## Рекомендации

- Защищать Power, апгрейдить Growth/Casual, вернуть Dormant.
- Строить стратегию по вероятностям, а не по жёстким ярлыкам (границы мягкие).
- Валидировать стратегию 4 рекомендованными A/B-тестами.

## Визуализация

![PCA-проекция сегментов](/images/volta/segmentation_pca_scatter.png)

*K=4 сегмента в PCA-проекции.*

![Выбор K](/images/volta/segmentation_k_selection.png)

*Data-driven выбор K: elbow и силуэт (плато K=2–4, коллапс на K=5).*

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
