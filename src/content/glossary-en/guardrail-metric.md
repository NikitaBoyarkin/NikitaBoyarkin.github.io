---
title: "Guardrail metric"
description: "A guardrail metric is one an experiment must not worsen: it catches collateral damage while the primary metric moves up."
aka: ["guardrail metric", "guardrail", "counter metric"]
category: experiment
tags: ["ab-testing", "product"]
related: ["/glossary/north-star-metric/", "/glossary/ab-test/", "/glossary/srm/"]
keywords: ["guardrail", "counter metric", "side effect"]
updated: 2026-10-03
---

## Definition

A guardrail metric is a constraint metric that the change must not degrade: load time, error rate, opt-outs, support load. The primary metric answers "is it better", the guardrail answers "did something else get worse".

## How to compute

Pick guardrails before launch and keep them in the same test next to the target metric. Set the threshold as an allowed degradation, in absolute units or in standard deviations, accounting for multiplicity. Decide on the combination: the effect is real and no guardrail crosses its threshold.

## Pitfalls

A guardrail with no pre-set threshold becomes a reason to reject any winning test. Too many guardrail metrics without a multiple-comparison correction produce false alarms. The opposite error is just as real: a rare or noisy guardrail metric will not catch genuine degradation.
