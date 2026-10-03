---
title: "DAU / MAU and stickiness"
description: "DAU and MAU are the unique active users per day and per month; their ratio, stickiness, shows how far the product became a habit."
aka: ["DAU", "MAU", "stickiness", "DAU/MAU"]
category: product
tags: []
related: ["/glossary/retention/", "/glossary/arpu/", "/glossary/north-star-metric/", "/glossary/retention-curve/", "/projects/posthog/"]
keywords: ["DAU", "MAU", "stickiness"]
updated: 2026-10-01
---

## Definition

DAU and MAU are the number of unique users active in a day and in a month. Their ratio $\text{DAU}/\text{MAU}$ is called stickiness: it roughly estimates the share of the monthly audience that shows up daily. High stickiness separates a habit product from one used in bursts.

## How to compute

Define activity by a concrete event and keep that definition fixed. Count DAU and MAU over unique users, not sessions. Take stickiness over a calendar month: $\text{DAU}/\text{MAU}$, usually with average daily DAU. For seasonal products also watch the month-over-month ratio.

## Pitfalls

DAU depends on the activity definition and shifts when it changes. Stickiness is seasonal: weekends and holidays distort week-to-week comparison. Never compare DAU/MAU computed on different windows. Stickiness has a ceiling and does not grow forever; low stickiness is a reason to look at retention, not at the metric itself.
