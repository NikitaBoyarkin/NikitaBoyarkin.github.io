---
title: "Volta — Segment Premium Offers"
description: "A/B: a segment offer lifts gap segments (+3.3pp 45+, +4.2pp families, +3.8pp travelers) — Holm-significant, but the anchor barely moves."
part: premium-offers
order: 20
layer: rat-v2
impact:
  - "+3.33pp 45+, +4.16pp families, +3.79pp travelers"
  - "All gap lifts Holm-significant"
  - "Anchor +0.86pp — the gap is not closed"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "premium-offers-conversion"
  - "premium-offers-lift"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Segment Premium Offers

## Context

Project 15 showed the generic upsell doesn't transfer and recommended segment offers — but that was untested. This project tests generic (control) vs segment (treatment).

## Data & Method

- Randomized A/B, sample-size/SRM checks.
- z-test by segment with 95% CIs, Holm correction.
- Segment × arm interaction (DiD), residual-gap analysis.

## Findings

- Treatment lifts gap segments: **45+ 1.6%→5.0%**, **families 4.4%→8.6%**, **travelers 8.8%→12.6%** — all Holm-significant.
- The anchor barely moves (**+0.86pp**): it's already served by the generic offer.
- Residual gap: 45+ treatment (5.0%) is still **~3.8×** below the anchor's generic offer (18.6%).

## Recommendations

- Ship segment offers — a positive, significant ROI.
- Plan for a persistent gap; don't expect parity with the anchor.
- For 45+, combine with the trust track, not the offer alone.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
