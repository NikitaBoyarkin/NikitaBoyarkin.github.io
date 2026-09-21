---
title: This Portfolio Site
description: "Сайт, который вы читаете: Astro 7, TypeScript и Markdown-коллекции, статическая сборка, тёмная/светлая тема, RSS, sitemap, JSON-LD и деплой на GitHub Pages."
track: engineering
hero: images/site.svg
impact:
  - Astro 7 + TypeScript + Markdown content collections
  - Dark/light theme with no-flash inline script
  - RSS, sitemap, robots, JSON-LD, OG/Twitter meta
  - Base-path-aware URLs for GitHub Pages hosting
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

## Контекст

Нужно статическое портфолио, где контент (проекты, посты) редактируется в Markdown, а не в разметке компонентов. Хостинг — GitHub Pages как user site (репозиторий `NikitaBoyarkin.github.io`, отдаётся из корня домена). Деплой — по push, без ручной сборки.

## Гипотеза

Если взять Astro с content collections и Zod-схемой frontmatter, контент и представление разделятся: новые проекты/посты — это новый `.md` файл, без правки компонентов. Базовый путь и мета-теги (OG, JSON-LD, sitemap, RSS) настраиваются один раз.

## Данные и метод

**Стек:** Astro 7, TypeScript, Markdown content collections (`src/content/{projects,posts}/`), Zod-схемы в `src/content/config.ts`.

**Архитектура:**

- **Content collections** — каждый проект/пост = Markdown + frontmatter; Zod валидирует поля на сборке.
- **Базовый путь** — `withBase()` из `src/lib/path.ts` применяет `base` ко всем внутренним ссылкам и картинкам (сейчас сайт отдаётся из корня, `base: '/'`).
- **Тема** — inline-скрипт в `<head>` читает `localStorage`/`prefers-color-scheme` и ставит `data-theme` до первой paints (без flash); CSS custom properties реактивны.
- **SEO** — `sitemap.xml`, `robots.txt`, `rss.xml`, JSON-LD, OG/Twitter meta, canonical.
- **Деплой** — GitHub Actions собирает `dist/` и публикует на Pages по push в `master`.

**Валидация:** `scripts/check_site.py` проверяет обязательные страницы, внутренние ссылки, профиль-картинку и ассеты в `index.html`.

## Что нашли

Astro content collections с Zod — это контракт между контентом и представлением: невалидный frontmatter ломает сборку, а не деплой. `withBase()` инкапсулирует базовый путь GitHub Pages — ни одна ссылка не хардкодит базу. Разделение «контент = `.md`, представление = `.astro`» означает, что добавление проекта не требует правки кода.

## Эффект

- **Astro 7 + TypeScript + Markdown content collections** — контент редактируется в `.md`, валидируется Zod.
- **Dark/light тема без flash** — inline-скрипт до первого paints.
- **SEO-полный** — RSS, sitemap, robots, JSON-LD, OG/Twitter meta, canonical.
- **Base-path-aware URLs** — `withBase()` для GitHub Pages, без хардкода.

## Документация

- [GitHub → NikitaBoyarkin.github.io](https://github.com/NikitaBoyarkin/NikitaBoyarkin.github.io)