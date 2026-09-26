---
title: This Portfolio Site
description: "Сайт, который вы читаете: Astro 7, TypeScript и Markdown-коллекции, статическая сборка, тёмная/светлая тема, RSS, sitemap, JSON-LD и деплой на GitHub Pages."
track: engineering
hero: images/site.svg
impact:
  - Astro 7 + TypeScript + Markdown content collections
  - Тёмная/светлая тема без flash
  - RSS, sitemap, robots, JSON-LD, OG/Twitter meta
  - Base-path-aware URL для хостинга на GitHub Pages
tools:
  - Astro
  - TypeScript
  - Markdown
  - CSS custom properties
github: https://github.com/NikitaBoyarkin/NikitaBoyarkin.github.io
updated: 2026-09-20
related:
  - /projects/garden/
  - /projects/scrolly/
  - /posts/data-analyst-portfolio-checklist/
---

# This Portfolio Site

## Ситуация

Нужно статическое портфолио, где контент (проекты, посты) редактируется в Markdown, а не в разметке компонентов. Хостинг — GitHub Pages как user site (репозиторий `NikitaBoyarkin.github.io`, отдаётся из корня домена), деплой — по push, без ручной сборки. Контент и представление должны разделиться: новый проект — это новый `.md` файл, без правки компонентов.

## Задача


От меня требовалось получить сайт, в котором публикация проекта сводится к добавлению файла: без правки компонентов и без ручных шагов между коммитом и продакшеном.

## Действия

**Стек:** Astro 7, TypeScript, Markdown content collections (`src/content/{projects,posts}/`), Zod-схемы в `src/content.config.ts`.

**Архитектура:**

- **Content collections** — каждый проект/пост = Markdown + frontmatter; Zod валидирует поля на сборке.
- **Базовый путь** — `withBase()` из `src/lib/path.ts` применяет `base` ко всем внутренним ссылкам и картинкам (сейчас сайт отдаётся из корня, `base: '/'`).
- **Тема** — inline-скрипт в `<head>` читает `localStorage`/`prefers-color-scheme` и ставит `data-theme` до первой отрисовки (без flash); CSS custom properties реактивны.
- **SEO** — `sitemap.xml`, `robots.txt`, `rss.xml`, JSON-LD, OG/Twitter meta, canonical.
- **Деплой** — GitHub Actions собирает `dist/` и публикует на Pages по push в `master`.

**Валидация:** `scripts/check_site.py` проверяет обязательные страницы, внутренние ссылки, профиль-картинку и ассеты в `index.html`.

## Результат

Content collections с Zod — это контракт между контентом и представлением: невалидный frontmatter ломает сборку, а не деплой. `withBase()` инкапсулирует базовый путь GitHub Pages — ни одна ссылка не хардкодит базу. Разделение «контент = `.md`, представление = `.astro`» означает, что добавление проекта не требует правки кода.

## Ограничения

Это витрина под конкретный хостинг: GitHub Pages как user site и `base: '/'`. Переезд на project-страницу или другой хостинг потребует правок `withBase()` и деплой-воркфлоу. Валидация покрывает структуру и ссылки, но не контент.

## Документация

- [GitHub → NikitaBoyarkin.github.io](https://github.com/NikitaBoyarkin/NikitaBoyarkin.github.io)
