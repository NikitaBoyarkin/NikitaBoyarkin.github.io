---
title: Reporting Automation Telegram Bot
description: "A Telegram bot replaced manual weekly reporting with a cron job: 1–2 hours of prep became a scheduled report with a KPI table and sparklines."
star:
  situation: "Every week an analyst hand-assembled metrics from several sources, refreshed a dashboard and posted screenshots to the chat"
  task: "Take the weekly report off one person so it arrives on time with no manual steps"
  action: "SQL against the data mart, KPI aggregation, a report template with a table and sparklines, Telegram Bot API delivery, fallbacks"
  result: "Manual 1–2h of prep became a cron job; the report arrives on schedule and the analyst interprets instead of copying numbers"
track: engineering
hero: images/bot.svg
ogImage: /images/og/bot.png
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
---

# Reporting Automation Telegram Bot

## Situation

Every week an analyst manually gathered metrics from several sources, refreshed a dashboard, exported screenshots, and posted them to the team chat. The process took 1–2 hours, was often delayed, and depended on a single person. The task is to move report assembly into a bot that fetches data and sends it on a schedule, so the team gets metrics regularly and in one format.

## Task

I needed to take the weekly report off a single person's hands, so I owned the bot that fetches the numbers on a schedule and posts them to the team in one consistent format.

## Actions

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
