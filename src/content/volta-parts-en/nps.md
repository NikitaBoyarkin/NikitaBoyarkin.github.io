---
title: "Volta — NPS Trends"
description: "Monthly NPS hovers near zero; the strongest drivers are app quality (+30.3) and product (+29.4), the main source of dissatisfaction is fees (−59.4)."
star:
  situation: "Are customers promoters or neutrals, and which drivers actually move NPS"
  task: "See where customers sit between promoter and neutral and find which drivers move the score"
  action: "Monthly NPS across the survey waves; NPS by driver and promoter mix"
  result: "NPS hovers near zero: peak +12.9 (2024-10), bottom −1.8 (2024-09); fees −59.4 is the main negative, app_quality +30.3"
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
github: https://github.com/NikitaBoyarkin/case-nps
---

# Volta — NPS Trends

## Situation

Are customers promoters or neutrals? And which drivers move NPS.

## Task

I owned turning raw survey responses into a picture the team could act on: how customers actually feel and which drivers move that perception. The goal was a recurring read, not a one-off report.

## Actions

I worked from the data outward: first collected and cleaned the survey responses, then built the metric and broke it down by driver. I computed the monthly NPS across 18 survey months, which shows a trend rather than a single reading.

**Data preparation.** I merged the survey exports into one dataset, mapped the scales onto a common scale, dropped incomplete answers and technical duplicates, and attached customer metadata. I checked that each respondent lands in the sample exactly once.

**Metric.** I split respondents into promoters, neutrals and detractors, computed the headline index by month, and read the trend. In the same pass I built NPS per driver and the promoter mix, so the score is never read in isolation.

**Driver breakdown.** For every driver I built a separate NPS — the promoter share minus the detractor share among those who rated it. That shows a driver's own contribution and makes the drivers comparable to one another.

**Validation.** I checked the response distribution across waves, trimmed outliers, and tested that the reading holds under a different aggregation. I then lined the result up against the bottlenecks from the earlier portfolio projects.

## Result

- NPS hovers near zero: peak **+12.9** (2024-10), bottom **−1.8** (2024-09).
- **app_quality +30.3** and **product +29.4** are the strongest drivers; **fees −59.4** is the main source of dissatisfaction.
- **onboarding −23.6** is consistent with the KYC bottleneck from Project 1.

## Recommendations

- Address the perception of fees (transparency, tariffs) — the biggest negative.
- Clean up onboarding (tie-in with the KYC fix).
- Lean on app quality as a strength in messaging.

## Documentation

- [GitHub → case-nps](https://github.com/NikitaBoyarkin/case-nps)
