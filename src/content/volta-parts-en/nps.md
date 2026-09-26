---
title: "Volta — NPS Trends"
description: "Monthly NPS hovers near zero; the strongest drivers are app quality (+30.3) and product (+29.4), the main source of dissatisfaction is fees (−59.4)."
part: nps
order: 12
layer: extended
impact:
  - "NPS near zero — customers are neutral"
  - "app_quality +30.3 and product +29.4 — up"
  - "fees −59.4 and onboarding −23.6 — down"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "nps-monthly"
  - "nps-drivers"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — NPS Trends

## Situation

Are customers promoters or neutrals? And which drivers move NPS.

## Task

I needed to see where customers sit between promoter and neutral, and my job was to find which drivers actually move the score.

## Actions

- Monthly NPS across 18 survey months.
- NPS by driver and promoter mix.

## Result

- NPS hovers near zero: peak **+12.9** (2024-10), bottom **−1.8** (2024-09).
- **app_quality +30.3** and **product +29.4** are the strongest drivers; **fees −59.4** is the main source of dissatisfaction.
- **onboarding −23.6** is consistent with the KYC bottleneck from Project 1.

## Recommendations

- Address the perception of fees (transparency, tariffs) — the biggest negative.
- Clean up onboarding (tie-in with the KYC fix).
- Lean on app quality as a strength in messaging.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
