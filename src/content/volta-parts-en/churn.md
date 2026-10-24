---
title: "Volta — Churn Prediction"
description: "Random Forest adds +0.03 ROC-AUC over logistic regression; the top churn driver is device-error rate (23.7%), not balance or activity."
star:
  situation: "Churn was treated as a marketing problem, but the retention lever had to be chosen from the data"
  task: "Own choosing the retention lever from the data, not from a marketing intuition"
  action: "Logistic regression vs Random Forest, ROC-AUC and feature importance, plus SHAP summary and a local breakdown of one prediction"
  result: "Random Forest adds +0.03 ROC-AUC over LR; top driver is device-error rate 23.7%, usage_frequency 18.7% and days_since_last_activity 16.5%"
part: churn
order: 5
layer: extended
impact:
  - "RF +0.03 ROC-AUC over LR"
  - "Top driver — device_error_rate (23.7%)"
  - "SHAP for local prediction interpretation"
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
github: https://github.com/NikitaBoyarkin/case-churn
---

# Volta — Churn Prediction

## Situation

Churn is not only a marketing problem: we need to know what actually drives leaving in order to pick a lever.

## Task

I owned choosing the retention lever from the data, not from a marketing intuition.

## Actions

I treated churn as a lever-selection problem: first compared models, then looked at which features actually move risk, and only then at why one user landed in the risk zone.

- **Model comparison.** Trained logistic regression as an interpretable baseline and Random Forest as a flexible model, and compared them by ROC-AUC to see whether the added complexity pays off.
- **Feature importance.** Ranked the drivers by importance, to see what outranks balance and activity.
- **SHAP summary.** Computed the mean |SHAP| per feature — a stable global ranking of drivers, not just the model's built-in importance.
- **Local breakdown.** For one user, decomposed the prediction into feature contributions to explain the risk point by point.
- **Tooling.** Python and pandas/NumPy to prepare the data, scikit-learn for the models and ROC-AUC, SHAP for the breakdowns, Matplotlib/Seaborn for the charts.

### Local SHAP

<img src="/images/volta/churn_shap_local.png" alt="SHAP breakdown of a single prediction" width="1464" height="842" loading="lazy" decoding="async" />

*Why one specific user is high risk: each feature's contribution.*

## Result

- Random Forest adds **+0.03 ROC-AUC** over LR — a modest but robust gain.
- Top driver is **device-error rate (23.7%)**, then usage_frequency (18.7%) and days_since_last_activity (16.5%).
- Balance and activity rank below product reliability.

## Recommendations

- Route churn prevention into product reliability and support, not just offers.
- Use SHAP for targeted risk scoring.
- Monitor device-error rate as a retention guardrail metric.

## Documentation

- [GitHub → case-churn](https://github.com/NikitaBoyarkin/case-churn)
