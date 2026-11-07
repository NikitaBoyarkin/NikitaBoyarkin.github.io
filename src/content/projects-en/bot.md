---
title: Data Analyst Telegram Bot
description: "A Telegram bot for the analyst without BI: a raw CSV export becomes p-value, lift and 95% CI in 30 seconds — 12 commands, history and HTML export."
star:
  situation: "PMs and analysts often have no BI access: checking an A/B hypothesis waits for a dashboard, and the exported CSV sits there without statistics"
  task: "Check a hypothesis right in Telegram — get a correct result with guardrails from a CSV, without BI and without a notebook"
  action: "Bot on aiogram, pandas, scipy and statsmodels: 12 commands, Welch t-test or chi-square, SRM and power guardrails, analytics as pure modules, pytest + ruff + mypy in CI"
  result: "From a CSV — p-value, lift and 95% CI in under 30 seconds, plus a power note and a chart; /export returns a standalone HTML report"
track: experiments
hero: images/bot.svg
ogImage: /images/og/bot.png
impact:
  - "A/B from a CSV in Telegram: Welch t-test or chi-square, p-value, lift, 95% CI, SRM and power guardrails, chart"
  - "12 commands: data description, funnel, A/B, cohorts, RFM, trend, correlations, history, export"
  - "Guardrails warn instead of staying silent: SRM violations and missing power are visible in the reply"
  - "Analytics lives in src/analytics/ as pure modules covered by pytest; CI runs pytest + ruff + mypy"
  - "Uploads are capped before parsing: 10 MB / 100k rows, free tier 5 MB and 10 analyses a day"
tools:
  - Python
  - aiogram
  - pandas
  - SciPy / statsmodels
  - matplotlib
  - SQLite
  - pytest / ruff / mypy
  - Docker / Fly.io
private: true
date: 2025-06-19
updated: 2026-10-25
demo: demos/telegram/index.html
related:
  - /posts/telegram-reporting-bot/
faq:
  - question: "Which commands does the bot have?"
    answer: "12 commands: /start, /help, /describe, /funnel, /abtest, /cohort, /rfm, /trend, /correlate, /history, /export, /cancel."
  - question: "What do I send for /abtest?"
    answer: "A CSV with group and metric columns; metric is numeric or binary 0/1."
  - question: "What does the bot compute besides p-value?"
    answer: "Welch t-test for a numeric metric or chi-square for a binary one, then lift, 95% CI, SRM and power guardrails, and a chart."
  - question: "Where is the data stored?"
    answer: "Locally only: the last 10 analyses in SQLite. The token is read from the BOT_TOKEN environment variable, .env is gitignored."
  - question: "How is it deployed?"
    answer: "Long polling needs an always-on process: a Fly.io worker built from the Dockerfile or a local docker run. CI runs pytest + ruff + mypy."
---

# Data Analyst Telegram Bot

**▶ [Diagram: A/B test from a CSV](/diagrams/telegram-bot.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

PMs and analysts often have no BI access: checking an A/B hypothesis waits for a dashboard, and the exported CSV sits there without statistics. The hypothesis is written and the data is exported — yet p-value, lift and an SRM check still demand a notebook, an environment and someone who remembers the formula.

## Task

I needed to bring hypothesis checking into Telegram: get a correct result with guardrails from a CSV — no BI, no notebook, no manual statistics.

## Actions

### Stack

aiogram 3 + pandas, scipy, statsmodels. The UI follows the Telegram locale (EN/RU); analytics output stays English.

### Commands

| Command | What it does |
|---|---|
| `/start`, `/help` | Show commands |
| `/describe` | Shape, dtypes, missing %, numeric describe, top categoricals, datetime range |
| `/funnel` | Step-to-step and overall conversion (warns on non-monotonic steps) + chart |
| `/abtest` | Welch t-test (numeric) or chi-square (binary), p-value, lift, 95% CI, SRM and power guardrails + chart |
| `/cohort` | Weekly cohort retention per first-activity week + heatmap |
| `/rfm` | RFM segmentation (recency/frequency/monetary) per user + chart |
| `/trend` | Time-series trend (daily/weekly/monthly) + chart |
| `/correlate` | Top pairwise Pearson correlations + heatmap |
| `/history` | Your last 10 analyses |
| `/export` | Last analysis as a standalone HTML report with a chart |
| `/cancel` | Reset waiting state |

### Input data

| Command | Columns |
|---|---|
| `/funnel` | `step,users` — rows ordered top to bottom of the funnel |
| `/abtest` | `group,metric` — metric numeric or binary `0/1` |
| `/cohort` | `user_id,date` — one row per activity; `date` is also accepted as `dt`, `day`, `ts`, `timestamp`, `created`, `updated`, `дата` |
| `/trend` | `date,metric` — one row per observation |
| `/rfm` | `user_id,date,amount` — one row per transaction |
| `/correlate` | any CSV with two or more numeric columns |
| `/describe` | any CSV |

Sample datasets live in `data/samples/`.

### Engineering

Analytics lives in `src/analytics/` as pure, tested modules; CI runs pytest, ruff and mypy. Uploads are capped before parsing — 10 MB / 100k rows (free tier: 5 MB, 10 analyses a day). History is SQLite, the last 10 analyses.

## Result

From a CSV — p-value, lift and 95% CI in under 30 seconds, plus a power note and a chart. `/export` returns the last analysis as a standalone HTML report you can attach to a hypothesis discussion.

## What I learned

The value of an analysis is lost not in the statistics but in the distance between the export and the answer. A hypothesis dies not because the formula is hard but because reaching it takes a notebook, an environment and someone who remembers the details — and by the time that path is walked the question is stale. So the tool shortens the path instead of reinventing the method: the test, the lift and the interval stay standard, only the distance to them changes.

The second point is that a guardrail belongs inside the answer, not beside it. A number without an SRM and power check reads as a result, even when a broken assignment or a short sample sits behind it; a warning you have to request separately is never requested. That is also the boundary: the bot guarantees the computation, not the experiment — observation independence, novelty and multiple comparisons stay with the analyst.

## Discussion points

- **Why a bot rather than a dashboard.** A dashboard answers questions set in advance, while a hypothesis is born in a thread and lives for minutes.
- **Why guardrails in the same message as the number.** A check that needs a separate step does not get run in time.
- **Why two tests rather than one universal one.** A numeric and a binary metric need different error models, and a compromise would cost accuracy on both.
- **What the bot forbids claiming.** It does not design the experiment: a correct computation on wrongly designed data is still a wrong conclusion.

## Limitations

The bot computes but does not design an experiment: observation independence, novelty and multiple comparisons stay with the analyst. Data arrives only as a CSV — there is no warehouse connection. The free tier is capped at 5 MB and 10 analyses a day. The repository is private — there is no public code, and the card does not link an empty repository.

## Documentation

- The repository is private — available on request. No public code; the card does not link an empty/stub repository.
