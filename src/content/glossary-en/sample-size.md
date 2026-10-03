---
title: "Sample size"
description: "Sample size is the number of observations needed to detect an effect of a given size at a chosen power and significance. It is computed before a test starts."
aka: ["sample size", "sample sizing", "required sample"]
category: statistics
tags: ["statistics", "ab-testing"]
related: ["/glossary/statistical-power/", "/glossary/mde/", "/glossary/ab-test/", "/glossary/bootstrap/"]
keywords: ["sample size", "planning", "power"]
updated: 2026-10-03
---

## Definition

Sample size is how many observations you need to detect an effect of a given size at a chosen significance and power. It is a calculation made before the experiment, not a consequence of the data already collected.

## How to compute

To compare two means, observations per arm scale with the square of the summed critical values divided by the squared ratio of the effect to the standard deviation. Halving the effect you want to catch quadruples the sample. Take the variance from history and the effect from the MDE the product deems meaningful.

## Pitfalls

Computing sample size from the observed effect and then quoting power is circular: a weak effect demands a huge sample, so post-hoc power is almost always low. Underestimating the variance understates the required sample. Several metrics in one test need a correction, or none of them keeps its power.
