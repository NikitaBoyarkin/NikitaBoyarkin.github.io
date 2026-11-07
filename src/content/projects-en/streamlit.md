---
title: Product Analytics Dashboard (Streamlit)
description: "A product analytics dashboard on a synthetic SaaS dataset (8,000 users): AARRR funnel, cohort retention, revenue (MRR, ARPU, churn) and segmentation — 5 Streamlit pages."
star:
  situation: "The portfolio shows the whole AARRR cycle on one dataset of 8,000 synthetic users, not one metric in isolation"
  task: "Build the metrics so they read as one coherent story rather than a set of disconnected charts"
  action: "Deterministic seed and shared cache: one base for Funnel, Retention, Revenue, and Segments; 5 Streamlit pages"
  result: "Funnel, Retention, Revenue, and Segments read from one consistent base; the same UI became the Supabase project's presentation layer"
track: product
hero: images/streamlit.svg
ogImage: /images/og/streamlit.png
impact:
  - 8,000 synthetic users, Jan 2024 – Jun 2025, deterministic seed = 42
  - "AARRR funnel: app_open → signup → activate → start_trial → subscribe with step drop-off"
  - Cohort retention heatmap (signup month × months since signup)
  - "Revenue: MRR growth, MRR by plan, ARPU, logo churn"
  - "Segments: distributions + conversion + ARPU by segment / channel / country / device"
tools:
  - Python
  - Streamlit
  - pandas / NumPy
github: https://github.com/NikitaBoyarkin/streamlit-app
date: 2026-08-14
updated: 2026-10-17
private: true
demo: demos/streamlit/index.html
related:
  - /projects/supabase/
  - /posts/streamlit-dashboard-prototype/
---

# Product Analytics Dashboard (Streamlit)

**▶ [Architecture diagram](/diagrams/streamlit-app.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

An analytics portfolio should show the whole AARRR cycle on one consistent dataset, not one metric in isolation. This dashboard is a self-contained app: data is generated deterministically, the metrics reproduce across runs, and the same UI later became the presentation layer for the Supabase full-stack project.

## Task

I needed the portfolio to show the full acquisition-to-retention cycle on one dataset, so I owned the app, its deterministic data generation, and the reproducible metric layer underneath.

## Actions

**Data:** a synthetic SaaS dataset, 8,000 users, Jan 2024 – Jun 2025. Generated in-memory with a deterministic seed = 42 and cached via `@st.cache_data` — the dataset is identical across runs and shared across pages within a session.

### Pages

| Page | What it shows |
|------|---------------|
| Overview | KPIs (users, paid, MRR, active 30d, stickiness), DAU trend, monthly signups, conversion by channel |
| Funnel | `app_open → signup → activate → start_trial → subscribe` with step drop-off |
| Retention | Cohort retention heatmap (signup month × months since signup) |
| Revenue | MRR growth, MRR by plan, ARPU, logo churn |
| Segments | Distributions + conversion + ARPU by segment / channel / country / device |

### Run

```bash
uv sync
uv run streamlit run app.py
```

## Result

Every AARRR question reads from one consistent base. The deterministic seed means Funnel, Retention, Revenue, and Segments all talk about the same users, and the numbers can be checked. The same UI later became the presentation layer for the Supabase full-stack project — only the data layer changed.

## What I learned

A dashboard is convincing not by the number of charts but by all of them computing from the same base. While the funnel, retention and revenue pages read one dataset under a shared definition of activity, a disagreement between pages means a bug in the code rather than a different view of the product. Determinism here is not a debugging convenience but the condition under which a metric can be discussed at all.

The second lesson is about separating layers, which matters more than the choice of library. When the data layer moves from a generated dataset to a live database and the UI stays the same, it becomes visible that a dashboard is a contract between a metric's definition and its display — and that contract survives the swap of its source.

## Discussion points

- **Why Streamlit rather than a full BI stack.** For a portfolio it matters that the calculation code sits next to the display: you can see where a number came from, not just the finished chart.
- **Why one dataset across every page.** Metric consistency is a property of the shared denominator, not of the charts: a different source on each page yields attractive but incomparable numbers.
- **Where applicability ends.** Synthetic data with a fixed seed tests the consistency of the calculations, not event quality or behaviour on incomplete data — this is a demo of a method, not of a product.
- **What would change under real traffic.** Caching on heavy aggregates, incremental recomputation and data-freshness checks: without them the first ingest delay makes the dashboard confidently wrong.

## Limitations

The data is synthetic and generated in-memory: the numbers reproduce, but they do not describe a real product. The value of the dashboard is the completeness of the cycle and the consistency of metrics across pages, not the specific values.

## Documentation

- [GitHub → streamlit-app](https://github.com/NikitaBoyarkin/streamlit-app)
