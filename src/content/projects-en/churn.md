---
title: Churn Prediction — Leakage-Free Retention Model
description: "A leakage-free churn model: recall@top-10% of 0.53 and 3.07x lift at 0.904 ROC-AUC, on a chronological split with no future activity leaking into features."
track: analytics
hero: images/churn.svg
impact:
  - Chronological snapshot split (train/val/test) — no future activity leaks into training
  - Churn label = a future 30-day inactivity window for recently active users only
  - "Decision metric: recall@top-10% = 0.53, lift@top-10% = 3.07x"
  - LightGBM Brier 0.068 vs 0.099 for the balanced logistic baseline
tools:
  - Python
  - LightGBM
  - scikit-learn
  - pandas / NumPy
  - matplotlib
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/churn-prediction
updated: 2026-09-18
date: 2026-09-18
related:
  - /posts/churn-uplift-discount/
---

# Churn Prediction — Leakage-Free Retention Model

## Situation

A churn model for a subscription product. The difficulty is not the algorithm but the discipline: features must be computed as-of a snapshot date, the target must be a future inactivity window, and the split must be chronological. A random train/test split puts a user's future activity into training and their past into test: the model shows a pretty number that production never delivers. The project exists to eliminate that leakage — the same principle as A/B analysis: no future in the moment being modelled.

## Task

I needed a churn model whose offline score would survive contact with production, so I owned the as-of feature build, the future inactivity target, and the chronological split that keep the future out of the training moment.

## Actions

The data is synthetic and deterministic (seed = 42): 12,000 users sign up between Jun 2023 and Jan 2024, a channel-driven tenure (exponential lifetime) and a plan-driven daily activity probability; activity decays slightly approaching churn, giving a churn rate of ~16% per snapshot.

### Features and label

- **As-of features** — recency, activity over prior 7/14/30 days, tenure, recent trend, average sessions, plus categorical `channel` / `device` / `country` / `plan`.
- **Leakage-free label** — churn = no activity in `[snapshot, snapshot+30d]` for a user who was active in the prior 30 days. Long-dead users are excluded rather than labelled: predicting on ghosts is not a real task.

### Split and metric

- **Chronological split** — train (2024-01-15) -> val (2024-02-15) -> test (2024-03-15). A random split would put a user's future activity into training and their past into test — silent leakage, and eliminating it is the whole reason the project exists.
- **Business metric first** — ROC-AUC and PR-AUC are reported, but the decision metric is **recall@top-decile** and **lift@top-decile**: if retention acts on the top 10% riskiest users, how many actual churners do we catch.

### Model and tests

- **SHAP** — LightGBM's native `predict_proba(pred_contrib=True)` (TreeSHAP without the `shap` package). `recency_days` dominates.
- **Baseline** — a balanced logistic regression.
- **Tests** — 5 pytest tests: balance, leakage, recency correctness, model beats baseline.

| Metric (test snapshot) | LightGBM | LogReg (balanced) |
|---|---|---|
| ROC-AUC | 0.904 | 0.917 |
| PR-AUC | 0.809 | 0.825 |
| Recall@top-10% | 0.53 | 0.54 |
| Lift@top-10% | 3.07x | 3.08x |
| Brier (calibration) | **0.068** | 0.099 |

### Run

```bash
# Python >=3.10. Deps: pandas, numpy, scikit-learn, lightgbm, matplotlib.
uv run --with pandas --with numpy python data/generate_data.py
uv run --with pandas --with numpy --with scikit-learn --with lightgbm --with matplotlib python run.py
uv run --with pandas --with numpy --with scikit-learn --with lightgbm --with matplotlib --with pytest pytest -q
```

Outputs land in `reports/`: `metrics.json` + `evaluation.png` (ROC, PR, SHAP bar).

## Result

LightGBM and logistic regression run nearly even on AUC: the synthetic features are nearly linear, and a linear model handles that. The difference is calibration. Brier 0.068 vs 0.099, and calibration is what decides whether the score can drive retention spend. `recency_days` is so strong that the lift ceiling is low for any model: within the top 10% riskiest users the model catches 53% of real churners at 3.07x lift.

## Limitations

The synthetic features are nearly linear, so the boosting edge in ranking is not informative here. The project demonstrates a leakage-free evaluation setup and score calibration, not that GBM beats logistic regression. The lift ceiling is set by the strength of `recency_days`, not model quality — on other data the gap could be larger.

## Documentation

- [GitHub → churn-prediction](https://github.com/NikitaBoyarkin/churn-prediction)
