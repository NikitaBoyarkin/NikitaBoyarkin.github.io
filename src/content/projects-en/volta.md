---
title: Volta Neobank — Product Analytics
description: "Fixed a neobank's onboarding bottleneck with an A/B test: +5.72pp KYC conversion, €656K/year. 22 projects: funnel → A/B → retention → segmentation → Market & Jobs → RAT v2."
track: experiments
hero: images/volta.svg
impact:
  - +5.72pp KYC conversion (Z=5.82, p<0.0001), €656K/yr (44× ROI)
  - +9.2pp M3 retention, +€227K/yr incremental LTV
  - 4 data-driven user segments with per-segment monetization strategy
  - CUPED variance reduction + AA-test (type-I = 0.050) + Bonferroni correction
  - "RAT v2: 5 audit risks priced in money — 3 confirmed, 1 refuted by mechanism, 1 refined"
  - "22 projects: 12 analytical domains + Market & Jobs (JTBD) + the RAT v2 validation layer"
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
    answer: "Yes: +9.2pp M3 retention, +€227K/yr incremental LTV."
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
caseStudy:
  problem: "The neobank was losing users during onboarding, but it was unclear which step was critical and whether a fix would actually hold. Isolated analyses produced local numbers with no product-level connection."
  approach: "Four projects wired into a single discover → validate → measure → optimize loop: funnel found the KYC bottleneck, an A/B test with CUPED + AA-test + Bonferroni validated a progress-bar fix under a three-condition ship-gate (significance ∧ lift≥MDE ∧ no SRM), retention confirmed the effect held, and segmentation translated it into revenue."
  result: "The KYC fix delivered +5.72pp conversion and €656K/yr (44× ROI), the effect held in retention (+9.2pp M3, +€227K/yr LTV), and segmentation showed 12% of users drive 41% of revenue — migration is worth up to +€310K/yr. The repo has grown to 22 projects, including a RAT v2 validation layer that prices the audit's own recommendations: 3 risks confirmed, 1 refuted, 1 refined. The reproducible methodology protects against shipping statistically-significant but business-insignificant changes."
  metrics:
    - label: "KYC conversion lift"
      value: "+5.72pp"
    - label: "Annual revenue"
      value: "€656K/yr"
    - label: "ROI"
      value: "44×"
    - label: "M3 retention"
      value: "+9.2pp"
---

# Volta Neobank — Product Analytics

## The 30-second version

- **Problem:** KYC was the onboarding bottleneck — the largest relative drop-off (56.6% step conversion).
- **Fix:** a KYC progress bar lifted conversion **+5.72pp** (p < 0.0001), above the +5pp MDE.
- **Money:** **€656K/yr** business impact at 44× ROI.
- **Retention:** the effect held — **+9.2pp** M3 retention, **+€227K/yr** incremental LTV.

## The Case

«Volta» is a fictional neobank that was losing users during onboarding. Marketing saw traffic, product saw activation, support saw tickets. Every team had its own number — and none of them explained where the money was leaking. We started with one question: **which onboarding step is critical?**

We answered it with four projects wired into a single **discover → validate → measure → optimize** loop. Each project is a piece of evidence that narrows the case. All data is synthetic, generated deterministically (seed), and reproduced from code: any conclusion can be re-checked by re-running, not taken on faith.

## Evidence #1 — Funnel: where the leak is

The first piece of evidence is the onboarding funnel down to the first productive action. The main leak was in **KYC** — the verification step: the largest relative drop-off (56.6% step conversion). Registration loses more in absolute terms (2,682 users, 73.2% step conv), but KYC is more expensive: the user has already made it halfway and still leaves.

Hypothesis: the form is too long and there is no intermediate confirmation.

→ [Funnel Analysis — case file](funnel/)

## Evidence #2 — A/B: does the fix work

A snapshot is not proof: we validated the funnel finding as an experiment, not a slice. Hypothesis: split KYC into steps with a progress bar.

Test design:

- **CUPED** with "sessions before the test" as covariate — removed part of the noise, the sample did not grow
- **AA-test** before launch: Type I error = 0.050 — the method does not imagine significance
- **Bonferroni** across multiple metrics — multiplicity control
- **Ship-gate**: ship only if significance ∧ lift ≥ MDE ∧ no SRM

Verdict: control 55.8% → treatment 61.5%, **+5.72pp**, p < 0.0001, 95% CI [+3.78%, +7.66%], above the +5pp MDE → **ship**. At a realistic audience this is ≈ **€656K/yr** at 44× ROI.

→ [A/B Testing — case file](ab/)

## Evidence #3 — Retention: does the effect hold

Shipping is not the end: we checked the effect on retention with cohort triangles (signup month × age) instead of "the average across everyone". Along the diagonal: cohorts with the new onboarding hold **M3 retention at +9.2pp** over older cohorts → **+€227K/yr incremental LTV**. The new onboarding improves both the first week (faster time-to-value) and month 3 (less churn after the "honeymoon"). Without triangles, this conclusion would hide behind the average.

→ [Retention & Cohort — case file](retention/)

## Evidence #4 — Segmentation: who pays

The effect held — the remaining question was who these users are and how to monetize them. StandardScaler + KMeans, data-driven K: **4 segments** — Power 12% / Growth 24% / Casual 32% / Dormant 32%. Lorenz: 12% of users drive 41% of revenue; 68% → 92%. Migration scenarios: up to **+€310K/yr**.

→ [User Segmentation — case file](segmentation/)

## The Verdict

A loop of four projects beats isolated analyses: the KYC fix found in the funnel was validated in the A/B test, confirmed in retention, and translated into money through segmentation. The core is the **three-condition ship-gate** (significance ∧ lift ≥ MDE ∧ no SRM): it protects against shipping statistically-significant but business-insignificant changes. Order matters more than numbers: calibrate the instrument first (AA-test, CUPED), then conclude.

## Case File: repository expansion

The repo has grown from 4 core projects to **22** (12 analytical domains + Market & Jobs + the RAT v2 validation layer). Additional projects:

| # | Project | Key finding |
|---|---|---|
| 5 | **Churn Prediction** | RF +0.03 ROC-AUC over LR; top driver = device-error rate |
| 6 | **RFM Analysis** | 6 lifecycle segments |
| 7 | **CLV Modeling** | 3 methods: historical / retention-curve / Gamma-Gamma |
| 8 | **Marketing Attribution** | First/last/linear/Shapley — referral leads |
| 9 | **Anomaly Detection** | Z-score/IQR/Isolation Forest, scored vs ground truth |
| 10 | **Spend Analysis** | Category/channel breakdown, decline rate, monthly trend |
| 11 | **Support & Churn** | Churn by tickets, unresolved, CSAT band |
| 12 | **NPS Trends** | Monthly NPS, drivers, promoter mix |
| 13 | **JTBD × Cohorts** | Dormant = UX friction (Digital Newcomers 45+), not "no job" |
| 14 | **Unit Economics** | Travelers lose €/tx; break-even needs FX cost 1.0%→0.55% |
| 15 | **Premium Upsell** | Anchor 17% vs Digital Newcomers 45+ 2% — value prop doesn't land |
| 16 | **45+ KYC Deep-Dive** | 45+ lift +1.4pp (ns) vs 35-44 +11.0pp — friction is trust, not UX |
| 17 | **Referral Segments** | Anchor 29.6% vs Digital Newcomers 4.8% — value prop doesn't transfer |
| 18 | **Assisted CAC vs LTV** | 45+ LTV/CAC 0.66 (gate ≥3); assisted CAC €120 doesn't pay off — the anchor clears 3.62 only via referral |
| 19 | **FX Sourcing Feasibility** | The 0.55% gate is reachable only at SOM scale (~€332M/mo): a cold-start, not "impossible" |
| 20 | **Segment Premium Offers** | A/B: +3.3pp 45+, +4.2pp families, +3.8pp travelers (Holm-significant); the anchor barely moves |
| 21 | **Anchor Launch CAC** | LTV/CAC ≥3 holds only to ~70K; at SOM 1.76× and 17-month payback — breaks on paid CAC |
| 22 | **Dormant 45+ Win-back** | Light-touch 30–90d pays off (ROI 2.54 / 1.26); human calls at ROI 0.40 — kill as a mass channel |

## The RAT v2 Layer — validating the audit itself

After the JTBD audit, the portfolio tests **its own recommendations**: five v2 risks are priced in money rather than left as opinion. Every project returns a ship / pilot / hold / kill gate.

| # | v2 risk | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Assisted onboarding for 45+ costs more than 45+ LTV | ✅ confirmed | Project 18: 45+ LTV/CAC = 0.66 (gate ≥3), 50-month payback |
| 2 | FX cost can't be negotiated to ≤0.55% | ✅ confirmed (as a cold-start) | Project 19: the gate needs ~€332M/mo, 122× the current volume |
| 3 | Segment premium offers won't lift gap segments | ⚠️ partially refuted | Project 20: +3.3…+4.2pp, Holm-significant — narrows but doesn't close the gap |
| 4 | The anchor's paid CAC breaks launch P&L | ✅ confirmed | Project 21: LTV/CAC 1.76 at SOM, the gate holds only to ~70K |
| 5 | Assisted onboarding doesn't bring back Dormant 45+ | ❌ refuted by mechanism | Project 22: human +5.3pp, light-touch +2.8pp — the barrier was UX; only light-touch 30–90d pays off |

Bottom line: **3 risks confirmed, 1 refuted, 1 refined** — the audit survived the check and every decision got a measurable gate. Project 16 (the 45+ KYC deep-dive) bridges the layers: it showed the 45+ barrier is trust, not UX, and set off the whole v2 validation chain.

## Key results by project

### Projects 1–4 — the core loop

| # | Project | Key result |
|---|---------|------------|
| 1 | **Funnel** | Registration is the largest absolute loss (2,682 users, 73.2%); KYC Complete the largest relative one (56.6%); referral +11.7 pp over paid social; iOS 13.6% vs Android 11.7% |
| 2 | **A/B (KYC)** | +5.72 pp (Z=5.82, p<0.0001), 95% CI [+3.78%, +7.66%]; no SRM; CUPED + AA-test + Bonferroni; +€656K/yr (44× ROI) |
| 3 | **Retention** | M1 +11.8 pp step-change; M3 +9.2 pp; Premium LTV 4.3× Free; +€227K/yr LTV |
| 4 | **Segmentation** | K=4 from data; Power 12% → 41% of revenue; 68% → 92%; migration +€310K/yr |

### Projects 5–12 — extended portfolio

| # | Project | Key result |
|---|---------|------------|
| 5 | **Churn** | RF +0.03 ROC-AUC over LR; driver #1 is device-error rate (23.7%) |
| 6 | **RFM** | 6 lifecycle segments (Champions→Lost) with a mean R/F/M heatmap |
| 7 | **CLV** | 3 methods; robustly Power > Growth > Casual > Dormant (Gamma-Gamma €5,166 vs €27.7) |
| 8 | **Attribution** | First/last/linear/Shapley; Shapley reallocates budget and leads with referral (€264K) |
| 9 | **Anomalies** | Z-score/IQR/Isolation Forest; IF has the best F1 (50.4%) |
| 10 | **Spend** | Bills 25.8% and travel 20.2% — nearly half the turnover; groceries is the most frequent |
| 11 | **Support & churn** | Churn 37.1% (0 tickets) → 81.1% (3+); unresolved tickets amplify it |
| 12 | **NPS** | Monthly NPS near zero; app_quality +30.3, fees −59.4 |

### Projects 13–17 — Market & Jobs (JTBD)

- **Project 13 — JTBD × cohorts:** chi-square p<0.001 — job segments ≠ cohorts; Dormant 39.4% among Digital Newcomers 45+ vs 15.1% among Family Budgeters; dormancy is driven by UX friction.
- **Project 14 — Unit economics:** travelers lose €0.45 per €100 FX; break-even needs FX cost 1.00%→0.55%; the loss grows with volume.
- **Project 15 — Premium upsell:** conversion concentrates in the anchor (17.3%) and status-seekers (41.2%); 45+ 1.8% (z=34, p<0.001) — the upsell doesn't transfer.
- **Project 16 — 45+ KYC deep-dive:** 35–44 +11.0 pp (p<0.001) and 18–24 +5.3 pp vs 45+ +1.4 pp (ns); referral (trust) converts 45+ best (64.1%) — friction is trust, not UX.
- **Project 17 — Referral segments:** anchor 29.6% vs 45+ 4.8% and families 8.6% (chi² p<0.001); the gap opens at accept (78% vs 26% vs 40%).

### Projects 18–22 — the RAT v2 validation layer

- **Project 18 — Assisted CAC vs LTV:** 45+ LTV/CAC = 0.66 (gate ≥3), assisted CAC €120 doesn't pay off (50-month payback); the anchor clears 3.62 only via referral.
- **Project 19 — FX sourcing:** the 0.55% gate is reachable only at SOM scale (~€332M/mo, 122× today) — a cold-start; best quote is Interbank Prime at 0.745%.
- **Project 20 — Segment premium offers:** +3.33 pp 45+, +4.16 pp families, +3.79 pp travelers (Holm-significant); the anchor +0.86 pp — narrows but doesn't close the gap.
- **Project 21 — Anchor launch CAC:** LTV/CAC ≥3 holds only to ~70K; at SOM 1.76× and 17.0-month payback; the constraint is cheap-channel capacity.
- **Project 22 — Dormant 45+ win-back:** human +5.34 pp, light-touch +2.77 pp; light-touch pays off at 30–90d (ROI 2.54 / 1.26), human ROI 0.40 — kill as a mass channel.

## Visualizations

Charts for every project are rendered in the **Charts** section below. Special charts that don't reduce to bar/line/funnel/cohort are shown here.

![Segment PCA projection](/images/volta/segmentation_pca_scatter.png)

*K=4 segments in PCA projection; K chosen by elbow + silhouette.*

![K selection](/images/volta/segmentation_k_selection.png)

*Data-driven K selection: marginal-gain elbow and silhouette (plateau K=2–4, collapse at K=5).*

![Churn ROC curves](/images/volta/churn_roc_curve.png)

*ROC curves for logistic regression and Random Forest; RF +0.03 AUC.*

![Churn SHAP summary](/images/volta/churn_shap_summary.png)

*SHAP summary: feature contributions to the churn prediction.*

![Churn SHAP local](/images/volta/churn_shap_local.png)

*SHAP breakdown of a single prediction.*

![Anomaly detection](/images/volta/anomaly_detections.png)

*Anomalies: amount × night hours; Isolation Forest catches hidden clusters.*

![Unit-economics sensitivity](/images/volta/traveler_unit_economics_sensitivity.png)

*Sensitivity of the traveler's blended margin to FX cost.*

## Business recommendations

A summary of decisions across all 22 projects: what to do, on what evidence, under which gate, with what caveat.

**1. Onboarding & KYC — remove the main bottleneck**

- Roll out the KYC progress bar to 100% (Project 2: +5.72 pp, p<0.0001, +€656K/yr at 44× ROI).
- Simplify registration (Project 1: −2,682 users) — A/B on removing the phone field.
- A separate trust track for 45+, but not UX-only (Project 16: 45+ +1.4 pp ns vs +11.0 pp for 35–44).

**2. Unit economics & scaling — don't scale what loses money**

- Don't scale travel until FX cost ≤0.55% (Project 14/19: margin −€0.45; the gate needs ~€332M/mo — a cold-start).
- The anchor 25–34 is the growth point, but plan only to ~70K (Project 21: LTV/CAC ≥3 only to 70K; 1.76 at SOM).
- Grow cheap-channel capacity (referral, in-app) instead of increasing paid budget.

**3. Monetization & segments — defend the core, fix the gap**

- Defend Power (12% → 41% of revenue) and upgrade Growth/Casual; Dormant (8%) is the win-back target.
- Launch segment premium offers (+3.3…+4.2 pp, Project 20), planning for the residual gap.
- Premium status is margin to defend (41% conversion, 12% → 41% of revenue), not a growth channel.

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

## Data & Method

**Data:** synthetic, seeded generators (`generate_*.py`) → reproducible CSVs. The funnel dataset is committed; the rest are generated on demand.

**Per-project methodology:**

1. **Funnel** — step conversion, absolute/relative drop-off, Chi-square test across channels. Registration loses the most users in absolute terms (2,682, 73.2% step conv); KYC Complete has the largest relative drop-off (56.6% step conv). Referral converts 11.7pp better than paid social; iOS beats Android at every step (13.6% vs 11.7% end-to-end).

2. **A/B (KYC progress bar)** — sample size calculation, SRM check (p=1.00), bootstrap CI, multiple-comparison correction (Bonferroni/Holm/BH), AA-test under H₀ (type-I = 0.050), CUPED (control-only θ), sensitivity at MDE. Control 55.8% → treatment 61.5%, **+5.72pp**, 95% CI [+3.78%, +7.66%], exceeds the +5pp MDE. Ship-gate: p<0.05 ∧ lift≥MDE ∧ no SRM → ship. 6/11 naively-significant segments, 4/11 after Bonferroni.

3. **Retention** — cohort curves, pre/post Welch t-test + Cohen's d, plan-specific LTV (ARPU × retention decomposition). M1 retention +11.8pp step-change, M3 +9.2pp.

4. **Segmentation** — StandardScaler + KMeans, data-driven K (marginal-gain elbow, silhouette plateau K=2–4, collapse at K=5). Segments: Power 12% / Growth 24% / Casual 32% / Dormant 32%. Lorenz: 12% of users → 41% of revenue; 68% → 92%. Migration scenarios: +€26K/mo (€310K/yr).

**RAT v2 methods (projects 18–22):** LTV per user (ARPU × contribution margin × retention months) and blended CAC with bootstrap CIs, Welch t-test anchor vs 45+; liquidity-provider quotes and log-interpolation of the required volume; a randomized A/B of segment offers with Holm correction and a segment × arm (DiD) interaction; marginal-CAC curves by channel, cheap-first greedy allocation and the break-even scale; a three-arm win-back (auto / light-touch / human) with z-tests and ROI per 10K treated.

**Code structure:** shared `utils/common.py` (`setup()`, `print_section()`, `CONSTANTS`, `data_path()`), `functions + main()` — importing a module does not run the analysis. Excel reports via `openpyxl`.

## Impact

- **KYC conversion +5.72pp** (p<0.0001, exceeds MDE) → business impact **€656K/yr** (44× ROI on €15K dev cost).
- **M3 retention +9.2pp** → **+€227K/yr** incremental LTV from the KYC fix.
- **4 segments** with per-segment strategy and up to **+€310K/yr** monetization via migration.
- **Reproducible methodology** — CUPED, AA-test, Bonferroni, sensitivity at MDE; 4 recommended A/B tests to validate the strategy.
- **22 projects** — 12 analytical domains + Market & Jobs (JTBD) + the RAT v2 validation layer: from funnel to dormant win-back.
- **The portfolio's own recommendations, priced** — the RAT v2 layer assessed 5 audit risks: 3 confirmed, 1 refuted, 1 refined; every decision got a ship / pilot / hold / kill gate.

## Documentation

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
