---
title: "A/B test"
description: "An A/B test compares two versions of a product across randomly split groups, separating the effect of a change from the natural variance of a metric."
aka: ["A/B test", "AB test", "split test"]
category: experiment
tags: ["ab-testing", "statistics"]
related: ["/glossary/p-value/", "/glossary/statistical-power/", "/glossary/aa-test/", "/glossary/srm/", "/glossary/mde/"]
keywords: ["A/B test", "experiment", "randomisation"]
updated: 2026-10-03
---

## Definition

An A/B test is a controlled experiment: users are randomly split into control and treatment, the control sees the current product and the treatment sees the change. The difference in the metric between arms estimates the effect of that change.

## How to compute

Compare the metric's mean or proportion across arms and test significance: a t-test for means, a z-test for proportions, bootstrap for non-Gaussian distributions. Read the effect together with a confidence interval, not from a p-value alone. Fix the metric, the MDE and the sample size before launch.

## Pitfalls

Peeking at the data and stopping on the first significant result inflates the Type I error rate. Several metrics without a multiple-comparison correction produce false positives. A changed split, events logged differently per arm, or bots break randomisation — that is what the SRM check catches.
