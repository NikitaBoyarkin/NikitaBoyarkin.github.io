---
title: "Volta — FX Sourcing Feasibility"
description: "The 0.55% gate is reachable only at SOM scale (~€332M/mo, 122× today) — a cold-start, not 'impossible'. Best quote is Interbank Prime at 0.745%."
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
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — FX Sourcing Feasibility

## Context

Project 14 established the break-even FX cost (0.55%) but *assumed* such a price is buyable. This project models liquidity-provider quotes.

## Data & Method

- Provider quotes: interbank log-linear in volume, hedge cost falls with term.
- Required volume for the gate (log-interpolation).
- Provider ranking (quote vs hedge), hedge-term effect.

## Findings

- The 0.55% gate is reachable at ≈ **€332M/month** — SOM scale (180K travelers).
- Today's volume (~€2.7M/mo) is **~122× lower**; SOM clears the gate with 1.5× headroom.
- **~0.20pp** per order of magnitude; **Interbank Prime 0.745%** is the best provider.

## Recommendations

- Risk v2 #2 is a cold-start: bridge to volume (partner-volume aggregation, paid travel tier, long hedge).
- Pick the best provider + a long hedge (the second discount after volume).
- Hold travel scaling until volume is reached.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
