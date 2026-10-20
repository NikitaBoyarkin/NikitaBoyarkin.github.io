---
title: Churn Prediction — Leakage-Free Retention Model
description: "A leakage-free churn model: recall@top-10% 0.544, 5.44x lift at 0.916 ROC-AUC on a chronological split; 1.75x on the at-risk subgroup, where 69.7% of the cohort is a near-guaranteed negative."
star:
  situation: "A churn model for a subscription product: a random split leaks future activity into training"
  task: "Score the model so its offline quality is not an artifact of leakage"
  action: "As-of features, a future inactivity label, a chronological split, decisions driven by recall@top-decile and lift"
  result: "The top 10% riskiest catches 54.4% of churners at 5.44x lift, but only 1.75x on the at-risk subgroup: 69.7% of the cohort is a near-guaranteed negative by construction."
track: analytics
hero: images/churn.svg
ogImage: /images/og/churn.png
impact:
  - Chronological snapshot split (train/val/test) — no future activity leaks into training
  - Churn label = a future 30-day inactivity window for recently active users only
  - "Decision metric: recall@top-10% = 0.544, lift@top-10% = 5.44x"
  - LightGBM Brier 0.063 vs 0.062 for a fairly-fitted logistic baseline — an honest tie, not a boosting win
tools:
  - Python
  - LightGBM
  - scikit-learn
  - pandas / NumPy
  - matplotlib
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/churn-prediction
updated: 2026-10-12
date: 2026-09-18
demo: demos/churn/index.html
related:
  - /posts/churn-uplift-discount/
faq:
  - question: "Why a chronological split instead of a random one?"
    answer: "A random split leaks future activity into training: offline quality becomes an artifact of the leak rather than of signal."
  - question: "How is the churn label defined?"
    answer: "As a future 30-day inactivity window, applied only to recently active users."
  - question: "How good is the model?"
    answer: "ROC-AUC 0.916: in the top 10% riskiest the model catches 54.4% of real churners at 5.44x lift."
  - question: "Why is the decision metric recall and not AUC alone?"
    answer: "A retention campaign works the top of the risk list, so the decision follows recall@top-10% and lift."
  - question: "Why look at Brier?"
    answer: "Brier is sensitive to probability calibration: 0.063 for LightGBM versus 0.062 for a fairly-fitted logistic baseline — a tie. The earlier 0.068/0.099 gap was an artifact of an unbalanced baseline."
---

# Churn Prediction — Leakage-Free Retention Model

**▶ [Data-flow diagram](/diagrams/churn-prediction.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

The difficulty of a churn model for a subscription product is not the algorithm but the discipline: features must be computed as-of a snapshot date, the target must be a future inactivity window, and the split must be chronological.

A random train/test split puts a user's future activity into training and their past into test: the model shows a pretty number that production never delivers. The project exists to eliminate that leakage — the same principle as A/B analysis: no future in the moment being modelled.

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
- **Baseline** — a fairly-fitted logistic regression (no `class_weight="balanced"`, which distorted its probabilities).
- **Tests** — 21 pytest: leakage properties (deleting post-snapshot activity leaves features unchanged), config integrity, metrics and plots.

| Metric (test snapshot) | LightGBM | LogReg |
|---|---|---|
| ROC-AUC | 0.916 | **0.917** |
| PR-AUC | 0.824 | **0.828** |
| Recall@top-10% | **0.544** | 0.537 |
| Lift@top-10% | **5.44x** | 5.37x |
| Brier (calibration) | 0.063 | **0.062** |

### Run

```bash
# Python >=3.10. Deps: pandas, numpy, scikit-learn, lightgbm, matplotlib.
uv run --with pandas --with numpy python data/generate_data.py
uv run --with pandas --with numpy --with scikit-learn --with lightgbm --with matplotlib python run.py
uv run --with pandas --with numpy --with scikit-learn --with lightgbm --with matplotlib --with pytest pytest -q
```

Outputs land in `reports/`: `metrics.json` + `evaluation.png` (ROC, PR, SHAP bar).

## Result

LightGBM and logistic regression run even: the synthetic features are nearly linear, and the linear model is no worse — LogReg is marginally ahead on AUC, PR-AUC and Brier (0.062 vs 0.063). The honest finding: boosting earns no trophy here. The project demonstrates a leakage-free evaluation setup, not that GBM beats logistic regression. `recency_days` is so strong that the lift ceiling is low for any model: within the top 10% riskiest users the model catches 54.4% of real churners at 5.44x lift.

## Limitations

The synthetic features are nearly linear, so the boosting edge in ranking is not informative here. The project demonstrates a leakage-free evaluation setup and score calibration, not that GBM beats logistic regression. The lift ceiling is set by the strength of `recency_days`, not model quality — on other data the gap could be larger.

## Documentation

- [GitHub → churn-prediction](https://github.com/NikitaBoyarkin/churn-prediction)
