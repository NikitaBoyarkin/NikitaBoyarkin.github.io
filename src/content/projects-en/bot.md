---
title: Reporting Automation Telegram Bot
description: "A Telegram bot replaced manual weekly reporting with a cron job: 1–2 hours of prep became a scheduled report with a KPI table and sparklines."
track: engineering
hero: images/bot.svg
impact:
  - Cut weekly report prep from 1–2h to automated cron
  - KPI table + sparklines delivered on schedule
  - Fallback notifications on source failures
  - Single consolidated pipeline replacing fragmented sources
tools:
  - Python
  - aiogram / telegram-bot
  - SQL
  - cron scheduler
  - Tableau
private: true
updated: 2025-06-19
demo: demos/telegram/index.html
related:
  - /posts/telegram-reporting-bot/
caseStudy:
  problem: "The weekly report was assembled by hand: the analyst pulled metrics from several sources, refreshed a dashboard, exported screenshots and posted them to the team chat. It took 1–2 hours, often slipped, and depended on one person."
  approach: "Moved report assembly into a Telegram bot: a cron scheduler, SQL queries against the mart, a template with a KPI table and sparklines, and a delta to the previous week. Reliability is built into the architecture — error handling, logging and fallback notifications when a source fails, because silent bot failures destroy trust in metrics faster than the time savings grow."
  result: "Manual assembly of 1–2h is replaced by an automatic cron: metrics arrive on schedule in one format, the team sees the same numbers, and the analyst owns interpretation instead of copying. Fallback notifications keep trust in the metrics when sources fail."
  metrics:
    - label: "Report time"
      value: "1–2h → 0"
    - label: "Delivery"
      value: "on schedule"
    - label: "Format"
      value: "KPI + sparklines"
    - label: "Silent-fail guard"
      value: "fallback"
---

# Reporting Automation Telegram Bot

## Goal

Every week an analyst manually gathered metrics from several sources, refreshed a dashboard, exported screenshots, and posted them to the team chat. The process took 1–2 hours, was often delayed, and depended on a single person. The task is to move report assembly into a bot that fetches data and sends it on a schedule, so the team gets metrics regularly and in one format.

## Data & Method

**Data:** product metrics from a database (SQL), external APIs, and ready-made Tableau dashboards.

**Bot architecture:**

1. **Scheduler** — cron-triggered at a set time.
2. **Data collection** — SQL queries to the data mart, aggregation of key KPIs (DAU, ARPU, conversion, retention).
3. **Report assembly** — a template with a KPI table, sparklines, and week-over-week comparison (delta in % and pp).
4. **Delivery** — Telegram Bot API to a chat or via the `/report` command.
5. **Reliability** — error handling, logging, fallback notifications on source failures.

**Tools:** Python (aiogram/telegram-bot), SQL, cron, Tableau for visualization.

## Result

Manual report assembly turned out to be less complex than fragmented: metrics had to be pulled from different places. After consolidation into one pipeline, most of the work moved to the machine — manual 1–2h became a cron job, and the analyst became responsible for interpretation rather than copying numbers.

## Limitations

Delivery stability matters more than report polish here: if the bot fails silently, trust in metrics drops faster than the time savings grow. Fallback notifications on source failure are therefore built into the architecture rather than added "later." The repository is private — there is no public code, and the card does not link an empty repository.

## Documentation

- The repository is private — available on request. No public code; the card does not link an empty/stub repository.
