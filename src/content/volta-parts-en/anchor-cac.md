---
title: "Volta — Anchor Launch CAC at Scale"
description: "LTV/CAC ≥3 holds only to ~70K users; at SOM it falls to 1.76× and a 17-month payback. The constraint is cheap-channel capacity, not budget."
star:
  situation: "The anchor segment is the growth point, but does its launch still scale economically when taken to the serviceable market"
  task: "Own the call on whether the anchor segment stays economically viable once the launch scales to the serviceable market"
  action: "Marginal-CAC curves by channel, cheap-first greedy allocation, blended LTV/CAC and payback vs scale, channel capacity"
  result: "LTV/CAC ≥3 holds only to ~70K users (31% of SOM); at SOM 225K it is 1.76× with a 17.0-month payback"
part: anchor-cac
order: 21
layer: rat-v2
impact:
  - "LTV/CAC ≥3 gate holds to ~70K"
  - "At SOM 1.76× and 17.0-month payback"
  - "Referral €18→61, capacity 40K"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "anchor-ltv-cac-vs-scale"
  - "anchor-marginal-cac"
github: https://github.com/NikitaBoyarkin/case-anchor-cac
---

# Volta — Anchor Launch CAC at Scale

## Situation

The 25–34 anchor is the growth point, but does the launch scale economically when taken to SOM.

## Task

I owned the scaling call on the anchor: whether its launch stays profitable as it grows, not merely whether growth is possible. The output had to say at what volume the economics hold and where they break.

## Actions

I measured how acquisition cost rises with scale rather than averaging it: cheap channels run out, and that changes the answer. So I built cost curves per channel and allocated volume greedily, cheapest first.

**Data preparation.** I collected per-channel acquisition cost and capacity — how many users a channel can deliver before its price climbs. I estimated capacity from historical data so the model does not assume endless cheap traffic.

**Cost curves.** For each channel I built a marginal-cost curve: price rises as it approaches capacity. This is the key correction to a blended figure, which averages cheap and expensive together.

**Volume allocation.** I added users greedily, each time taking the cheapest available channel, and assembled a blended cost at any scale. From that curve you can see where the average cost stops holding the gate.

**Gate recomputation.** I reduced cost and value to LTV/CAC and payback as functions of scale and marked the point where both gates stop holding. I also computed the marginal user's cost at the target volume.

**Validation.** I compared the model against actual cost at the current scale and checked that the channel ordering by price is stable to the capacity assumption.

## Result

- The LTV/CAC ≥3 gate holds only to ≈ **70K** users (31% of SOM).
- At SOM (225K): **LTV/CAC 1.76×**, **17.0-month** payback — both gates fail; the marginal SOM user costs **€80**.
- The constraint is cheap-channel capacity: referral €18→61 (capacity 40K), paid social €58→368 (200K).

## Recommendations

- Don't plan the anchor to SOM on a paid budget (hold).
- Raise referral and in-app conversion (capacity + CAC), cap paid at scale.
- Replan SOM around what cheap channels can carry.

## Documentation

- [GitHub → case-anchor-cac](https://github.com/NikitaBoyarkin/case-anchor-cac)
