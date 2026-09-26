---
title: TaskFlow — PostHog Product Analytics Pipeline
description: "A SaaS product instrumented with PostHog end-to-end: a typed event catalog, generated traffic, and 7 analyses — funnel, retention, A/B, revenue/LTV and time-to-convert."
track: product
hero: images/posthog.svg
impact:
  - Typed event catalog (single source of truth) + PostHog capture/identify/group with PII scrubbing
  - Feature flag → onboarding A/B variant; A/B analysis with chi-square, uplift, Wilson CI + SRM check
  - Day-N cohort retention, time-to-convert, revenue/LTV, first-feature → upgrade conversion
  - The same metrics as SQL (BI / interview reference) + interactive Streamlit dashboard
  - CI (pytest + ruff) + Docker + render.yaml for one-click deploy
tools:
  - Python
  - PostHog
  - FastAPI
  - Streamlit
  - pandas / matplotlib
  - pytest / ruff
  - Docker
github: https://github.com/NikitaBoyarkin/posthog-saas-analytics
updated: 2026-09-15
private: true
related:
  - /projects/supabase/
---

# TaskFlow — PostHog Product Analytics Pipeline

## Situation

Most analytics portfolios start with a ready-made CSV. This project starts earlier — with instrumenting an application: define events without PII leaks, get them into the analytics tool, and turn raw events into decisions. The pipeline runs the whole cycle — generate traffic, capture events, analyze, dashboard, and deploy.

## Task

I needed to work from instrumentation rather than a handed-over export, so I owned the event plan, the capture path, and the analysis and dashboard that turn raw events into decisions.

## Actions

### Pipeline

```
app/                Demo SaaS (FastAPI + Jinja2): routes + server-side capture
  analytics/        typed event catalog · PostHog wrapper (PII scrub) · feature flag
scripts/            simulate_events.py — 30 days of realistic funnel traffic
analysis/           funnel · cohort · A/B · revenue/LTV · time-to-convert · feature-usage · SQL
dashboard/          interactive Streamlit dashboard
```

### What it demonstrates

- **Instrumentation:** a typed event catalog as the single source of truth; server-side capture; PII scrubbing.
- **A/B:** feature flag → onboarding variant; chi-square, uplift, Wilson CI, SRM check.
- **Metrics:** funnel, Day-N cohort retention, time-to-convert, revenue/LTV, first-feature → upgrade.
- **SQL mirror:** the same metrics as SQL — a reference for BI and interviews.
- **Engineering:** pytest + ruff in CI, Dockerfile, render.yaml for one-click deploy.

## Result

The value is in the completeness of the cycle. The typed event catalog and PII scrubbing separate production instrumentation from a demo: events are defined in one place, PII does not leak, and the metrics reproduce in both Python and SQL. One repo covers the full analytics lifecycle — instrument → generate → analyze → dashboard → deploy.

## Limitations

Traffic comes from a simulator, not real users, so the analysis numbers illustrate the correctness of the pipeline rather than product insights. The value is the instrumentation discipline and the complete cycle, where every step reproduces.

## Documentation

- [GitHub → posthog-saas-analytics](https://github.com/NikitaBoyarkin/posthog-saas-analytics)
