# PRD v3.0: Конверсия, свежесть и вовлечение

**Автор:** Nikita Boyarkin
**Дата:** 2026-09-08
**Статус:** Draft
**Версия:** 3.0
**База:** PRD v1.0 (`docs/prd.md`, техбаза P0–P8, закрыта) + PRD v2.0 (`docs/prd-v2.md`, личностный слой Phase 6, закрыта)

---

## 1. Executive Summary

Сайт технически и личностно зрелый: 15 проектов, 24 RU-поста, 99 страниц, поиск с fuzzy, граф знаний, capabilities grid, 3 темы, i18n RU/EN partial, PostHog, CI с Lighthouse-гейтами. PRD v1.0 (техбаза) и v2.0 (личностный слой) закрыты.

Следующий рычаг — не новая функциональность, а **замыкание петли «аналитика → оптимизация»**. Сайт собирает богатую аналитику (project_viewed, post_read, *_viewed, delegated clicks), но не использует её для управления конверсией: нет UTM-атрибуции, нет A/B на сайте, нет ревью-ритуала. Параллельно накопился **дрейф данных** (метрики говорят 14 проектов, реально 15) и **незакрытые механики вовлечения блога** из PRD v2 (пагинация, теги с каунтами, random post, keyboard nav).

Ожидаемый эффект: конверсия «визит → контакт» (Goal 1 v1.0, baseline 6.25%, target ≥10%) становится **измеримой и управляемой**; свежесть контента повышает доверие рекрутера; блог-механики повышают глубину сессии и возвраты.

## 2. Анализ текущего состояния (2026-09-08)

### Что сделано (сильные стороны)

| Слой | Статус | Доказательство |
|---|---|---|
| Техбаза (P0–P8 v1.0) | ✅ | поиск+fuzzy, таксономия, лента, карточки, 3 темы, i18n, SEO/GEO, CI+Lighthouse |
| Личностный слой (Phase 6 v2.0) | ✅ | tagline «Гипотеза → эксперимент → метрика → рост», whois, work-with-me, value |
| Контент | ✅ | 15 проектов, 24 RU-поста, 13 EN-страниц, 2 EN-поста, 10 SVG-игр |
| Аналитика | ✅ | PostHog: project_viewed, post_read, *_viewed, lang_switched, delegated `data-analytics` |
| Интерактив | ✅ | SearchBox (fuzzy, keyboard), AskMe (static Q&A), KnowledgeGraph (community detection) |
| Верификация | ✅ | build 101 / check 0/0/0 / make check OK |

### Пробелы (что улучшать)

| # | Пробел | Доказательство | Серьёзность |
|---|---|---|---|
| 1 | **Дрейф метрик:** `METRICS.portfolio.projects = 14`, реально 15 карточек (games добавлен 05.09) | `src/lib/metrics.ts:44` vs `ls src/content/projects/*.md | wc -l` = 15 | HIGH — рекрутер видит расхождение |
| 2 | **/now устарел** (2026-08-12, месяц) | `src/pages/now.astro:20` | MEDIUM — «живая» страница не живёт |
| 3 | **Блог-механики v2 не доделаны:** нет пагинации, тегов с каунтами, random post, keyboard nav | `src/pages/writing.astro` — 24 поста одним списком | MEDIUM — вовлечение |
| 4 | **Навигация перегружена:** 10 пунктов (Start, Projects, Writing, Graph, Games, About, Who I am, Value, How I work, Contact) | `src/layouts/Base.astro:186-194` | LOW — когнитивная нагрузка |
| 5 | **Конверсия не оптимизируется:** нет UTM, A/B на сайте, ревью-ритуала | `Analytics.astro` — сбор есть, управления нет | HIGH — главный рычаг |
| 6 | **Testimonials пуст:** механизм готов, отзывов нет | `TESTIMONIALS.md` + `src/lib/testimonials.ts` | MEDIUM — ждёт контент |
| 7 | **whois: город не указан** | `src/pages/whois.astro` | LOW — PENDING из Phase 6 |
| 8 | **EN-блог (P8):** 2 EN-поста, EN-главная ссылается на RU-посты | `src/content/posts-en/` = 2 файла | LOW — отложен осознанно |

### Вывод

Сайт не «сломан» — он **не управляется данными**. Три рычага роста по ROI:

1. **Данные-интегрити** (дрейф метрик, /now) — дёшево, мгновенно повышает доверие.
2. **Конверсионный контур** (UTM, фаннел, A/B, ревью-ритуал) — превращает аналитику в управление.
3. **Вовлечение блога** (пагинация, теги, random, keyboard) — незакрытые REQ-027..030 из v2.

## 3. Goals & Success Metrics

### Goal 7: Конверсия в контакт — измеримая и управляемая
- **Описание:** контакт-действие (Telegram/CV/email/LinkedIn/GitHub) атрибутируется по источнику и оптимизируется через A/B.
- **Метрика:** % уник. посетителей с ≥1 контакт-событием; конверсия по UTM-источникам.
- **Baseline:** 6.25% (1/16 уник., 90д до 2026-09-01; выборка мала, незначимо).
- **Target:** ≥10% при ≥100 уник./90д; **абсолют:** ≥2 контакт-инициативы/мес.
- **Метод:** PostHog funnel (все $pageview → контакт-событие, окно 14д) + UTM-разбивка.

### Goal 8: Свежесть и доверие
- **Описание:** рекрутер видит актуальные даты и непротиворечивые метрики.
- **Метрика:** дрейф метрик = 0 (авто-проверка в `make check`); /now обновлён ≤30 дней.
- **Baseline:** дрейф 14 vs 15; /now 2026-08-12.
- **Target:** 0 дрейфов; /now ≤30 дней на любой момент проверки.
- **Метод:** `make check` + ручной чек-лист.

### Goal 9: Вовлечение блога
- **Описание:** контент потребляется не поверхностно; читатель возвращается.
- **Метрика:** pageviews/сессия на `/writing/`; доля возвратов за 90д.
- **Baseline:** 24 поста одной страницей, механик нет.
- **Target:** ≥2 поста/сессия на `/writing/`; ≥15% возвратов за 90д.
- **Метод:** PostHog trends по `$pathname` + `$session_duration`.

## 4. User Stories

### Story 7: Рекрутер — доверие
**As a** рекрутер, **I want to** видеть актуальные метрики и даты, **So that I can** доверять кандидату без перепроверки.

**Acceptance Criteria:**
- [ ] Число проектов на главной = числу карточек в борде
- [ ] /now обновлён не позже 30 дней назад
- [ ] Метрики в capabilities grid совпадают с CV

**Dependencies:** REQ-031, REQ-032

### Story 8: Рекрутер — атрибуция
**As a** владелец сайта, **I want to** знать, откуда приходят контакт-инициативы, **So that I can** вкладываться в каналы, которые конвертируют.

**Acceptance Criteria:**
- [ ] UTM-параметры сохраняются в PostHog ($utm_source/$utm_medium/$utm_campaign)
- [ ] Фаннел «рекрутер» показывает конверсию по источнику
- [ ] Ревью-ритуал (еженедельный) зафиксирован

**Dependencies:** REQ-038, REQ-039

### Story 9: Читатель — навигация по контенту
**As a** data-аналитик, **I want to** листать и фильтровать посты, **So that I can** находить релевантное и возвращаться.

**Acceptance Criteria:**
- [ ] Пагинация на `/writing/` (≥10 постов/страница)
- [ ] Теги с каунтами на `/writing/`
- [ ] 🎲 random post работает
- [ ] Keyboard nav (↑↓/↵/esc) на `/writing/`

**Dependencies:** REQ-033, REQ-034, REQ-035, REQ-036

## 5. Functional Requirements

### REQ-031: Fix дрейфа метрик (P0, данные)
**Описание:** Привести `src/lib/metrics.ts` в соответствие с реальностью: 15 проектов (не 14), верифицировать `sqlCases: 10`.

**Acceptance Criteria:**
- [ ] `METRICS.portfolio.projects = 15`
- [ ] `sqlCases` сверен с карточкой sql-проекта (10 кейсов или актуальное число)
- [ ] Авто-проверка в `scripts/check_site.py`: число карточек в `src/content/projects/` == `METRICS.portfolio.projects` (дрейф → fail)

**Техническая спецификация:**
```
src/lib/metrics.ts — число проектов
scripts/check_site.py — новая проверка (make check)
```

**Task Breakdown:**
- [Данные]: Small (0.25h)
- [Проверка]: Small (0.5h)

**Dependencies:** —

### REQ-032: /now — свежесть (P0, доверие)
**Описание:** Обновить /now до актуального состояния (2026-09-08) и зафиксировать каденс обновления.

**Acceptance Criteria:**
- [ ] /now отражает текущее состояние (интервью-цикл, проекты, чтение)
- [ ] Дата «Обновлено» — 2026-09-08 или новее
- [ ] Каденс: обновление при каждом значимом изменении (не реже 1/мес)

**Техническая спецификация:**
```
src/pages/now.astro — контент + дата
```

**Task Breakdown:**
- [Контент]: Small (0.25h)

**Dependencies:** —

### REQ-033: Пагинация блога (P1, из v2 REQ-027) ✅ 2026-09-09
**Описание:** `/writing/` разбить на страницы (паттерн piofant: «старее →»).

**Acceptance Criteria:**
- [x] ≥10 постов/страница, ссылки «← новее / старее →»
- [x] SEO: rel=prev/next или canonical на первую страницу
- [x] EN-зеркало `/en/writing/` (если есть) синхронно
- [x] zero-JS-by-default сохранён (пагинация — статические страницы)

**Техническая спецификация:**
```
src/pages/writing.astro → src/pages/writing/[...page].astro (getStaticPaths)
src/pages/en/writing.astro → src/pages/en/writing/[...page].astro
```

**Task Breakdown:**
- [Page]: Medium (1.5h)

**Dependencies:** REQ-001

### REQ-034: Теги с каунтами (P1, из v2 REQ-028) ✅ 2026-09-09
**Описание:** Показать теги постов с количеством на `/writing/` (фильтр по тегу).

**Acceptance Criteria:**
- [x] Список тегов с каунтами (из frontmatter постов)
- [x] Клик по тегу фильтрует список (client-side, без перезагрузки)
- [x] i18n RU/EN

**Техническая спецификация:**
```
src/components/BlogFilter.astro — расширение (теги + каунты)
```

**Task Breakdown:**
- [UI]: Medium (1h)

**Dependencies:** REQ-001

### REQ-035: 🎲 Random post (P2, из v2 REQ-029) ✅ 2026-09-09
**Описание:** Кнопка «случайный пост» на `/writing/`.

**Acceptance Criteria:**
- [x] Кнопка ведёт на случайный пост (client-side, из search-index или data-атрибута)
- [x] Не ломает zero-JS (кнопка — прогрессивное улучшение)
- [x] Событие `random_post_click` в PostHog

**Техническая спецификация:**
```
src/pages/writing.astro — кнопка + inline-script
```

**Task Breakdown:**
- [UI]: Small (0.5h)

**Dependencies:** REQ-001

### REQ-036: Keyboard nav на /writing (P2, из v2 REQ-030) ✅ 2026-09-09
**Описание:** Навигация по списку постов с клавиатуры (↑↓/↵/esc).

**Acceptance Criteria:**
- [x] ↑↓ перемещают фокус по карточкам, ↵ открывает, esc снимает
- [x] ARIA-атрибуты корректны (aria-activedescendant или roving tabindex)
- [x] Не конфликтует с SearchBox hotkey `/`

**Техническая спецификация:**
```
src/pages/writing.astro — inline-script (паттерн SearchBox)
```

**Task Breakdown:**
- [UI]: Medium (1h)

**Dependencies:** REQ-001

### REQ-037: CTA-аудит и A/B (P1, конверсия) ✅ 2026-09-09
**Описание:** Аудит всех контакт-CTA (AskMe, contact, value, whois, games, footer) и A/B-тест главного CTA.

**Acceptance Criteria:**
- [x] Инвентарь CTA: локация, текст, событие, целевой URL (таблица в `docs/cta-inventory.md`, 20 CTA)
- [x] A/B-тест главного CTA (2 варианта, PostHog flag `hero_cta_variant`, id 872930, client-side 50/50)
- [x] Результат зафиксирован в PostHog, решение — в docs/ (⏳ ждёт ≥30 exposure/руку, ~2–4 нед)

**Техническая спецификация:**
```
docs/cta-inventory.md — инвентарь + дизайн A/B
src/components/HeroCta.astro — A/B-компонент (bundled script, onFeatureFlags → swap text/href)
src/pages/index.astro, src/pages/en/index.astro — HeroCta + data-analytics="hero_cv" (гэп закрыт)
PostHog — флаг hero_cta_variant (id 872930, multivariate control/projects 50/50, client)
```

**Task Breakdown:**
- [Аудит]: Medium (1h) — сделано 2026-09-09
- [A/B]: Medium (1.5h) — сделано 2026-09-09

**Dependencies:** REQ-038

### REQ-038: UTM + referrer-атрибуция (P1, измерение) ✅ 2026-09-08
**Описание:** Гарантировать, что UTM-параметры и referrer сохраняются в PostHog для всех контакт-событий.

**Acceptance Criteria:**
- [x] `utm_source`/`utm_medium`/`utm_campaign` (без `$`-префикса) доступны в PostHog — проверено в read-data-schema 2026-09-08, захватываются на `$pageview` автоматически
- [x] Контакт-события несут `path` (атрибуция к странице клика) — `Analytics.astro` делегированные клики
- [x] Дашборд «Рекрутер» разбивает конверсию по источнику (тайл «Откуда пришли»)

**Техническая спецификация:**
```
src/components/Analytics.astro — добавлен path к делегированным кликам (REQ-038)
PostHog — дашборд «Рекрутер» (id=1994322)
```

**Task Breakdown:**
- [Аналитика]: Medium (1h) — сделано 2026-09-08

**Dependencies:** —

### REQ-039: Фаннел «рекрутер» + ревью-ритуал (P1, измерение) ✅ 2026-09-08
**Описание:** Зафиксировать фаннел главная→проекты→контакт и еженедельный ревью-ритуал.

**Acceptance Criteria:**
- [x] Фаннел в PostHog: главная → /projects/ → контакт-событие (GroupNode OR: CV/Telegram/LinkedIn/GitHub). Шаг `/demos/` удалён — страницы не существует (демо встроены в карточки, games на `/games/`)
- [x] Ревью-ритуал: еженедельный чек (конверсия, топ-страницы, аномалии) — 15 мин
- [x] Ритуал зафиксирован в `docs/analytics-review.md` (с бенчмарком 2026-09-08)

**Техническая спецификация:**
```
PostHog — фаннел «Рекрутер» (id=1994322, insight zlXsA98W)
docs/analytics-review.md — ритуал
```

**Task Breakdown:**
- [Аналитика]: Small (0.5h) — сделано 2026-09-08

**Dependencies:** REQ-038

### REQ-040: Консолидация навигации (P2, UX) ✅ 2026-09-09
**Описание:** Сократить nav с 10 до ≤7 пунктов (группировка личностных страниц).

**Acceptance Criteria:**
- [x] Личностные страницы (whois/value/work-with-me) доступны из about/contact, не обязательно из главного nav — добавлены ссылки в about.astro + contact.astro (RU+EN)
- [x] Nav ≤7 пунктов на desktop, мобильное меню не перегружено — 10→7 (Start, Projects, Writing, Graph, Games, About, Contact)
- [x] Все страницы остаются в sitemap и llms.txt — sitemap авто-генерируется, llms.txt уже содержит whois/work-with-me/value

**Техническая спецификация:**
```
src/layouts/Base.astro — nav (убраны whois/value/work-with-me)
src/pages/about.astro, src/pages/contact.astro + EN — ссылки на личностные страницы
```

**Task Breakdown:**
- [UI]: Medium (1h) — сделано 2026-09-09

**Dependencies:** REQ-001

### REQ-041: Testimonials — сбор (P2, контент) ⏳ PENDING
**Описание:** Собрать 2–3 реальных отзыва по шаблону TESTIMONIALS.md и опубликовать.

**Acceptance Criteria:**
- [ ] ≥2 отзыва в `src/lib/testimonials.ts` (коллега-аналитик, PM/тимлид)
- [ ] Блок на главной рендерит отзывы
- [ ] Отзывы подписаны (имя, роль, компания) со ссылкой

**Техническая спецификация:**
```
src/lib/testimonials.ts — объекты отзывов (механизм готов, пуст по дизайну)
src/components/Testimonials.astro — рендер (готов, ничего не рендерит без данных)
TESTIMONIALS.md — шаблон запроса (готов)
```

**Task Breakdown:**
- [Контент]: Medium (1h, вне кода) — ⏳ ждёт реальных отзывов (фабрикация исключена)

**Dependencies:** —

### REQ-042: whois — город и свежесть (P2, контент) ✅ 2026-09-09
**Описание:** Указать город в whois (PENDING из Phase 6) и проверить актуальность секций.

**Acceptance Criteria:**
- [x] Город указан (или явно «удалённо/гибрид») — «Москва. Удалёнка / гибрид — по договорённости. Middle+.» (RU+EN)
- [x] Секции whois актуальны на 2026-09-08 — проверено, контент текущий

**Техническая спецификация:**
```
src/pages/whois.astro, src/pages/en/whois.astro — контент
```

**Task Breakdown:**
- [Контент]: Small (0.25h) — сделано 2026-09-09

**Dependencies:** —

## 6. Out of Scope

| Задача | Почему вне скоупа |
|---|---|
| EN-блог (P8) | отложен осознанно (RU-рынок), ждёт рыночный сигнал |
| Senior-темы (P3) | ждёт контент (governance, causal inference) |
| GitHub-гигиена (P4) | вне сайта; архивация отложена пользователем |
| OG dual-format webp | низкий ROI (lazy, below-fold) |
| aria-activedescendant в SearchBox | глубокий a11y-gap, отдельный трек |
| Новые проекты/кейсы | контентный трек, не PRD |

## 7. Порядок работ

| Фаза | REQ | Оценка |
|---|---|---|
| **F1 — Данные-интегрити** | 031, 032 | ~0.5h | ✅ 2026-09-08 |
| **F2 — Измерение** | 038, 039 | ~1.5h | ✅ 2026-09-08 |
| **F3 — Вовлечение блога** | 033, 034, 035, 036 | ~4h | ✅ 2026-09-09 |
| **F4 — Конверсия** | 037 | ~2.5h | ✅ 2026-09-09 |
| **F5 — Полиш** | 040, 041, 042 | ~2.25h | ✅ 2026-09-09 (041 ⏳) |

**Итого:** ~11h. F1–F5 — готовы (доверие + измерение + вовлечение + конверсия + полиш). Осталось по контенту: REQ-041 (testimonials, ⏳ ждёт реальных отзывов), A/B-результат REQ-037 (⏳ ждёт ≥30 exposure/руку).

## 8. Верификация

- [x] `bun run build` — проходит, 101 страница
- [x] `bun run check` — astro check 0 ошибок
- [x] `make check` — все внутренние ссылки валидны + новая проверка дрейфа метрик
- [ ] `bun test` — vitest зелёный (если добавлены тесты)
- [ ] PostHog: UTM-поля в схеме, фаннел «Рекрутер» обновлён

## 9. Риски

| Риск | Митигация |
|---|---|
| A/B на статике без сервера | PostHog flag или URL-параметр; выборка мала — интерпретировать осторожно |
| Пагинация ломает SEO | canonical на первую страницу, rel=prev/next |
| Nav-консолидация прячет страницы | Все страницы остаются в sitemap/llms.txt, доступны из about/contact |
| Дрейф метрик вернётся | Авто-проверка в `make check` (REQ-031) |
