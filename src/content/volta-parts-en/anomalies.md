---
title: "Volta — Anomaly Detection"
description: "Isolation Forest has the best F1 (50.4%), catching amount, night-hour and frequency anomalies. Z-score is precise but cautious; the comparison of the three detectors ran against ground truth."
star:
  situation: "Fraud and anomalies are a heavily imbalanced problem — detectors have to be compared honestly against ground truth"
  task: "Compare the fraud and anomaly detectors honestly against ground truth, given how imbalanced the problem is"
  action: "Features: amount, hour, frequency; Z-score, IQR, Isolation Forest, scored precision/recall/F1 against truth"
  result: "Isolation Forest — best F1 (50.4%, 401 detections); Z-score — precision 80.5% at recall 24.7% (123 detections)"
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
  - "anomaly-hour-amount"
github: https://github.com/NikitaBoyarkin/case-anomalies
---

# Volta — Anomaly Detection

## Situation

Fraud/anomalies are a heavily imbalanced problem: detectors must be compared honestly against ground truth.

## Task

I owned the honest verdict: which detector to trust under a heavy class imbalance and in which mode to use it — for screening or for high-precision alerts. The comparison could not rest on a single catch metric.

## Actions

I set up the comparison so detectors could be measured fairly on a rare class: what matters is not only the catch but the price of false alarms. So I assembled features first, ran each detector, and scored the output against the labels.

**Data preparation.** I built a feature set per event: amount, hour of day and transaction frequency. I normalised the amount scale so outliers would not set the scale for everything else, and labelled every record against ground truth.

**Baseline.** First I took a simple Z-score threshold: how far an object sits from the mean in units of spread. It is a clear and precise but cautious estimate — it flags only the most obvious outliers.

**Robust threshold.** Second, IQR: it looks for points beyond the interquartile range and so tolerates heavy tails where the mean is biased. It is a compromise between simplicity and robustness.

**Model.** Third, Isolation Forest: it isolates anomalies by random splits and catches combined clusters such as 'night hours and large amount' that one-dimensional thresholds miss.

**Validation.** I computed precision, recall and F1 for each detector against the labels and looked at where detectors gain by paying in false alarms. That exposed the mode in which each method belongs.

## Result

- **Isolation Forest** has the best F1 (**50.4%**, 401 detections).
- **Z-score** is precise but cautious: precision **80.5%** at recall **24.7%** (123 detections).
- IQR is a compromise but trails IF.

## Recommendations

- IF for broad screening, Z-score for high-precision alerts.
- Monitor the 'night hours × large amount' clusters.
- Calibrate the threshold to the acceptable false-positive rate.

## Documentation

- [GitHub → case-anomalies](https://github.com/NikitaBoyarkin/case-anomalies)
