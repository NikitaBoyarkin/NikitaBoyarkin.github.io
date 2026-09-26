---
title: Scrolly English Speaking
description: "Scrollytelling-гайд по spoken English для рабочих разговоров (A2–B1): MDX-нарратив и D3-визуализации, где контент и визуализации разделены. Astro 6, деплой на GitHub Pages."
track: engineering
hero: images/scrolly.svg
impact:
  - Scrollytelling-нарратив на Astro 6 + MDX, D3-визуализации (workflow, bars, calendar, checklist)
  - Контент и визуализации разделены — доверенный data-модуль, frontmatter безопасно мёржится
  - Интерактивные viz-панели через IntersectionObserver + dark/light тема + reduced-motion
  - Деплой на GitHub Pages по subpath, Node 22, `astro check` в CI
tools:
  - Astro
  - TypeScript
  - MDX
  - D3
  - Tailwind v4
github: https://github.com/NikitaBoyarkin/scrolly-english-speaking
updated: 2026-08-25
related:
  - /projects/site/
  - /projects/garden/
---

# Scrolly English Speaking

## Ситуация

Рабочие разговоры на английском (стендапы, синки, интервью) — слабое место у многих русскоязычных специалистов уровня A2–B1: грамматика есть, а связная речь и реакции в реальном времени буксуют. Обычный учебник этому не учит: нет контекста, нет наглядности, нет связи между фразами и ситуацией. Нужен не текст, а интерактивный гайд, где нарратив ведёт читателя по сценам рабочего разговора, а визуализации показывают, как устроены workflow, инструменты и метрики прогресса.

## Задача


От меня требовалось закрыть разрыв между знанием грамматики и живой речью: дать читателю ситуации, в которых фразы нужно применять, а не узнавать.

## Действия

**Стек:** Astro 6 (`output: static`) + MDX + Tailwind v4 (через `@tailwindcss/vite`), D3 v7 для визуализаций, Shiki (тема `nord`) для кода, `@astrojs/sitemap`. Деплой на GitHub Pages по subpath, Node 22.

**Архитектура:**

- `src/layouts/ScrollyLayout.astro` — единый шаблон: hero, 2-колоночный scrolly, viz-панели, head-мета.
- `src/posts/scrolly/*.mdx` — нарратив (текст разделов) с `<ScrollySection>` блоками.
- `src/scrolly/data/*.ts` — `configId` + секции + props визуализаций + тема. Доверенный источник HTML: hero/footer всегда берётся из data-модуля, никогда из frontmatter — защита от инъекций.
- `src/scrolly/scrolly-runtime.ts` — IntersectionObserver, `switchViz`, theme-toggle; viz-рендереры через lazy import.

**Модель контента:** MDX-frontmatter (`configId`, `metadata`, `theme`) безопасно мёржится поверх доверенного data-модуля. HTML hero/footer всегда из `data/*.ts`, никогда из frontmatter.

## Результат

Синхронизация нарратива и визуализации держит внимание лучше статичной статьи с картинками: читатель доходит до абзаца, и в этот момент справа меняется график. Разделение MDX и data-модулей решает главную боль статических сайтов — смешивание текста и логики: нарратив остаётся редактируемым в Markdown, а визуализации — типизированными в TypeScript. Новая сцена = новый data-файл + MDX, без правки рендеринга.

## Ограничения

Гайд рассчитан на уровень A2–B1 и покрывает рабочие сценарии, а не общий английский; материал авторский и не проходил проверку методистом. Разделение контента и data-модулей защищает от инъекций через frontmatter, но не от самого содержания данных.

## Документация

- [Живая страница →](https://nikitaboyarkin.github.io/scrolly-english-speaking/english-speaking)
- [GitHub → scrolly-english-speaking](https://github.com/NikitaBoyarkin/scrolly-english-speaking)
