---
title: "Uplift modelling"
description: "Uplift modelling predicts the causal effect of a treatment on an individual user rather than their outcome — which is what separates it from a plain forecast."
aka: ["uplift", "uplift modelling"]
category: experiment
tags: ["ab-testing", "statistics"]
related: ["/glossary/cuped/", "/glossary/mde/", "/glossary/churn/", "/projects/causal/"]
keywords: ["uplift", "causal effect", "QINI"]
updated: 2026-10-01
---

## Definition

Uplift modelling estimates the causal effect of a treatment at the level of an individual user: how much their metric changes because of a campaign. A regular model predicts an outcome; an uplift model predicts the difference between the outcome with and without treatment. This lets you target those who respond, not those who would convert anyway.

## How to compute

Models are trained on experimental data where treatment is known: T-learner, S-learner, X-learner, causal forest. Ranking quality is measured with QINI and AUUC — the area under the cumulative-uplift curve over sorted scores. A good model lifts the metric at the same reach.

## Pitfalls

Without a control arm the causal effect cannot be separated from correlation. Segmenting on the predicted outcome is not the same as segmenting on the effect: "likely to convert" is not "persuadable". On small samples QINI and AUUC cannot tell even an oracle from noise, so trust the metric only with enough observations per arm.

## Related

- CUPED
- MDE
- Churn
