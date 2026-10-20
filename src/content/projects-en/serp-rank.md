---
title: SERP Rank Lab
description: "On a synthetic log, two policies on one information set: money buys +34.45% revenue per search for −16.84% CTR, while the user_id rollout returns −14.26% and a do-not-ship verdict."
star:
  situation: "A metasearch product earns on the position an offer occupies, so ranking and monetisation are not measured by the same number"
  task: "Find out how much revenue ranking for money produces, and what that revenue is paid for in clicks"
  action: "Two feasible policies on one information set, a user_id rollout with guardrails and a stopping rule, then a diagnosis through the signal source"
  result: "On a synthetic log: +34.45% revenue per search for −16.84% CTR; the rollout returns −14.26% (p = 0.11) and −16.05% conversion → do not ship"
track: analytics
hero: images/serp-rank.svg
ogImage: /images/og/serp-rank.png
impact:
  - "Two feasible policies on one information set: money buys +34.45% revenue per search (1111.30 vs 826.56 ₽) at −16.84% CTR (0.1435 vs 0.1726)."
  - "The price of that choice in roubles is 982 ₽ per forgone click: the revenue a click must carry for the trade to break even."
  - "The user_id rollout: production 1221.28 vs revenue_objective 1047.08 ₽ per search → −14.26% (p = 0.11, CI [−31.94%, +3.41%]), CTR −13.06% (p < 1e-5), booking conversion −16.05% (p = 0.009) → do_not_ship."
  - "Diagnosis: production wins on its blend, not on its objective — the blend mixes in the simulator's true relevance (serp_sim.py:452-458), and the learned models have no such signal. The bottleneck is the signal, not the objective."
  - "NDCG and money diverge (0.985 vs 0.883), and the trained CTR ranker at 826.56 loses to sorting by price at 843.91 — offline NDCG is a bad release gate."
tools:
  - Python
  - DuckDB
  - Streamlit
  - NumPy / SciPy
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/serp-rank-lab
date: 2026-10-11
updated: 2026-10-20
bet: "The bottleneck is the signal, not the objective: until a ranker sees the relevance the production blend sees, any optimisation for money buys clicks, not revenue."
rejected:
  - option: "Ship revenue-objective straight away: offline it returns +34.45% revenue per search"
    why: "The offline gap does not transfer to the rollout: −14.26% on revenue, while the CTR and conversion guardrails are breached significantly."
    cost: "Declining costs +34.45% revenue per search in the model — but that is the price of a click we would have lost: 982 ₽ per click."
  - option: "A trained CTR ranker as a replacement for the production blend"
    why: "It loses even to sorting by price (826.56 vs 843.91): click logs carry none of the relevance signal the production blend mixes in."
    cost: "The case ships no ML ranker; the upside is in the data, not in the model."
  - option: "The '+38% revenue' headline from the oracle pair"
    why: "Both oracle policies read the simulator's ground truth, and the affinity/price_index anti-correlation is a modelling assumption (ceiling_oracle.label: modeled)."
    cost: "The honest headline is smaller: +34.45% instead of +38%, and it already comes with a CTR price."
demo: demos/serp-rank/index.html
related:
  - /projects/volta/
  - /projects/ab/
  - /projects/cohort/
faq:
  - question: "Why not ship it if offline revenue is higher?"
    answer: "The +34.45% offline gap is a model number, while the user_id rollout returns −14.26% (p = 0.11) with breached guardrails: CTR −13.06%, booking conversion −16.05%. The stopping rule fires on a guardrail, not on revenue."
  - question: "Where did +38% go?"
    answer: "It was the gap of the oracle pair: both policies read the simulator's ground truth, and the affinity/price_index anti-correlation is a modelling assumption. That ceiling is labelled modeled; on one information set the money upside is +34.45%."
  - question: "What does the revenue cost in clicks?"
    answer: "982 ₽ per forgone click. Money buys +34.45% revenue per search at −16.84% CTR; the breakeven states the click value at which the trade is neutral."
  - question: "Why does the production policy win if it does not optimise money?"
    answer: "Its blend mixes in the true relevance (serp_sim.py:452-458). The learned models have no such signal, so they lose to the data source, not to the objective."
  - question: "Can NDCG stay as the release gate?"
    answer: "No: the policy at NDCG 0.985 earns less than the one at 0.883, and the trained ranker at 826.56 loses to sorting by price at 843.91. The offline metric and the money move in opposite directions."
---

# SERP Rank Lab

**▶ [Data-flow diagram](/diagrams/serp-rank-lab.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

A metasearch site sells no tickets. Its revenue is a partner commission or a cost-per-click, multiplied by **which position** the offer occupied on the results page. So the role rests on two questions: how to rank offers, and how much revenue a given ranking policy produces per search.

The second question is usually replaced by the first: the offline relevance score rises while the money does not. On this surface both policies can be placed on one and the same information set, so the price of the choice gets measured instead of argued about.

## Task

I needed to carry the ranking analysis to a decision: compare two policies that can actually be switched on, measure what the revenue costs in clicks, and test whether the offline gap transfers to a rollout.

## Actions

### Layers

| Layer | Files | Role |
|-------|-------|------|
| Data | `src/data_ingest.py`, `src/synthetic_raw.py`, `sql/01_normalize.sql` | booking feed → one row per leg; synthetic raw from a seed so the pipeline runs from an empty folder |
| Sessions | `src/sessions.py`, `sql/02_sessions.sql` | 30-minute inactivity + date-boundary session rule |
| SERP | `src/serp_sim.py` | synthetic pages over real route/price pairs; PBM click model; CPA/CPC economics |
| Policies | `src/policies.py`, `src/outcomes.py` | re-rank a SERP by policy and re-draw outcomes under the new order |
| Evaluation | `src/ranking_eval.py`, `sql/03_funnel.sql`, `sql/04_revenue_per_search.sql` | unbiased CTR, NDCG/MRR, revenue per search |
| Experiment | `src/stats.py`, `src/experiment.py` | SRM, A/A, delta method, CUPED, mSPRT, peeking |
| Surface | `app.py`, `run.py` | Streamlit dashboard; single pipeline entry point |

### The objective

Two **feasible** policies are compared on one and the same information set (`logged`, 12 000 searches): `ctr_objective` optimises the click, `revenue_objective` optimises the money.

Money buys **+34.45% revenue per search** (1111.30 vs 826.56 ₽) at **−16.84% CTR** (0.1435 vs 0.1726). In roubles the price of the choice is **982 ₽ per forgone click**: the revenue a click must carry for the trade to be neutral.

The oracle policies (`relevance`, `revenue`) stay out of the headline: both read the simulator's ground truth, so their gap is a constructed ceiling (`ceiling_oracle.label: "modeled"`), not a result that can be shipped.

### The rollout

Arms are assigned by `user_id`, the control is the production policy and the test is `revenue_objective`; the 90/10 split passes SRM (p = 0.61). The primary metric is revenue per search, with its variance from the delta method clustered by user. Guardrails: CTR, booking conversion, mean price in the top-5, share of offers above their route median.

Stopping rule: a guardrail worse than 10% in its harmful direction and significant at 5% — do not ship, regardless of revenue.

### Diagnosis

The rollout explains why the offline gap does not transfer. The production policy wins not because it optimises money but because its blend mixes in the true `relevance` (`src/serp_sim.py:452-458`). The learned models have no such signal — **the bottleneck is the signal, not the objective**.

### The failed hypothesis

A ranker trained on clicks was supposed to beat both the production blend and price sorting. It loses to both: 826.56 against 843.91 ₽ per search for sorting by price.

### Methods

- **Position bias (PBM).** Examination probability decays with position as `(1/k)^η`; a click is examined × relevance.
- **Unbiased CTR.** Horvitz–Thompson inverse-propensity weighting, with the curve known or fitted by EM.
- **Ratio metrics.** Revenue per search is a ratio of sums, so its variance comes from the delta method, not a naive per-unit t-test.
- **Sequential testing.** A fixed horizon against an always-valid mSPRT to quantify the peeking penalty.

### Run

```bash
uv sync --all-groups
uv run python run.py --stage all      # ingest → sessions → serp → sql → rank → experiment → business
uv run pytest -q
uv run streamlit run app.py           # dashboard on :8501
```

## Result

| Check | Result | Reading |
|-------|--------|---------|
| Revenue per search, two feasible policies | 1111.30 vs 826.56 ₽ (+34.45%) | money is bought with clicks |
| CTR of the same policies | 0.1435 vs 0.1726 (−16.84%) | the price of that purchase |
| Breakeven | 982 ₽ per forgone click | the revenue a click must carry for the trade to be neutral |
| `user_id` rollout, revenue per search | 1047.08 vs 1221.28 ₽ (−14.26%), p = 0.11, CI [−31.94%, +3.41%] | the offline gap does not transfer |
| CTR guardrail | −13.06%, p < 1e-5 | the 10% threshold is breached |
| Booking-conversion guardrail | −16.05%, p = 0.009 | the 10% threshold is breached |
| SRM against the planned 90/10 | p = 0.61 | the split is sound |
| NDCG@10 vs revenue | 0.985 vs 0.883 | the metric and the money move in opposite directions |
| Trained ranker vs sorting by price | 826.56 vs 843.91 ₽ | the hypothesis failed |
| Naive vs position-free CTR | 0.1630 vs 0.6287 | understated roughly fourfold |
| Peeking, 6 looks | 15.0% vs 0 for always-valid mSPRT | naive looks inflate the FPR |
| Logged revenue/search | 1225.63 ₽ | the observed baseline the policies sit under |

**Decision: do not ship.** Offline the revenue is +34.45% higher, but in the rollout the policy loses −14.26% revenue per search, −13.06% CTR and −16.05% conversion. The `do_not_ship` verdict comes from the guardrails, not from the revenue.

**What this changes about the problem.** The next thing to improve is the signal, not the objective: while the data holds none of the relevance the production blend sees, any money optimisation buys a click. That is also why offline NDCG (0.985 vs 0.883) is a bad release gate, and why the trained ranker (826.56) cannot replace the production blend — it loses even to sorting by price (843.91).

The pipeline runs end-to-end from a fixed seed, including the synthetic raw generation, so a clean clone reproduces these numbers.

## Limitations

The synthetic SERP layer resembling real traffic is an **inference** — no real impression log exists for this surface, so every ranking and A/B number comes from a model, not a measurement. The oracle ceiling (+38%) follows from the assumed `affinity`/`price_index` anti-correlation, so it is labelled `modeled` and plays no part in the decision.

The experiment is 6 000 searches; the MDE of such a run is 15.57% against the observed −14.26%, so the effect sits at the edge of detectability and the conclusion rests on the significant guardrails, not on the primary metric. Two islands of real data (orders and booking legs) carry no foreign key to the clickstream and are reported separately, never fused with the modeled SERP metrics. Raw third-party data is not committed: the repository holds only the loader, the SERP generator and the SQL.

## Documentation

- [GitHub → serp-rank-lab](https://github.com/NikitaBoyarkin/serp-rank-lab)
