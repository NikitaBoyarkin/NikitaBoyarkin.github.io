---
title: "A/A test"
description: "An A/A test serves the same experience to both groups and validates the tooling — split, metrics, and standard error — before the main experiment."
aka: ["A/A test", "AA test"]
category: experiment
tags: ["ab-testing", "statistics"]
related: ["/glossary/srm/", "/glossary/p-value/", "/glossary/cuped/", "/projects/ab/"]
keywords: ["A/A test", "validation", "split"]
updated: 2026-10-01
---

## Definition

An A/A test is an experiment where both groups receive the same experience, so the true effect is zero by construction. It does not test the product but the tooling: the correctness of the split, metric computation, standard error estimation, and the pipeline itself.

## How to compute

Run it on real traffic before or alongside the main test. The share of "significant" differences at $\alpha = 0.05$ should be around 5%, and p-values should be uniformly distributed. Also inspect SRM and metric stability day by day. For every new metric type an A/A run is worthwhile, at least on historical data.

## Pitfalls

An A/A test cannot catch an error specific to a particular variant; it validates only the shared infrastructure. A passed A/A does not guarantee correctness under a real effect. Spending all traffic on it steals power from useful tests. A single A/A run without a SRM check proves little.
