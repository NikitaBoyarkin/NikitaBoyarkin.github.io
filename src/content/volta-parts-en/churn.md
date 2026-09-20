---
title: "Volta — Churn Prediction"
description: "Random Forest adds +0.03 ROC-AUC over logistic regression; the top churn driver is device-error rate (23.7%), not balance or activity."
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
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Churn Prediction

## Context

Churn is not only a marketing problem: we need to know what actually drives leaving in order to pick a lever.

## Data & Method

- Logistic regression vs Random Forest, ROC-AUC and feature importance.
- SHAP summary (mean |SHAP|) and local breakdown of a single prediction.

### Local SHAP

![SHAP breakdown of a single prediction](/images/volta/churn_shap_local.png)

*Why one specific user is high risk: each feature's contribution.*

## Findings

- Random Forest adds **+0.03 ROC-AUC** over LR — a modest but robust gain.
- Top driver is **device-error rate (23.7%)**, then usage_frequency (18.7%) and days_since_last_activity (16.5%).
- Balance and activity rank below product reliability.

## Recommendations

- Route churn prevention into product reliability and support, not just offers.
- Use SHAP for targeted risk scoring.
- Monitor device-error rate as a retention guardrail metric.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
