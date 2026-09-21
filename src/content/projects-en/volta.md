---
title: Volta Neobank — Product Analytics
description: "Fixed a neobank's onboarding bottleneck with an A/B test: +5.72pp KYC conversion, €656K/year. 23 projects: funnel → A/B → retention → segmentation → Market & Jobs → RAT v2 → causal."
track: experiments
hero: images/volta.svg
impact:
  - +5.72pp KYC conversion (Z=5.82, p<0.0001), €656K/yr (44× ROI)
  - +9.2pp M3 retention, +€227K/yr incremental LTV
  - 4 data-driven user segments with per-segment monetization strategy
  - CUPED variance reduction + AA-test (type-I = 0.050) + Bonferroni correction
  - "DiD check: the KYC fix causally lifted M3 retention by +9.09pp (95% CI [+6.21, +11.96])"
  - "RAT v2: 5 audit risks priced in money — 3 confirmed, 1 refuted by mechanism, 1 refined"
  - "23 projects: 12 analytical domains + Market & Jobs (JTBD) + the RAT v2 validation layer + causal"
tools:
  - Python
  - pandas / NumPy
  - SciPy / Statsmodels
  - scikit-learn
  - Matplotlib / Seaborn
  - uv + ruff
github: https://github.com/NikitaBoyarkin/volta-banking
updated: 2026-09-20
demo: demos/volta/index.html
date: 2026-08-11
faq:
  - question: "What does the RAT v2 layer add?"
    answer: "5 audit risks priced in money: assisted onboarding for 45+ doesn't pay off (LTV/CAC 0.66, gate ≥3), the FX gate is reachable only at SOM scale (~€332M/mo), segment offers add +3.3…+4.2pp, the anchor launch holds to ~70K, and light-touch win-back for 45+ pays off only at 30–90 days."
  - question: "Where is the onboarding drop-off?"
    answer: "KYC is the critical bottleneck: the largest relative drop-off (56.6% step conversion)."
  - question: "Does the progress bar fix the KYC problem?"
    answer: "Yes: +5.72pp lift (p<0.0001), 95% CI [+3.78%, +7.66%], above the +5pp MDE → ship."
  - question: "Did the effect hold?"
    answer: "Yes: +9.2pp M3 retention, +€227K/yr incremental LTV. A DiD check confirms causality: ATT +9.09pp (95% CI [+6.21, +11.96])."
  - question: "Who are the users, how to monetize?"
    answer: "4 segments (Power 12% / Growth 24% / Casual 32% / Dormant 32%) with per-segment strategy; migration worth up to +€310K/yr."
related:
  - /posts/bayesian-ab-testing/
children:
  - funnel
  - ab
  - retention
  - segmentation
  - churn
  - rfm
  - clv
  - attribution
  - anomalies
  - spend
  - support-churn
  - nps
  - jtbd
  - unit-economics
  - premium-upsell
  - kyc-45
  - referral
  - assisted-cac
  - fx-sourcing
  - premium-offers
  - anchor-cac
  - dormant-winback
  - causal-kyc
---

# Volta Neobank — Product Analytics

## The 30-second version

- **Problem:** KYC was the onboarding bottleneck — the largest relative drop-off (56.6% step conversion).
- **Fix:** a KYC progress bar lifted conversion **+5.72pp** (p < 0.0001), above the +5pp MDE.
- **Money:** modelled business impact **€656K/yr** at 44× ROI.
- **Retention:** the effect held — **+9.2pp** M3 retention, **+€227K/yr** incremental LTV.
- **Causality:** a DiD check confirms the fix *caused* the shift: M3 retention **+9.09pp** (95% CI [+6.21, +11.96]).

## Goal

«Volta» is a fictional neobank that was losing users during onboarding. Marketing saw traffic, product saw activation, support saw tickets. Every team had its own number — and none of them explained where the money was leaking. We started with one question: **which onboarding step is critical?**

We answered it with four projects wired into a single **discover → validate → measure → optimize** loop. Each project is a piece of evidence that narrows the case. All data is synthetic, generated deterministically (seed), and reproduced from code: any conclusion can be re-checked by re-running, not taken on faith.

## Data & Method

**Data:** synthetic, seeded generators (`generate_*.py`) → reproducible CSVs. The funnel dataset is committed; the rest are generated on demand.

**Per-project methodology:**

1. **Funnel** — step conversion, absolute/relative drop-off, Chi-square test across channels. Registration loses the most users in absolute terms (2,682, 73.2% step conv); KYC Complete has the largest relative drop-off (56.6% step conv). Referral converts 11.7pp better than paid social; iOS beats Android at every step (13.6% vs 11.7% end-to-end).

2. **A/B (KYC progress bar)** — sample size calculation, SRM check (p=1.00), bootstrap CI, multiple-comparison correction (Bonferroni/Holm/BH), AA-test under H₀ (type-I = 0.050), CUPED (control-only θ), sensitivity at MDE. Control 55.8% → treatment 61.5%, **+5.72pp**, 95% CI [+3.78%, +7.66%], exceeds the +5pp MDE. Ship-gate: p<0.05 ∧ lift≥MDE ∧ no SRM → ship. 6/11 naively-significant segments, 4/11 after Bonferroni.

3. **Retention** — cohort curves, pre/post Welch t-test + Cohen's d, plan-specific LTV (ARPU × retention decomposition). M1 retention +11.8pp step-change, M3 +9.2pp.

4. **Segmentation** — StandardScaler + KMeans, data-driven K (marginal-gain elbow, silhouette plateau K=2–4, collapse at K=5). Segments: Power 12% / Growth 24% / Casual 32% / Dormant 32%. Lorenz: 12% of users → 41% of revenue; 68% → 92%. Migration scenarios: +€26K/mo (€310K/yr).

5. **Causal (DiD)** — naive pre/post vs difference-in-differences: treated = in-app KYC, comparison = partner, cutoff 2024-09. 2×2 DiD + covariate-adjusted with cohort-clustered SE, parallel-trends check, placebo outcome, SMD/overlap. ATT on M3 retention +9.09pp (95% CI [+6.21, +11.96]); naive overstates activation (+6.29pp vs DiD +4.92pp).

**RAT v2 methods (projects 18–22):** LTV per user (ARPU × contribution margin × retention months) and blended CAC with bootstrap CIs, Welch t-test anchor vs 45+; liquidity-provider quotes and log-interpolation of the required volume.

A randomized A/B of segment offers with Holm correction and a segment × arm (DiD) interaction; marginal-CAC curves by channel, cheap-first greedy allocation and the break-even scale; a three-arm win-back (auto / light-touch / human) with z-tests and ROI per 10K treated.

**Code structure:** shared `utils/common.py` (`setup()`, `print_section()`, `CONSTANTS`, `data_path()`), `functions + main()` — importing a module does not run the analysis. Excel reports via `openpyxl`.

## Project map

23 sub-projects, grouped by the layers of the **discover → validate → measure → optimize** loop. Every row is a result-first finding and a link to its case file.

<!-- volta-map:start -->
### Core — the discover → validate → measure → optimize loop

- [Funnel Analysis](funnel/) — The neobank onboarding funnel: KYC is the bottleneck at 56.6% step conversion, registration loses the most in absolute terms (2,682). Broken down by channel and platform.
- [KYC Progress-Bar A/B Test](ab/) — A KYC progress bar lifted conversion +5.72pp (Z=5.82, p<0.0001) against a +5pp MDE. CUPED, AA-test and Bonferroni protect the conclusion; +€656K/yr at 44× ROI.
- [Retention & Cohorts](retention/) — Cohort triangles showed a step-change after the KYC fix: M1 +11.8pp, M3 +9.2pp and +€227K/yr LTV. Premium LTV is 4.3× Free.
- [User Segmentation](segmentation/) — KMeans with data-driven K=4: Power 12% drive 41% of revenue, 68% drive 92%. Cross-segment migration is worth up to +€310K/yr.

### Extended — expanded portfolio

- [Churn Prediction](churn/) — Random Forest adds +0.03 ROC-AUC over logistic regression; the top churn driver is device-error rate (23.7%), not balance or activity.
- [RFM Analysis](rfm/) — R/F/M scoring 1–5 splits the base into lifecycle segments from Champions to Lost; recency and monetary diverge — 'frequent but cheap' and 'rare but large'.
- [CLV Modeling](clv/) — Three lifetime-value methods: historical, retention-curve and Gamma-Gamma. The order Power > Growth > Casual > Dormant is robust across all methods.
- [Marketing Attribution](attribution/) — First-touch, last-touch, linear and Shapley attribution. Shapley (data-driven) reallocates budget and leads with referral; the conclusion is robust to model choice.
- [Anomaly Detection](anomalies/) — Z-score, IQR and Isolation Forest against ground truth. IF has the best F1 (50.4%), catching amount, night-hour and frequency anomalies; Z-score is precise but cautious.
- [Spend Analysis](spend/) — Spend breakdown by category and channel: bills (25.8%) and travel (20.2%) make up nearly half the turnover, groceries is the most frequent category.
- [Support & Churn](support-churn/) — Churn rises with ticket count: 37.1% at zero contacts vs 81.1% at 3+. Support is a measurable retention lever, not just a cost center.
- [NPS Trends](nps/) — Monthly NPS hovers near zero; the strongest drivers are app quality (+30.3) and product (+29.4), the main source of dissatisfaction is fees (−59.4).

### Market & Jobs — JTBD segments

- [JTBD × Cohorts](jtbd/) — Job segments and behavioral cohorts are not independent (chi² p<0.001): Dormant concentrates in Digital Newcomers 45+ (39.4%) vs Family Budgeters (15.1%).
- [Traveler Unit Economics](unit-economics/) — Travelers lose €0.45 per €100 FX transaction; break-even needs FX cost cut from 1.00% to 0.55%, otherwise the loss grows with volume.
- [Premium Upsell](premium-upsell/) — Free→Premium conversion concentrates in the anchor (17.3%) and status-seekers (41.2%); Digital Newcomers 45+ convert just 1.8% — the value prop doesn't transfer.
- [45+ KYC Deep-Dive](kyc-45/) — Age-sliced A/B HTE: 35–44 +11.0pp and 18–24 +5.3pp, but 45+ +1.4pp (ns). Referral (trust) converts 45+ best — friction is trust, not UX.
- [Referral Segments](referral/) — Referral funnel by JTBD segment: anchor 29.6% vs Digital Newcomers 45+ 4.8% and families 8.6%. The gap opens at accept, not KYC.

### RAT v2 — pricing the audit in money

- [Assisted CAC vs LTV](assisted-cac/) — Does the 45+ trust track pay off: 45+ LTV/CAC = 0.66 against a ≥3 gate; assisted CAC €120 is ~3× referral and doesn't pay back (50-month payback).
- [FX Sourcing Feasibility](fx-sourcing/) — The 0.55% gate is reachable only at SOM scale (~€332M/mo, 122× today) — a cold-start, not 'impossible'. Best quote is Interbank Prime at 0.745%.
- [Segment Premium Offers](premium-offers/) — A/B: a segment offer lifts gap segments (+3.3pp 45+, +4.2pp families, +3.8pp travelers) — Holm-significant, but the anchor barely moves.
- [Anchor Launch CAC at Scale](anchor-cac/) — LTV/CAC ≥3 holds only to ~70K users; at SOM it falls to 1.76× and a 17-month payback. The constraint is cheap-channel capacity, not budget.
- [Dormant 45+ Win-back](dormant-winback/) — Three-arm win-back: human +5.34pp and light-touch +2.77pp vs control. Light-touch pays off at 30–90d (ROI 2.54 / 1.26), human ROI 0.40 — kill as a mass channel.

### Causal — causal validation

- [Causal Validation of KYC (DiD)](causal-kyc/) — A DiD test shows the KYC fix causally lifted M3 retention by +9.09pp (95% CI [+6.21, +11.96]) — flat pre-trends, placebo ≈ 0, max |SMD| 0.157 < 0.2.
<!-- volta-map:end -->

## Evidence #1–4

### Evidence #1 — Funnel: where the leak is

The first piece of evidence is the onboarding funnel down to the first productive action. The main leak was in **KYC** — the verification step: the largest relative drop-off (56.6% step conversion). Registration loses more in absolute terms (2,682 users, 73.2% step conv), but KYC is more expensive: the user has already made it halfway and still leaves.

Hypothesis: the form is too long and there is no intermediate confirmation.

→ [Funnel Analysis — case file](funnel/)

### Evidence #2 — A/B: does the fix work

A snapshot is not proof: we validated the funnel finding as an experiment, not a slice. Hypothesis: split KYC into steps with a progress bar.

Test design:

- **CUPED** with "sessions before the test" as covariate — removed part of the noise, the sample did not grow
- **AA-test** before launch: Type I error = 0.050 — the method does not imagine significance
- **Bonferroni** across multiple metrics — multiplicity control
- **Ship-gate**: ship only if significance ∧ lift ≥ MDE ∧ no SRM

Verdict: control 55.8% → treatment 61.5%, **+5.72pp**, p < 0.0001, 95% CI [+3.78%, +7.66%], above the +5pp MDE → **ship**. At a realistic audience this is ≈ **€656K/yr** at 44× ROI.

→ [A/B Testing — case file](ab/)

### Evidence #3 — Retention: does the effect hold

Shipping is not the end: we checked the effect on retention with cohort triangles (signup month × age) instead of "the average across everyone". Along the diagonal: cohorts with the new onboarding hold **M3 retention at +9.2pp** over older cohorts → **+€227K/yr incremental LTV**. The new onboarding improves both the first week (faster time-to-value) and month 3 (less churn after the "honeymoon"). Without triangles, this conclusion would hide behind the average.

A separate **DiD check** separated the causal effect from background trends: M3 retention **+9.09pp** (95% CI [+6.21, +11.96]), flat pre-trends (p = 0.29–0.70), placebo ≈ 0, max |SMD| 0.157.

→ [Retention & Cohort — case file](retention/) · [Causal Validation (DiD) — case file](causal-kyc/)

### Evidence #4 — Segmentation: who pays

The effect held — the remaining question was who these users are and how to monetize them. StandardScaler + KMeans, data-driven K: **4 segments** — Power 12% / Growth 24% / Casual 32% / Dormant 32%. Lorenz: 12% of users drive 41% of revenue; 68% → 92%. Migration scenarios: up to **+€310K/yr**.

→ [User Segmentation — case file](segmentation/)

## The RAT v2 Layer — validating the audit itself

After the JTBD audit, the portfolio tests **its own recommendations**: five v2 risks are priced in money rather than left as opinion. Every project returns a ship / pilot / hold / kill gate.

| # | v2 risk | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Assisted onboarding for 45+ costs more than 45+ LTV | ✅ confirmed | Project 18: 45+ LTV/CAC = 0.66 (gate ≥3), 50-month payback |
| 2 | FX cost can't be negotiated to ≤0.55% | ✅ confirmed (as a cold-start) | Project 19: the gate needs ~€332M/mo, 122× the current volume |
| 3 | Segment premium offers won't lift gap segments | ⚠️ partially refuted | Project 20: +3.3…+4.2pp, Holm-significant — narrows but doesn't close the gap |
| 4 | The anchor's paid CAC breaks launch P&L | ✅ confirmed | Project 21: LTV/CAC 1.76 at SOM, the gate holds only to ~70K |
| 5 | Assisted onboarding doesn't bring back Dormant 45+ | ❌ refuted by mechanism | Project 22: human +5.3pp, light-touch +2.8pp — the barrier was UX; only light-touch 30–90d pays off |

Bottom line: **3 risks confirmed, 1 refuted, 1 refined** — the audit survived the check and every decision got a measurable gate. Project 16 (the 45+ KYC deep-dive) bridges the layers: it showed the 45+ barrier is trust, not UX, and set off the whole v2 validation chain. The causal layer (Project 23) is an independent check of the flagship's central claim.

## Recommendations & gates

A summary of decisions across all 23 projects: what to do, on what evidence, under which gate, with what caveat.

**1. Onboarding & KYC — remove the main bottleneck**

- Roll out the KYC progress bar to 100% (Project 2: +5.72 pp, p<0.0001, +€656K/yr at 44× ROI).
- Simplify registration (Project 1: −2,682 users) — A/B on removing the phone field.
- A separate trust track for 45+, but not UX-only (Project 16: 45+ +1.4 pp ns vs +11.0 pp for 35–44).

**2. Unit economics & scaling — don't scale what loses money**

- Don't scale travel until FX cost ≤0.55% (Project 14/19: margin −€0.45; the gate needs ~€332M/mo — a cold-start).
- The anchor 25–34 is the growth point, but plan only to ~70K (Project 21: LTV/CAC ≥3 only to 70K; 1.76 at SOM).
- Grow cheap-channel capacity (referral, in-app) instead of increasing paid budget.

**3. Monetization & segments — defend the core, fix the gap**

- Defend Power (12% → 41% of revenue) and upgrade Growth/Casual; Dormant (32% of users, 7.8% of revenue) is the win-back target.
- Launch segment premium offers (+3.3…+4.2 pp, Project 20), planning for the residual gap.
- Premium status is margin to defend (41.2% status-seeker conversion), not a growth channel.

**4. Retention & reactivation — economics over reach**

- Light-touch win-back only at 30–90 days (Project 22: ROI 2.54 / 1.26); human is an escalation for high-value.
- Prevent churn through reliability: the top driver is device-error rate (Project 5).
- Premium LTV is 4.3× Free (Project 3) — target high-intent Free in the first 1–2 months.

**5. Trust & channels — don't copy the anchor playbook**

- Don't scale referral beyond the anchor (Project 17: 29.6% vs 4.8%) — segment incentives first.
- Assisted onboarding pays off only below the current €120 CAC (Project 18: 45+ LTV/CAC 0.66, 50-month payback).
- Provider choice + a long hedge is the second-strongest discount after volume (Project 19).

**6. Decision gates (ship / pilot / hold / kill)**

| Initiative | Evidence | Gate | Decision |
|------------|----------|------|----------|
| KYC progress bar | Project 2: +5.72 pp, p<0.0001 | p<0.05, lift≥MDE, no SRM | **Ship 100%** |
| Segment premium offers | Project 20: +3.3…+4.2 pp, Holm | lift>0 after correction | **Ship** (residual gap) |
| Light-touch win-back 30–90d | Project 22: ROI 2.54 / 1.26 | ROI ≥ 1 | **Ship** narrowly at 30–90d |
| Assisted trust track 45+ | Project 18: LTV/CAC 0.66, 50-month payback | LTV/CAC ≥ 3, payback ≤ 12 mo | **Hold** — cut CAC |
| Scaling travel | Project 14/19: margin <0, gate €332M/mo | FX cost ≤ 0.55% | **Hold** — pilot at 10% |
| Anchor launch to SOM | Project 21: LTV/CAC 1.76 at SOM | LTV/CAC ≥ 3 | **Hold** — to 70K |
| Human win-back calls | Project 22: ROI 0.40 | ROI ≥ 1 | **Kill** as a mass channel |

## The Verdict

A loop of four projects beats isolated analyses: the KYC fix found in the funnel was validated in the A/B test, confirmed in retention, and translated into money through segmentation. The core is the **three-condition ship-gate** (significance ∧ lift ≥ MDE ∧ no SRM): it protects against shipping statistically-significant but business-insignificant changes. Order matters more than numbers: calibrate the instrument first (AA-test, CUPED), then conclude. Causality is checked separately with DiD, not left as correlation.

## Limitations

Volta is a fictional bank and all data is synthetic and seeded: the figures (€656K/yr, 44× ROI, +9.2pp) show **the correctness of the methodology on a modelled product**, not a real launch result. ROI is computed against a €15K dev cost without subtracting margin, so it is an upper bound. The RAT v2 layer prices the portfolio's own recommendations, but on the same synthetic assumptions.

## Other projects

Volta is the flagship, not the only case: each layer of the loop rests on a separate discipline, broken down in the sibling portfolio projects.

- [SQL Analytics Case Study](../sql/) — window functions, cohorts and retention analytics in SQL.
- [Cohort Retention Analysis](../cohort/) — reading cohort triangles, and why the average lies.
- [Churn Prediction & Uplift](../churn/) — churn forecasting and uplift modelling.
- [RFM Segmentation](../rfm/) — segmentation by recency, frequency and money.
- [Causal Inference](../causal/) — DiD and estimating causal effects without randomization.
- [A/B Testing in banking](../ab/) — CUPED, AA-test and a ship-gate on a real experiment.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
- [Interactive demo](/demos/volta/index.html) — the project KPI dashboard.
