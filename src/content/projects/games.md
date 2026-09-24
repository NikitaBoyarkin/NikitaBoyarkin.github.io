---
title: Browser Mini-Games — Analytics Arcade
description: "10 играбельных мини-игр в self-contained SVG: 7 аналитических (A/B до p<0.05, funnel drop, cohort catch, retention day) и 3 аркадных. Один файл — вся игра, без сборки."
track: experiments
hero: images/games.svg
impact:
  - "10 игр: 7 аналитических + 3 аркадных, каждая — self-contained SVG"
  - "Аналитические концепции → игровая механика: p<0.05, retention day, funnel bottleneck"
  - "Zero-dependency: HTML+CSS+JS в одном файле, без сборки и сервера"
  - "Phone (swipe/tap) + desktop (keyboard/mouse), 3 темы"
  - "PostHog-трекинг (game_selected) + CTA → контакт"
tools:
  - SVG
  - JavaScript
  - Astro
  - Playwright
github: https://github.com/NikitaBoyarkin/browser-mini-games
updated: 2026-09-04
demo: games/
related:
  - /projects/ab/
  - /projects/cohort/
  - /projects/sql/
  - /posts/cohort-retention-guide/
---

# Browser Mini-Games — Analytics Arcade

## Задача

Аналитические концепции — p-value, retention, воронки — абстрактны: рекрутер или студент не «прочувствует» их из текста, а пассивные дашборды не дают интерактивного опыта. Мини-игры превращают концепции в механику: играешь — и понимаешь, почему p < 0.05, что такое retention day и где бутылочное горлышко воронки.

## Данные и метод

### Игры

| Игра | Тип | Механика |
|------|-----|----------|
| 🐍 Snake | аркада | ешь, расти, не врежься |
| 🏓 Pong | аркада | обыграй CPU — первый до 11 |
| 🔢 2048 | аркада | сливай плитки до 2048 |
| 🧪 A/B Test | аналитика | собирай данные, пока p < 0.05 |
| 🔻 Funnel Drop | аналитика | лови падающих юзеров, конвертируй |
| 📊 Cohort Catch | аналитика | лови Returning, избегай Churned |
| 🧩 SQL Query | аналитика | выбери токен, завершающий SQL |
| 🃏 Metric Match | аналитика | сопоставь пары метрик за минимум ходов |
| 📅 Retention Day | аналитика | выбери правильный день удержания |
| 🔍 Funnel Bottleneck | аналитика | найди самый большой провал воронки |

### Архитектура

Каждая игра — **self-contained SVG**: HTML, CSS и JS в одном файле. Один файл = вся игра, zero-dependency, без сборки. Хаб — Astro (static), деплой на GitHub Pages. Темы dark/light/cyberpunk через `data-theme` + `localStorage`.

### Аналитика и конверсия

- `game_selected` — PostHog-событие при выборе игры.
- CTA в играх → контакт (Telegram deep-link), событие `contact_click`.
- Синк в портфолио: `sync_games.py` копирует `dist/` → `public/games/` (drift-check через `--check`).

### Тестирование

Smoke-тесты на Playwright (pytest): каждая игра загружается из `public/` и проверяется на работоспособность.

### Запуск

```bash
npm install
npm run dev          # dev server
npm run build        # production build → dist/
python3 sync_games.py --dry-run   # preview sync to portfolio
```

## Результат

10 игр работают на телефоне (swipe/tap) и десктопе (keyboard/mouse), открываются из одного файла без сервера. Аналитические игры — обучающий инструмент: концепция → механика → интуиция. Синк в портфолио автоматический, smoke-тесты на Playwright ловят поломки загрузки.

## Ограничения

Игры упрощают статистику до интуиции и не заменяют реальный анализ: механика показывает идею p-value или retention, а не корректный расчёт. Zero-dependency означает один файл на игру — код между играми не переиспользуется, и любое изменение приходится вносить в каждый файл руками.

## Документация

- [GitHub → browser-mini-games](https://github.com/NikitaBoyarkin/browser-mini-games)
- [Live demo → /games/](https://nikitaboyarkin.github.io/games/)
