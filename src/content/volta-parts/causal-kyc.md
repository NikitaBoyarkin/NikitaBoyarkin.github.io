---
title: "Volta — Причинная валидация KYC (DiD)"
description: "DiD-проверка: фикс KYC причинно поднял M3-удержание на +9,09 п.п. (95% ДИ [+6,21; +11,96]) — pre-trends плоские, placebo ≈ 0, max |SMD| 0,157 < 0,2."
part: causal-kyc
order: 23
layer: causal
impact:
  - "M3-удержание: DiD ATT +9,09 п.п. (95% ДИ [+6,21; +11,96]), p<0,001"
  - "Naive pre/post завышает активацию: +6,29 п.п. против DiD +4,92 п.п."
  - "Диагностики пройдены: pre-trends p=0,29–0,70; placebo ≈ 0; max |SMD| 0,157"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "causal-naive-vs-did"
  - "causal-recovery"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Причинная валидация KYC (DiD)

## Контекст

Project 3 показал, что фикс KYC совпал с ростом удержания, но pre/post Welch t-test — корреляция, а не причинная оценка: он игнорирует общий месячный тренд. Этот проект проверяет то же утверждение дизайном difference-in-differences против потока, на который фикс не действовал.

## Данные и метод

- Дизайн: treated — in-app KYC (на него действует прогресс-бар), comparison — партнёрский KYC (агентский, фикс не применяется), cutoff 2024-09.
- N = 84 000 (50 400 treated / 33 600 comparison), 24 когорты регистрации (2023-01 … 2024-12).
- Оценки: naive pre/post, 2×2 DiD и covariate-adjusted DiD (возраст, устройство, pre-activity) с SE, кластеризованными по когорте.
- Диагностики: parallel trends (наклон разрыва в pre-периоде), placebo на фейковом cutoff 2024-01, covariate balance (SMD), propensity overlap.
- Данные синтетические: генератор закладывает известный ATT (+5,7 / +8,5 / +9,0 п.п.), поэтому это проверка метода — оценщик должен восстановить эффект.

## Выводы

- **M3-удержание: DiD ATT +9,09 п.п.** (95% ДИ [+6,21; +11,96], p<0,001) — причинная оценка совпадает с Project 3 (+9,2 п.п.).
- **Активация: naive +6,29 п.п. → DiD +4,92 п.п.** (95% ДИ [+4,07; +5,77]) — pre/post завышает эффект, потому что не вычитает общий тренд.
- M1-удержание: DiD +7,49 п.п. (95% ДИ [+5,92; +9,05]).
- Диагностики пройдены: pre-trends плоские (p = 0,70 / 0,36 / 0,29), placebo ≈ 0 (все ДИ накрывают 0), max |SMD| = 0,157 < 0,2.
- Recovery: 3/3 95% ДИ накрывают заложенный эффект — оценщик восстанавливает истину.

## Рекомендации

- Разделять доказательства: рандомизированный A/B (+5,72 п.п.) — для ship-решения; DiD — для причинной валидации наблюдательных утверждений (retention).
- Pre/post-числа помечать как корреляцию: naive активация +6,29 п.п. против DiD +4,92 п.п. — pre/post завышает.
- Держать диагностический гейт (parallel trends + placebo + SMD < 0,2) перед публикацией любого causal-вывода.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
