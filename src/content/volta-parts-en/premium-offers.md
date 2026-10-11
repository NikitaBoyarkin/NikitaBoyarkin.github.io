---
title: "Volta — Segment Premium Offers"
description: "A/B: a segment offer lifts gap segments (+3.3pp 45+, +4.2pp families, +3.8pp travelers) — Holm-significant, but the anchor barely moves."
star:
  situation: "The generic upsell doesn't transfer — the previous project recommended segment offers, but they went untested"
  task: "Own the head-to-head test of the segment offer against the generic one under control"
  action: "Randomized A/B, sample-size and SRM checks, z-test by segment with Holm correction, segment × arm interaction (DiD)"
  result: "45+ 1.6%→5.0%, families 4.4%→8.6%, travelers 8.8%→12.6%; anchor +0.86pp — the gap is not closed"
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
github: https://github.com/NikitaBoyarkin/case-premium-offers
---

# Volta — Segment Premium Offers

## Situation

Project 15 showed the generic upsell doesn't transfer and recommended segment offers — but that was untested. This project tests generic (control) vs segment (treatment).

## Task

I owned testing the unverified recommendation: a head-to-head of the segment offer against the generic one under control.

## Actions

I turned the earlier project's recommendation into a controlled test: the generic offer as control, the segment offer as treatment, randomized per user.

- **Design and randomisation.** Fixed the primary metric and split users across arms so the groups are comparable.
- **Pre-checks.** Confirmed the sample was large enough and that there was no SRM — otherwise the lift could be blamed on a split skew.
- **Segment tests.** Compared conversion by segment with 95% CIs, Holm correction.
- **Interaction.** Estimated the segment × arm interaction (DiD), to separate the offer effect from a general time shift.
- **Residual gap.** Checked separately whether the treatment closes the gap with the anchor or only shifts it.
- **Segment cuts.** Fixed the list of segments and their sizes in advance, so the winning cut is not chosen after seeing the result.
- **Tooling.** Python and pandas/NumPy, SciPy/Statsmodels for the z-tests and the correction, Matplotlib/Seaborn for the lift charts.

## Result

- Treatment lifts gap segments: **45+ 1.6%→5.0%**, **families 4.4%→8.6%**, **travelers 8.8%→12.6%** — all Holm-significant.
- The anchor barely moves (**+0.86pp**): it's already served by the generic offer.
- Residual gap: 45+ treatment (5.0%) is still **~3.8×** below the anchor's generic offer (18.6%).

## Recommendations

- Ship segment offers — a positive, significant ROI.
- Plan for a persistent gap; don't expect parity with the anchor.
- For 45+, combine with the trust track, not the offer alone.

## Documentation

- [GitHub → case-premium-offers](https://github.com/NikitaBoyarkin/case-premium-offers)
