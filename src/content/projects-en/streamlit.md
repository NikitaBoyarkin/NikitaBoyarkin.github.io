---
title: Product Analytics Dashboard (Streamlit)
description: "A product analytics dashboard on a synthetic SaaS dataset (8,000 users): AARRR funnel, cohort retention, revenue (MRR, ARPU, churn) and segmentation — 5 Streamlit pages."
track: product
hero: images/streamlit.svg
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
updated: 2026-08-14
private: true
related:
  - /projects/supabase/
---

# Product Analytics Dashboard (Streamlit)

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

## Limitations

The data is synthetic and generated in-memory: the numbers reproduce, but they do not describe a real product. The value of the dashboard is the completeness of the cycle and the consistency of metrics across pages, not the specific values.

## Documentation

- [GitHub → streamlit-app](https://github.com/NikitaBoyarkin/streamlit-app)
