# Plan: Phase 6 — Личностный слой (piofant-inspired)

> **Обновление 2026-10-11:** грейд «middle+» ниже устарел — цель **junior** (CV — источник истины). Тело не переписываю: баннер помечает расхождение.

**Решения по PRD v2.0:**
- Q4 (личность): **умеренно** — whois + «как со мной работать» в профессиональном тоне.
- Q5 (офферы): **найм + коллаборация** (CV, кейсы, контакт).
- Q6 (tagline): **«Гипотеза → эксперимент → метрика → рост.»**

---

## 1. Что меняется

### Файлы, которые изменятся (>3 — декларируется):

| # | Файл | Почему |
|---|---|---|
| 1 | `src/pages/index.astro` | Новый tagline RU |
| 2 | `src/pages/en/index.astro` | Новый tagline EN |
| 3 | `src/layouts/Base.astro` | Новые пункты nav: Whois, Value, Work with me |
| 4 | `src/pages/about.astro` | Ссылка на work-with-me |
| 5 | `src/pages/contact.astro` | Ссылка на value |
| 6 | `src/components/Analytics.astro` | События `whois_viewed`, `value_viewed`, `work_with_me_viewed` |
| 7 | `src/lib/llms-txt.ts` | Добавить новые страницы в Core pages |
| 8 | `src/styles/global.css` | Общие стили для секций whois/work-with-me/value (если не хватит существующих `.board-card`/`.reveal`) |

### Новые файлы:

| # | Файл | Содержание |
|---|---|---|
| 9 | `src/pages/whois.astro` | whois-страница RU |
| 10 | `src/pages/en/whois.astro` | whois-страница EN |
| 11 | `src/pages/work-with-me.astro` | «Как со мной работать» RU |
| 12 | `src/pages/en/work-with-me.astro` | «Как со мной работать» EN |
| 13 | `src/pages/value.astro` | Value-страница RU |
| 14 | `src/pages/en/value.astro` | Value-страница EN |

**Итого:** 14 файлов (8 изменений + 6 новых).

---

## 2. Контент-шаблоны

### REQ-023 — Tagline

**RU:** `Гипотеза → эксперимент → метрика → рост.` (заменяет `Данные → решения. От гипотезы до ship-gate.`)

**EN:** `Hypothesis → experiment → metric → growth.`

Подзаголовок и JSON-LD `jobTitle` остаются («Data Analyst / Product Analyst»), чтобы не сломать SEO/понимание роли.

### REQ-024 — whois

Структура (умеренно, профессиональный тон):
- **Кто я:** Никита, data/product analyst, 4+ года, фокус — эксперименты, retention, сегментация.
- **Как работаю:** от гипотезы до метрики; предпочитаю reproducible-аналитику; код + SQL + визуализация.
- **Чем увлекаюсь:** продуктовые метрики, A/B-методология, browser-мини-игры как обучающий инструмент.
- **Где живу / формат:** город, удалёнка/гибрид (по факту), middle+.
- **CTA:** Telegram deep-link.

### REQ-025 — work-with-me

Структура (relationship manual):
- **Ценности:** честность с данными, reproducibility, скорость обучения, прямой фидбек.
- **Стиль работы:** люблю контекст перед запросом, задаю уточняющие вопросы, предпочитаю метрики впечатлениям.
- **Фидбек-нормы:** прямой, конкретный, с предложением; открыт к критике.
- **Встречи:** адженда для 3+, предпочитаю async, но готов к созвонам с целью.
- **Что мне важно в команде:** data-driven решения, владение метриками, экспериментальная культура.

### REQ-026 — value

Структура (offers + proof):
- **Найм:** CV + флагманские кейсы (Volta, A/B, retention).
- **Коллаборация:** кейсы/демо, граф знаний, игры — всё открыто, можно форкнуть/обсудить.
- **Proof:** метрики из `src/lib/metrics.ts` (15 проектов, A/B +6.24pp, retention +9.2pp, RFM 12→41%, бот 2ч→5мин).
- **Единый CTA:** Telegram deep-link.

---

## 3. Подход к реализации

1. **Сначала tagline:** 2 файла, минимальный риск.
2. **Потом Analytics:** добавить 3 события в уже существующий делегированный click-capture + page-view capture.
3. **Потом страницы:** шаблон `.astro` с `Base`, JSON-LD `ProfilePage`, стили через существующие `.board-card`/`.reveal` в global.css.
4. **Nav:** добавить 3 пункта в `Base.astro` (mobile/desktop сразу, так как nav одна).
5. **llms.txt:** дополнить Core pages.
6. **Верификация:** `bun run build` → `bun run check` → `make check`.

**Принципы:**
- Additive, не редизайн.
- Без новых npm-зависимостей.
- Все ссылки через `withBase()`.
- EN-зеркала синхронно.
- zero-JS-by-default сохранён (новые страницы статик).

---

## 4. Верификация

- [x] `bun run build` — проходит, 101 страница.
- [x] `bun run check` — astro check 0 ошибок.
- [x] `bun test` — 136/136 тестов.
- [x] `make check` — все внутренние ссылки валидны.
- [x] Новые страницы в `dist/`: `/whois/`, `/en/whois/`, `/work-with-me/`, `/en/work-with-me/`, `/value/`, `/en/value/`.
- [x] Nav содержит ссылки на новые страницы (`Кто я` / `Ценность` / `Формат` и `Who I am` / `Value` / `Format`).
- [x] `llms.txt` содержит новые Core pages.
- [x] PostHog-события в `Analytics.astro`: `whois_viewed`, `value_viewed`, `work_with_me_viewed`.
- [x] Homepage tagline обновлён на `Гипотеза → эксперимент → метрика → рост.` / `Hypothesis → experiment → metric → growth.`

---

## 5. Риски

- **Риск:** слишком много nav-пунктов → visual clutter. **Митигация:** объединить в dropdown или оставить 3 коротких пункта (`Кто я`, `Ценность`, `Формат`).
- **Риск:** EN-зеркала расходятся. **Митигация:** писать RU и EN параллельно в одной сессии.
- **Риск:** новые страницы выглядят неискренне. **Митигация:** честный тон, конкретика, без маркетинговых фраз.

---

**Реализовано.**
