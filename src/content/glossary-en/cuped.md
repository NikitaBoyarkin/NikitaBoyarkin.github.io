---
title: "CUPED"
description: "CUPED cuts metric variance with a pre-experiment covariate, delivering the same effect estimate at a smaller standard error and higher power."
aka: ["CUPED", "variance reduction"]
category: experiment
tags: ["ab-testing", "statistics"]
related: ["/glossary/srm/", "/glossary/p-value/", "/glossary/statistical-power/", "/glossary/mde/", "/projects/causal/"]
keywords: ["CUPED", "variance", "covariate"]
updated: 2026-10-01
---

## Definition

CUPED (Controlled-experiment Using Pre-Experiment Data) reduces the variance of a metric using a covariate measured before the experiment. Part of a metric's spread is explained by a user's pre-experiment behaviour; subtracting the component predicted from it yields the same unbiased effect estimate with a smaller standard error.

## How to compute

The adjusted metric is $\tilde{Y} = Y - \theta (X - \bar X)$, where $X$ is the same metric or a proxy measured before launch and $\theta = \operatorname{Cov}(Y, X)/\operatorname{Var}(X)$. The optimal $\theta$ removes $\rho^2$ of the variance, so the standard error shrinks by roughly $\sqrt{1-\rho^2}$. At $\rho = 0.7$ that is about a 30% saving in sample size.

## Pitfalls

$X$ must be pre-experiment and independent of the treatment, or the estimate is biased. The correlation has to be stable across arms; if the pre-period does not resemble the test window, $\theta$ fits noise. For ratio metrics the covariance must be computed through the delta method, not directly.

## Related

- SRM
- p-value
- Statistical power
- MDE
