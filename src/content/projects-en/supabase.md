---
title: Product Analytics + A/B on Supabase
description: "Full-stack analytics on Supabase: an A/B on a seeded event stream lifted conversion +11.1pp (p ≈ 1.7e-10, chi-square), with a Streamlit dashboard reading live data through RLS."
star:
  situation: "Analytics portfolios show metrics on a clean CSV; the hard part is analytics embedded in a real multi-tenant product"
  task: "Own the multi-tenant setup end to end: auth, per-org isolation, event ingest, and the experiment result computed in the database"
  action: "SQL views compute funnel, cohort, MRR, and DAU; v_results computes A/B in the DB; RLS isolates rows per organization"
  result: "A/B concluded on a seeded stream: control 29.6% vs treatment 40.7%, +11.1pp at p ≈ 1.7e-10 (chi-square); metrics computed in the live DB for any client"
track: product
hero: images/supabase.svg
ogImage: /images/og/supabase.png
impact:
  - "Full-stack: Streamlit UI + Supabase Postgres + Edge Function ingest (API-key auth)"
  - Row Level Security on every table — a user sees only their org's rows
  - SQL views compute funnel, cohort, MRR, DAU, channel conversion — the dashboard reshapes, it does not aggregate
  - "A/B result in the DB: control 29.6% vs treatment 40.7%, p ≈ 1.7e-10 (chi-square)"
tools:
  - Python
  - Streamlit
  - Supabase (Postgres + RLS + Edge Functions)
  - SQL
  - supabase-py
github: https://github.com/NikitaBoyarkin/supabase-product-analytics
date: 2026-08-14
updated: 2026-11-01
demo: demos/supabase/index.html
related:
  - /projects/streamlit/
---

# Product Analytics + A/B on Supabase

**▶ [Architecture diagram](/diagrams/supabase-product-analytics.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

Most analytics portfolios show metrics on a clean CSV. The hard part stays invisible: how analytics embeds into a real multi-tenant product — auth, per-org data isolation, an event ingest path, and an experiment whose result is computed in the database, not in a notebook.

## Task

I needed to show analytics living inside a real product rather than beside one, so I owned the multi-tenant setup: auth, per-organization isolation, the event ingest path, and the experiment result computed in the database.

## Actions

### Architecture

```
Client/seed  ── POST /functions/v1/ingest (x-api-key) ──►  Edge Function (Deno)
                                                              │
Streamlit    ◄── email/password auth + SQL (RLS-scoped) ──►  Supabase Postgres
dashboard        (supabase-py, anon key)                      analytics + experiments
```

- **Schemas:** `analytics` (organizations, api_keys, users, events, subscriptions, org_members) and `experiments` (experiments, variants, assignments, metrics).
- **Analytics in the DB:** SQL views compute funnel, cohort retention, MRR, DAU, and channel conversion (`sql/002_views.sql`) — the dashboard reshapes, it does not aggregate.
- **A/B in the DB:** `experiments.v_results` computes per-variant assigned/converted/conversion; the chi-square test runs on top in the dashboard.
- **Ingest:** the Edge Function validates an API key (SHA-256 hash, never plaintext) and inserts the event via a `security definer` function.

### Security model (RLS)

Every table has Row Level Security enabled. A user only ever sees rows of their organization — the dashboard is safe to expose to real users, not just to run locally.

## Result

Analytics is computed where the data lives: SQL views and `v_results` mean metrics and experiment results are consistent across any client that connects to the database — dashboard, BI tool, or ad-hoc SQL all see the same numbers. The concluded A/B shows control 29.6% vs treatment 40.7%, **+11.1pp** at p ≈ 1.7e-10 (χ²).

## What I learned

When the calculation lives in the database, a metric's definition stops being the property of one client. The dashboard, a BI tool and an ad-hoc query all read the same views, so a disagreement between them is a signal of a bug rather than a debate about whose report is right. Trust in the number is guaranteed by the fact that it cannot be computed differently.

The second lesson is about isolation as part of analytics rather than a layer on top of it. When the rule for row access is set on the table rather than in report code, "the metric for one organization" and "the metric for everyone" are the same query under a different context — and a data leak becomes a configuration error you can see immediately.

## Discussion points

- **Why compute in the database rather than in the application.** A view is the one place where a metric's definition is written once; the app and the BI tool read the result instead of each reproducing the logic their own way.
- **Why RLS rather than a filter in the code.** A rule set on the table applies to any client, including the one someone wires up tomorrow, whereas a dashboard filter only protects the dashboard.
- **Where applicability ends.** A seeded stream tests the architecture and the reproducibility of the calculation, not behaviour at real volume, on late-arriving events or under concurrent writes.
- **What I would do under real traffic.** Add time-based partitioning for events, indexes behind the views and a key-rotation policy for ingest — otherwise the calculation stays correct while becoming too expensive to run.

## Limitations

The A/B events are seeded, so the value is not the effect size itself but the fact that the experiment is computed in the database, isolated per tenant, and reproducible by any client. There is no product story behind the numbers — this demonstrates architecture, not a real launch result.

## Documentation

- [GitHub → supabase-product-analytics](https://github.com/NikitaBoyarkin/supabase-product-analytics)
