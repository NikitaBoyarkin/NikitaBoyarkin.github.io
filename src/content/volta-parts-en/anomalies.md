---
title: "Volta — Anomaly Detection"
description: "Z-score, IQR and Isolation Forest against ground truth. IF has the best F1 (50.4%), catching amount, night-hour and frequency anomalies; Z-score is precise but cautious."
part: anomalies
order: 9
layer: extended
impact:
  - "IF — best F1 (50.4%), 401 detections"
  - "Z-score precision 80.5% at recall 24.7%"
  - "Scoring checked against ground truth"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "anomaly-detection"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Anomaly Detection

## Context

Fraud/anomalies are a heavily imbalanced problem: detectors must be compared honestly against ground truth.

## Data & Method

- Features: amount, hour, frequency.
- Z-score, IQR, Isolation Forest; precision/recall/F1 against truth.

## Findings

- **Isolation Forest** has the best F1 (**50.4%**, 401 detections).
- **Z-score** is precise but cautious: precision **80.5%** at recall **24.7%** (123 detections).
- IQR is a compromise but trails IF.

## Recommendations

- IF for broad screening, Z-score for high-precision alerts.
- Monitor the 'night hours × large amount' clusters.
- Calibrate the threshold to the acceptable false-positive rate.

## Visualization

![Anomaly detection](/images/volta/anomaly_detections.png)

*Anomalies: amount × night hours; Isolation Forest catches hidden clusters.*

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
