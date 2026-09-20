---
title: "Volta — Прогноз оттока"
description: "Random Forest даёт +0,03 ROC-AUC над логистической регрессией; топ-драйвер оттока — частота ошибок устройства (23,7%), а не баланс или активность."
part: churn
order: 5
layer: extended
impact:
  - "RF +0,03 ROC-AUC над LR"
  - "Топ-драйвер — device_error_rate (23,7%)"
  - "SHAP для локальной интерпретации прогноза"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "churn-feature-importance"
  - "churn-roc-curves"
  - "churn-shap-importance"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Прогноз оттока

## Контекст

Отток — не только маркетинговая проблема: нужно понять, что реально двигает уход, чтобы выбрать рычаг.

## Данные и метод

- Логистическая регрессия vs Random Forest, ROC-AUC и важность признаков.
- SHAP-сводка (средний |SHAP|) и локальный разбор отдельного прогноза.

### Локальный SHAP

![SHAP-разбор отдельного прогноза](/images/volta/churn_shap_local.png)

*Почему конкретный пользователь получил высокий риск: вклад каждого признака.*

## Выводы

- Random Forest даёт **+0,03 ROC-AUC** над LR — прирост скромный, но устойчивый.
- Топ-драйвер — **частота ошибок устройства (23,7%)**, далее usage_frequency (18,7%) и days_since_last_activity (16,5%).
- Баланс и активность уступают надёжности продукта.

## Рекомендации

- Направлять churn-профилактику в надёжность продукта и поддержку, а не только в офферы.
- Использовать SHAP для точечного таргетинга риска.
- Мониторить device-error rate как guardrail-метрику удержания.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
