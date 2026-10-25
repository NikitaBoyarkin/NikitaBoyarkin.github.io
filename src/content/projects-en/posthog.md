---
title: TaskFlow — PostHog Product Analytics Pipeline
description: "7 analyses from a typed event catalog: PostHog end-to-end — funnel, retention, A/B, revenue/LTV, time-to-convert. The stream is seeded; the value is the method: catalog, PII scrubbing, SQL, CI."
star:
  situation: "An analytics portfolio usually starts from a ready-made CSV; this one starts earlier — with instrumenting the app"
  task: "Define events without PII leaks, get them into the analytics tool, and turn raw events into decisions"
  action: "Typed event catalog, PII scrubbing; A/B with chi-square, uplift, Wilson CI, SRM; SQL mirror, Streamlit dashboard, CI, Docker"
  result: "Full analytics lifecycle on a seeded event stream: 7 analyses, a typed event catalog with no PII leaks, metrics that reproduce in both Python and SQL"
track: product
hero: images/posthog.svg
ogImage: /images/og/posthog.png
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
date: 2026-08-14
updated: 2026-10-25
private: true
demo: demos/posthog/index.html
related:
  - /projects/supabase/
---

# TaskFlow — PostHog Product Analytics Pipeline

**▶ [Data-flow diagram](/diagrams/posthog-saas-analytics.html)** — self-contained HTML, opens in a browser — no install, no build

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
