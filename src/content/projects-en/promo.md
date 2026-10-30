---
title: Promo Margin Lab — what a promo rouble actually earns
description: "Promo returns +68.5 m RUB of revenue but −24.4 m RUB of profit: 97.9% of waves lose money at a 1.0–19.5% breakeven vs 25.4% actual, and the optimiser earns +231 496 ₽ vs +136 648 ₽ for top-15%."
star:
  situation: "Offline retail measures promo against a pre-period average and picks the discount depth without pricing cannibalisation or margin"
  task: "Measure promo in margin roubles and choose depth and store set under a budget so that the numbers can be re-checked"
  action: "Synthetic panel with known truth, counterfactual, four-bucket ledger, P&L, breakeven, cluster test validated by simulation, Qini against policy value, budget allocation"
  result: "Promo returns +68.5 m RUB of revenue and −24.4 m RUB of profit; 97.9% of waves lose money at a breakeven depth of 1.0–19.5% against 25.4% actual, and on one budget the optimiser earns +231 496 ₽ versus +136 648 ₽ for top-15%"
track: analytics
hero: images/promo.svg
ogImage: /images/og/promo.png
impact:
  - "The naive baseline understates the increment by −19.9%, the forecast by −3.7%: a 5.3× difference in bias, with WAPE 24.5% → 7.6%."
  - "Promo returns +68.5 m RUB of revenue and −24.4 m RUB of incremental profit: 97.9% of waves lose money, median wave −2 051 ₽."
  - "Breakeven depth is 1.0–19.5% by category against an actual average of 25.4% — the ceiling is breached in all six categories, non-food included, at 30.0% actual against 19.5%."
  - "Qini is 0.963, yet ranking by score loses −55 396 ₽; a calibrated threshold earns +54 361 ₽ at the same capacity — a gap of +109 757 ₽."
  - "On a tight budget the optimiser earns +231 496 ₽ versus +136 648 ₽ for top-15% and +21 888 ₽ for random; greedy matches brute force."
github: https://github.com/NikitaBoyarkin/promo-margin-lab
tools:
  - Python
  - pandas
  - scikit-learn
  - PySpark
  - Apache Superset
  - SQL
  - pytest
  - uv
date: 2026-10-20
updated: 2026-10-25
bet: "Ranking by expected effect is not a decision: money appears where the model answers not «who ranks higher» but «what is it worth»."
rejected:
  - option: "Reporting ROI as «lift × margin»"
    why: "Units that would have sold anyway also lose margin to the discount. The formula without that term gave +11.0 m RUB instead of −24.4 m RUB."
    cost: "The P&L had to be rewritten after the sign of the result flipped."
  - option: "Letting Qini make the decision"
    why: "Qini measures order, not level: a top-k policy by score loses money at near-perfect ranking."
    cost: "Giving up the familiar metric in favour of calibration and policy value."
demo: demos/promo/index.html
related:
  - /projects/ab/
  - /projects/causal/
  - /projects/sql/
  - /posts/churn-uplift-discount/
  - /projects/serp-rank/
faq:
  - question: "Why does promo lose money if revenue grows?"
    answer: "The discount is paid on units that would have sold at full price too. At an average depth of 25.4% and margins of 12–35%, incremental profit is negative in 97.9% of waves even though revenue grows by 68.5 m RUB."
  - question: "Why synthetic data?"
    answer: "The generator stores the truth: baseline, lift, cannibalisation, halo and pantry. That lets the estimator be scored against an oracle rather than a story; net lift reconciles to the oracle within −1.1%."
  - question: "Why is a threshold better than Qini?"
    answer: "At 20% capacity ranking by score loses −55 396 ₽, while a threshold of positive expected margin earns +54 361 ₽ and spends on 3.7% of cells."
---

# Promo Margin Lab

**▶ [Static render of the dashboard](/demos/promo/)** — built from the same SQL marts as the live Superset; the footer says it is a render

## Situation

Promo in offline retail is usually measured with one number: how much sales grew against a pre-period average. That number cannot carry a decision, because a discount is a cost, part of the lift is pulled forward from later weeks, part is taken from neighbouring SKUs, and margin can move the opposite way from revenue.

The product behind this case models promotions before launch: it should answer which depth and which SKU set deliver the best result under constraints. The analyst on that team owns not the model but the measurement — making sure the effect is estimated correctly and translated into money.

## Task

I had to build the measurement-and-decision loop: a counterfactual that does not lie, a lift ledger in roubles, promo P&L, a depth ceiling by category, an experiment design, a model-quality metric and a budget allocation — showing at every step where the estimate can be wrong.

## Actions

### A panel with known truth

561,600 cells: 120 stores × 60 SKUs × 78 weeks, three formats, six categories with 12–35% margin. Promo assignment is not random: the probability rises when the last three weeks were weak. The generator stores eight truth components — base, lift, pantry, cannibalisation, halo, cross-format, noise and an explicit clipping residual — and `feature_columns()` fails if any `truth_*` column reaches the features.

Price and depth are attached with an as-of join on the price version effective in the fact week; joining on `store_id + sku_id` would multiply rows and pick the wrong price.

### Counterfactual

Three estimators on the same promos: pre-period mean, a log-linear forecast with store and SKU effects, seasonality and promo-free history, and a DiD against non-promoted peers in the same SKU and format.

The naive baseline understates lift by −19.9%: a four-week average lags the demand dip the manager reacted to. The forecast is off by −3.7%, with WAPE falling from 24.5% to 7.6%. DiD does not rescue it: the confounder is idiosyncratic, so control stores do not share it.

### Lift ledger

The ledger is computed per wave (store × week × category) so a non-promo cell is attributed once. Against the oracle: own lift −3.7%, cannibalisation +9.3%, halo −9.0%, net −1.1%. Halo no longer outweighs cannibalisation and the pantry drag is real: net lift is 20.55% below own.

### Margin and depth

Promo P&L: revenue +68.5 m RUB, discount 60.0 m RUB, supplier funding +15.6 m RUB, incremental profit −24.4 m RUB. 97.9% of waves lose money, median −2 051 ₽. The response curve `m(d) = A·(1 − e^(−k·d))` gives breakeven depth: non-food 19.5%, bakery 8.5% and grocery 9.0%, drinks 3.0%, dairy 2.0%, frozen 1.0% — against an actual average of 25.4%.

### Test

Cluster design: store is the randomisation unit, the outcome is incremental margin per store-week. ICC 0.2197, MDE 786 ₽ per store-week. Over 1,000 null splits the false-positive rate is 4.3%, power at the MDE 77.8%, CI coverage 95.3%. A classic switchback with a common switch week rejected 100% under the null — week effects absorbed the treatment; a per-store phase with two-way demeaning gives 5.2% and recovers an injected carryover of 0.5 as 0.495.

### Model and policy

The model predicts incremental margin per cell: R² 0.925, Qini 0.963 [0.958; 0.967], calibration slope 1.10. At 20% capacity ranking by score loses −55 396 ₽; a threshold of positive score earns +54 361 ₽ on 285 cells; the oracle under the same rule earns +98 280 ₽. The gap between threshold and ranking is +109 757 ₽, CI [97 505; 121 569].

### Allocation

One planning week, 4,756 candidates after a six-week spacing rule, depth 5–40% capped at the category ceiling. On a 444.8 k RUB budget: optimiser +231 496 ₽, top-15% +136 648 ₽, random +21 888 ₽. Blanket 15% across all candidates loses −851 508 ₽ on 4.45 m. Greedy matches brute force on a small instance.

On a loose 2.22 m RUB budget the binding constraint is the ceiling, not the money: the optimiser spends 841 k RUB and earns +267 850 ₽ across 14 484 cells, leaving 1.38 m RUB unspent, while top-15% reaches only +191 502 ₽ for 1.07 m RUB. The budget stops being the decision as soon as depth is capped.

### Superset and Spark

Four SQL marts and a SQLite mart database. The specification describes three dashboards, while the live instance provisions a single "Promo Margin Lab" dashboard with four charts in a 2×2 grid — the gap is labelled rather than hidden. The static render is built from the same queries and its footer marks it as a render, not the live Superset.

The PySpark job (4.2.0 on a local Java 25) reconciles against pandas on 10 stores and 780 store-week rows: a maximum absolute difference of 0.0 across six metrics and no row missing on either side; the generated plan shows a broadcast join, a window and a shuffle. At 16.6 m rows it materialises 166,000 output rows in 14.1 s on `local[4]`. That is a correctness check on a single JVM, not a cluster throughput claim — the artefact `reports/spark_parity.json` says so.

### Reproducibility

One entry point, `python run.py --stage all`, over the stages data, panel, baseline, ledger, experiment, response, allocation, marts and spark. The `--fast` profile builds a panel nine times smaller (40 stores instead of 120), writes artefacts with a `_fast` suffix and never overwrites the headline numbers. 85 tests, including the Spark-to-pandas parity check and a guard that no `truth_*` column reaches the features.

## Result

Measurement flips the decision. The naive baseline understates lift by −19.9%, the forecast by −3.7%: a 5.3× difference in bias, and it explains why "the promo worked" and "the promo earned" are different claims.

In money, promo returns +68.5 m RUB of revenue and −24.4 m RUB of incremental profit. 97.9% of waves lose money at a median of −2 051 ₽. The reason is not lift alone: halo no longer outweighs cannibalisation and the pantry drag is real, with net lift 20.55% below own, while the discount is paid on units that would have sold at full price.

The depth ceiling is 1.0–19.5% by category against an actual average of 25.4%: the limit is breached in all six categories, non-food included, at 30.0% actual against a 19.5% ceiling. The test design delivers an MDE of 786 ₽ per store-week at a 4.3% false-positive rate and 77.8% power.

Qini 0.963 does not save the decision: ranking loses −55 396 ₽, a calibrated threshold earns +54 361 ₽, a gap of +109 757 ₽. On the same budget the optimiser earns +231 496 ₽ against +136 648 ₽ for top-15% and +21 888 ₽ for random.

### Decision

The recommendation is **not to continue in the current configuration**: hold depth at the category ceiling and fund only cells with positive expected margin — 3.7% of candidates rather than the whole catalogue. The reason is not the model but the economics: at an actual depth of 25.4% against a 1.0–19.5% ceiling, the discount eats margin faster than the lift returns it.

What would change it: tiered supplier funding (the data carry a flat rate, so tiers are not modelled), a different elasticity (at a 0.85 multiplier the selection changes by 20.4% and profit falls to 168 k RUB; at 1.15 it is 14.6% and 383 k RUB), and a sharper test — an MDE of 786 ₽ per store-week is too coarse to separate policies, while a switchback carries an SE of about 31 ₽.

## Limitations

The data are synthetic: that is a feature, not a discount — the truth is known, so the estimator can be scored against an oracle. But real promo decisions need real data: external validation on a public dataset is not done.

Supplier tiers are not modelled: the generator has a flat funding rate, and a tier schedule would be an invented assumption. One planning week is not a season.

Docker Hub is unreachable from the build machine, so Superset runs without Docker — Python 3.11 and pinned requirements. The live instance is verified: SQL Lab returns the same −24.4 m RUB and 9,053 waves as the ledger, and the asset export is committed to the repository.

## Documentation

- [Case PRD](https://github.com/NikitaBoyarkin/obsidian/blob/main/reports/prd/promo-margin-lab.md) — requirements and acceptance criteria, including honest refusals.
- `docs/data-contract.md` — schemas, formulas and the guaranteed component identity.
- `docs/metric-definitions.md` — every number with its denominator.
- `docs/experiment-design.md` — pre-registration: unit, MDE, analysis plan, threats.
- `docs/decision-memo.md` — the depth decision and its price.
- `reports/superset/dashboard.html` — the static render; `superset/README.md` — how to run the live stack.
