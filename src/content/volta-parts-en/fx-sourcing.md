---
title: "Volta — FX Sourcing Feasibility"
description: "The 0.55% gate is reachable only at SOM scale (~€332M/mo, 122× today) — a cold-start, not 'impossible'. Best quote is Interbank Prime at 0.745%."
star:
  situation: "The preceding project set the break-even FX cost at 0.55% but assumed such a price is buyable"
  task: "Test that assumption by modelling what liquidity providers actually quote"
  action: "Provider quotes log-linear in volume, the volume required for the gate via log-interpolation, provider ranking and hedge term"
  result: "The 0.55% gate needs ≈ €332M/month at SOM scale; today's ~€2.7M/mo is ~122× lower; ~0.20pp per order of magnitude; Interbank Prime 0.745%"
part: fx-sourcing
order: 19
layer: rat-v2
impact:
  - "Gate needs ~€332M/mo (122× today)"
  - "~0.20pp discount per order of magnitude"
  - "Interbank Prime 0.745% vs 1.059% at Aggregator X"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "fx-sourcing-volume"
  - "fx-provider-ranking"
github: https://github.com/NikitaBoyarkin/case-fx-sourcing
---

# Volta — FX Sourcing Feasibility

## Situation

Project 14 established the break-even FX cost (0.55%) but *assumed* such a price is buyable. This project models liquidity-provider quotes.

## Task

I owned testing whether the required price is actually buyable: turning 'is it possible' into a model of how providers quote price against volume. The answer had to say what volume unlocks the target level.

## Actions

I modelled not a single quote but the price-to-volume relationship: at every provider the price falls as volume grows, and that relationship decides whether the target level is reachable. I then solved for the volume needed to reach the gate.

**Data preparation.** I collected liquidity-provider quotes together with their hedge-term and deal-type conditions. I compared providers at like-for-like volumes and normalised everything onto one basis of comparison.

**Price-versus-volume curve.** For each provider I fitted a log-linear relationship between price and volume: on a log scale the volume discount becomes a slope that is easy to compare across providers. That gives a function rather than a point.

**Required volume.** I solved the inverse problem by log-interpolation: at what volume does the price cross the break-even level. That turns the question from 'expensive or cheap' into a concrete volume threshold.

**Provider ranking.** I ranked providers by total cost including the hedge term and checked whether the leader changes under different assumptions. I also looked at the long-hedge effect as a second discount after volume.

**Validation.** I checked the modelled quotes against market references and tested the volume threshold for stability to quote scatter.

## Result

- The 0.55% gate is reachable at ≈ **€332M/month** — SOM scale (180K travelers).
- Today's volume (~€2.7M/mo) is **~122× lower**; SOM clears the gate with 1.5× headroom.
- **~0.20pp** per order of magnitude; **Interbank Prime 0.745%** is the best provider.

## Recommendations

- Risk v2 #2 is a cold-start: bridge to volume (partner-volume aggregation, paid travel tier, long hedge).
- Pick the best provider + a long hedge (the second discount after volume).
- Hold travel scaling until volume is reached.

## Documentation

- [GitHub → case-fx-sourcing](https://github.com/NikitaBoyarkin/case-fx-sourcing)
