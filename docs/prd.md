# PRD: Персональный портфолио-сайт (Personal_Projects.github.io)

**Автор:** Nikita Boyarkin
**Дата:** 2026-09-02
**Статус:** Draft
**Версия:** 1.0

---

## 1. Executive Summary

Персональный сайт-портфолио продуктового/data-аналитика. 

Проблема: рекрутер за 30–60 секунд сканирования должен понять уровень (junior/middle/senior), стек и конкретные навыки — абстрактные списки технологий этого не дают.

Решение: статический Astro-сайт с конкретными deliverables (кейс-стади с метриками, демо, capabilities grid, граф знаний) и двухсегментной стратегией — рекрутер конвертируется в контакт, data-комьюнити получает глубину. 

Ожидаемый эффект: рост конверсии «визит → контакт-инициатива» с 6.25% до ≥10% на устойчивом трафике.

## 2. Problem Statement

### Текущая ситуация
Сайт существует и продакшен-готов (P0–P3 дорожной карты выполнены: поиск, таксономия, лента, 3 темы, i18n RU/EN partial, SEO/GEO, CI с Lighthouse-гейтами, PostHog-аналитика, кейс-стади, демо, CV/контакт). 

Продуктовые метрики пока не управляются: аналитика собирается, но конверсия в контакт не имеет цели, дорожная карта P4–P8 формализована в заметках, но не как требования с acceptance criteria.

### Влияние на пользователя
- **Кто затронут:** рекрутеры/нанимающие (первичный сигнал), data-комьюнити (вторичный).
- **Как затронут:** рекрутер не находит конкретику за время скана → уходит без контакта; нанимающий не видит seniority → не зовёт на интервью.
- **Серьёзность:** Medium. Конверсия «визит → контакт» 6.25%, но выборка 16 уник./90д — незначимая статистически.

### Бизнес-влияние
- **Стоимость проблемы:** потерянные интервью — прямой канал найма, конверсия в предложение о работе зависит от числа контакт-инициатив.
- **Стратегическая важность:** сайт — центральный артефакт карьерного цикла (активный поиск BI/DA middle, 2026). High.

### Почему решать сейчас
Сайт технически готов; следующие фазы (capabilities grid, testimonials, senior-темы) — низкая стоимость, высокий продуктовый ROI.

Аналитика PostHog на месте (дашборды «Рекрутер» id=1994322, «Портфолио — аналитика» id=2024833) — можно измерять эффект каждой фазы.

## 3. Goals & Success Metrics

### Goal 1: Конверсия в контакт (основная)
- **Описание:** посетитель сайта совершает контакт-действие (клик Telegram/CV/email/LinkedIn/GitHub).
- **Метрика:** % уникальных посетителей, совершивших ≥1 контакт-действие (события `contact_click`, `cv_footer`, `linkedin_footer`, `github_footer`, `cv_pdf_footer`).
- **Baseline:** 6.25% (1 из 16 уник., 90д до 2026-09-01; выборка мала, направленно, незначимо).
- **Target:** ≥10% при ≥100 уникальных посетителях за 90д; **абсолют:** ≥2 контакт-инициативы/мес.
- **Срок:** квартальный трек, ревью каждые 90 дней.
- **Метод измерения:** PostHog funnel (все $pageview → любой контакт-событие, окно 14д).

### Goal 2: Скилл-восприятие рекрутером
- **Описание:** нанимающий понимает стек и seniority за <2 минут скана.
- **Метрика (прокси):** доля посетителей, добравшихся до доказательств (projects/ или демо), от всех; средняя глубина сессии.
- **Baseline:** глубина/доли не зафиксированы; funnel главная→projects→demos существует в дашборде «Рекрутер».
- **Target:** ≥60% визитов достигают страницы проектов; средняя глубина ≥2 страниц/сессия.
- **Срок:** после фазы P4 (capabilities grid) — 90-дневное окно.
- **Метод измерения:** PostHog funnel (главная → /projects/ → демо) + `$session_duration`.

### Goal 3: Глубина для data-комьюнити
- **Описание:** контент потребляется не поверхностно: граф знаний, посты, мини-игры.
- **Метрика:** доля посетителей с ≥3 pageviews за сессию; время на сайте.
- **Baseline:** не зафиксирована.
- **Target:** ≥20% посетителей с ≥3 pageviews/сессия; средняя длительность сессии ≥2 мин.
- **Срок:** 90-дневный трек.
- **Метод измерения:** PostHog session recording + trends по `$session_duration`.

## 4. User Stories

### Story 1: Рекрутер-сканер
**As a** рекрутер/HR, **I want to** понять за 30 секунд, что кандидат умеет и на каком уровне, **So that I can** решить, звать ли на интервью.

**Acceptance Criteria:**
- [ ] Главная отвечает на «чем кандидат отличается» в 3 блоках видимых без скролла
- [ ] Capabilities grid показывает конкретные deliverables (не абстрактные бейджи «SQL/Python»)
- [ ] Кнопка контакта (Telegram deep-link) доступна с главной без скролла
- [ ] Уровень seniority считывается из таксономии тем (junior/middle/senior/meta)

**Dependencies:** REQ-006, REQ-014, REQ-020

### Story 2: Нанимающий — проверка глубины
**As a** тимлид/нанимающий менеджер, **I want to** углубиться в конкретный кейс, **So that I can** оценить методологию и метрики мышления.

**Acceptance Criteria:**
- [ ] Каждый кейс-стади содержит problem → approach → result → metrics
- [ ] Демо открывается из карточки проекта (кнопка «Live demo»)
- [ ] Граф знаний позволяет бродить между проектами и постами
- [ ] SQL-кейс демонстрирует не только запросы, но и вывод/метрики

**Dependencies:** REQ-003, REQ-008, REQ-010

### Story 3: Комьюнити / читатель
**As a** data-аналитик из комьюнити, **I want to** найти референс-материалы и мини-игры, **So that I can** учиться и возвращаться.

**Acceptance Criteria:**
- [ ] Поиск находит по теме с фасетами и подсветкой
- [ ] Мини-игры (retention-план и др.) доступны с хаба
- [ ] Контент локализован: EN-версии evergreen-гайдов существуют

**Dependencies:** REQ-005, REQ-022

## 5. Functional Requirements

### Must Have (P0) — продакшен-база (выполнено, задокументировано)

#### REQ-001: Архитектура сайта и развёртывание
**Описание:** Статический Astro 5 сайт, деплой на GitHub Pages под subpath `/Personal_Projects.github.io`. Автодеплой на push в main.

**Acceptance Criteria:**
- [ ] `base: '/Personal_Projects.github.io'` задан, все внутренние ссылки/картинки через `withBase()`
- [ ] Build генерирует ≥50 страниц без ошибок
- [ ] Пуш в main запускает CI-workflow и деплой; PR — build+Lighthouse без деплоя
- [ ] `.env`/секреты не попадают в git (GitHub secrets для PostHog-ключей)

**Техническая спецификация:**
```
astro.config.mjs → base, trailingSlash
src/lib/path.ts  → withBase() helper
.github/workflows/deploy.yml → build + astro check + make check + Lighthouse CI + deploy-pages
```

**Task Breakdown:**
- [Платформа]: Done (исторически)
- [CI]: Done (исторически)
- [Тесты]: Done — `npm run build` + `npm run check` + `make check`

**Dependencies:** None

#### REQ-002: Локализация (RU default, EN partial)
**Описание:** RU — дефолт (`prefixDefaultLocale: false`), EN — частичное покрытие без битых ссылок.

**Acceptance Criteria:**
- [ ] RU-роуты работают без префикса `/en/`; EN-роуты под `/en/`
- [ ] Несуществующие EN-экраны (contact, writing) НЕ добавляются в sitemap и ссылки
- [ ] EN-домашняя использует локализованную ленту `<MaterialStrip lang="en" />`
- [ ] 404 lang-aware: `/en/*` показывает EN-404

**Task Breakdown:**
- [i18n]: Done (исторически)
- [Тесты]: Done — `make check` валидирует все внутренние ссылки

**Dependencies:** REQ-001

#### REQ-003: Портфолио проектов с кейс-стади
**Описание:** Контент-коллекция `projects` (RU) + `projects-en` (EN) с Zod-схемами. Кейс-стади формата `problem → approach → result → metrics` с impact-метриками.

**Acceptance Criteria:**
- [ ] У каждого проекта заполнен frontmatter (title, description, tags, demo, caseStudy при наличии)
- [ ] Volta, SQL, bot, supabase, ab-кейсы имеют блоки caseStudy с метриками
- [ ] EN-зеркала проектов синхронизированы с RU (нет расхождений по списку)
- [ ] `src/content/config.ts` (Zod) валидирует обязательные поля; ошибка схемы падает build

**Task Breakdown:**
- [Контент]: Done (исторически)
- [Тесты]: Done — astro check + build

**Dependencies:** REQ-001

#### REQ-004: Три темы и доступность
**Описание:** Тёмная/light/cyberpunk темы, контраст WCAG AA во всех трёх, reduced-motion.

**Acceptance Criteria:**
- [ ] Все 3 темы: контраст текста ≥4.5:1, кнопок ≥3:1 (замер через `contrast-gate.js`)
- [ ] Включён `prefers-reduced-motion`: анимации/транзишены → 0.01ms, `.reveal` виден
- [ ] LCP-изображение профиля: `<picture>` webp(37KB)+jpg, eager
- [ ] Изменение цвета, ломающее контраст, блокируется PostToolUse-хуком

**Task Breakdown:**
- [UI]: Done (исторически)
- [Тесты]: Lighthouse CI a11y ≥0.95 (error), WCAG-замеры

**Dependencies:** REQ-001

#### REQ-005: Сквозной поиск
**Описание:** Build-time `/search-index.json` + inline-остров `SearchBox.astro` (zero-JS-by-default).

**Acceptance Criteria:**
- [ ] Фасеты: Все / Проекты / Записи; активный фасет подсвечен
- [ ] Подсветка совпадений `<mark>` с regex-эскейпом токенов
- [ ] Навигация с клавиатуры; Esc/клик-вне закрывают; фокус возвращается на toggle
- [ ] «Нет результатов» → 7 topic-чипов из `TOPICS`
- [ ] i18n-строки штампуются серверно в `data-i18n` (клиент не трогает `import.meta.env`)
- [ ] Пустой запрос + фасет → browse-режим (последние 8 элементов типа)

**Task Breakdown:**
- [Search]: Done (исторически)
- [Тесты]: astro check 0 ошибок; `make check`

**Dependencies:** REQ-001

#### REQ-006: Таксономия навыков
**Описание:** `src/lib/topics.ts` — единый источник истины: уровни junior/middle/senior/meta, страницы `/topics/[tag]`.

**Acceptance Criteria:**
- [ ] `TOPICS` — единственный источник; нет дублирующих копий в pages
- [ ] Уровни с блёрбами; `getStaticPaths` из `TOPICS`
- [ ] Topic-страницы в sitemap и доступны краулерам
- [ ] Senior-темы (causal inference, metric design) подключены (см. REQ-016)

**Task Breakdown:**
- [Taxonomy]: Done (исторически)
- [Тесты]: sitemap содержит 7+ topic-роутов

**Dependencies:** REQ-001

#### REQ-007: Лента материалов
**Описание:** `MaterialStrip.astro` — scroll-snap лента последних постов + featured Volta.

**Acceptance Criteria:**
- [ ] Лента на обеих домашних (RU + EN `lang` prop)
- [ ] Превью lazy (OG-PNG), scroll-snap, hover-интеракции
- [ ] Карточек в выдаче ≥5 постов + Volta

**Task Breakdown:**
- [Strip]: Done (исторически)
- [Тесты]: build + make check

**Dependencies:** REQ-001, REQ-003

#### REQ-008: Демо проектов
**Описание:** Живые демо в `public/demos/`, запуск из карточек проектов.

**Acceptance Criteria:**
- [ ] `demo:` frontmatter у проектов с демо; кнопка «Live demo» в карточке
- [ ] Демо закрыты: bayesian, cohort, rfm, telegram + мини-игры hub
- [ ] Демо работают из-под subpath (withBase/абсолютные пути)
- [ ] Недостающие демо (SQL DuckDB, garden, site) документированы как отложенные

**Task Breakdown:**
- [Demos]: Done (частично — см. отложенные)
- [Тесты]: make check валидирует внутренние ссылки

**Dependencies:** REQ-001, REQ-003

#### REQ-009: Контакт и конверсия
**Описание:** Полный путь до контакта: контактная страница, CV (RU/EN + PDF), Telegram deep-link, футер (GitHub/LinkedIn/CV), событие `contact_click`.

**Acceptance Criteria:**
- [ ] Telegram deep-link открывает чат одним кликом; событие `contact_click` шлётся
- [ ] EN-CV существует + кнопка PDF
- [ ] Футерные ссылки GitHub/LinkedIn/CV трекаются (`github_footer`, `linkedin_footer`, `cv_footer`, `cv_pdf_footer`)
- [ ] «Что я ищу» указано на контактной поверхности
- [ ] Все контакт-действия попадают в PostHog funnel «визит → контакт»

**Task Breakdown:**
- [Contact]: Done (исторически)
- [Тесты]: make check + события видны в PostHog

**Dependencies:** REQ-001

#### REQ-010: Граф знаний
**Описание:** `/graph/` + `/en/graph/`: build-time граф из коллекций, force-directed SVG, zero-dep. Community detection = greedy modularity (CNM), латеральные рёбра по ≥2 общим тегам.

**Acceptance Criteria:**
- [ ] Обе локали рендерят граф из `graph.json`/`graph-en.json`
- [ ] Cluster-подписи резолвятся (RU=3, EN=4; представитель-узлы в `COMMUNITY_LABELS`)
- [ ] Тумблер «Трек/Категория ↔ Комьюнити» работает
- [ ] Кластеризация по явным рёбрам; латеральные рёбра только в лейауте (не схлопывают кластеры)
- [ ] `astro check` 0 ошибок

**Task Breakdown:**
- [Graph]: Done (исторически)
- [Тесты]: astro check + проверка числа кластеров

**Dependencies:** REQ-001, REQ-003

#### REQ-011: Аналитика
**Описание:** PostHog: pageviews, custom-события, session recording с маскировкой, дашборды.

**Acceptance Criteria:**
- [ ] `Analytics.astro` инициализирует PostHog с `session_recording.mask_all_inputs=true`
- [ ] Ключи в GitHub secrets; lighthouse-джоба без аналитики (чистая производительность)
- [ ] Дашборды живы: «Рекрутер» funnel (id=1994322), «Портфолио — аналитика» (id=2024833)
- [ ] События: `project_viewed`, `post_read`, `lang_switched`, `theme_change`, `game_selected`, contact-события
- [ ] Данные доступны для 90д baseline и пересчёта метрик

**Task Breakdown:**
- [Analytics]: Done (исторически)
- [Тесты]: события в read-data-schema подтверждены (2026-09-02)

**Dependencies:** REQ-001

#### REQ-012: SEO / GEO
**Описание:** JSON-LD (Person RU+EN, Article), OG/Twitter, sitemap, robots, `llms.txt`.

**Acceptance Criteria:**
- [ ] Person schema на обеих локалях; Article schema с `image`/`dateModified`/`articleSection`
- [ ] sitemap включает topics, start, graph, cv + EN-зеркала; robots корректный
- [ ] `llms.txt` для AI-краулеров (GEO), генерируется `src/pages/llms.txt.ts`; AI-краулинг доступен
- [ ] OG-картинки на каждую страницу-шерер (см. REQ-017 residual)

**Task Breakdown:**
- [SEO]: Done (исторически)
- [Тесты]: визуальная сверка `dist/llms.txt`, `dist/sitemap-index.xml`

**Dependencies:** REQ-001

#### REQ-013: CI/CD Quality Gates
**Описание:** Каждое изменение проходит build, `astro check`, `make check`, Lighthouse CI.

**Acceptance Criteria:**
- [ ] GitHub Actions: build → `astro check` (0 ошибок) → `make check` → Lighthouse CI
- [ ] PR-триггер гоняет CI; деплой только на push (гейт `github.event_name == 'push'`)
- [ ] Lighthouse: a11y/best-practices/seo ≥0.95 (error), perf ≥0.85 (warn) на 5 таргетах
- [ ] Vitest: 83/83 тестов зелёных (qa-corpus)

**Task Breakdown:**
- [CI]: Done (исторически)
- [Тесты]: workflow YAML валиден, артефакты Lighthouse на таргетах

**Dependencies:** REQ-001

### Should Have (P1) — следующая дорожная карта

#### REQ-014: Capabilities grid (P4)
**Описание:** Заменить абстрактные skill-badges конкретными deliverables в гриде 6 ячеек (паттерн «concrete over abstract»).

**Acceptance Criteria:**
- [ ] 6 ячеек: A/B-тесты (CUPED+AA+Bonferroni), retention-когорты (ARPU/LTV), RFM (12%→41%), SQL (10 кейсов DuckDB), Telegram-автоматизация, метрики продукта (петля funnel+A/B+retention)
- [ ] Заголовок-глагол + конкретный результат + ссылка на проект в каждой ячейке
- [ ] Responsive грид 2–3 колонки, hover-состояния, CSS-токены из `global.css`
- [ ] Ссылки через `withBase()`; build/check/make check зелёные
- [ ] Статус P4 в дорожной карте обновлён

**Техническая спецификация:**
```
src/pages/index.astro — секция скиллов → <CapabilitiesGrid />
src/components/CapabilitiesGrid.astro (новый) | src/styles/global.css — токены грида
```

**Task Breakdown:**
- [Component]: Small (1h)
- [Content]: Small (0.5h)
- [Верификация]: Small (0.5h) — build + check + make check

**Dependencies:** REQ-001, REQ-003

#### REQ-015: Testimonials (P5)
**Описание:** Блок рекомендаций с реальными отзывами (LinkedIn/Telegram) на главной или в about.

**Acceptance Criteria:**
- [ ] Реальные отзывы собраны (шаблон запроса в `TESTIMONIALS.md`)
- [ ] Блок рендерит отзывы с именем, ролью, ссылкой на профиль
- [ ] При отсутствии отзывов блок скрыт (не ломает верстку)
- [ ] EN-локализация блока (при наличии EN-отзывов)

**Task Breakdown:**
- [Контент]: Medium (ждёт отзывы) — 1–2h
- [Component]: Small (1h)

**Dependencies:** REQ-001; внешнее — получение отзывов

#### REQ-016: Senior-темы (P6)
**Описание:** Добавить senior-уровень в таксономию: causal inference, metric design, experiment governance.

**Acceptance Criteria:**
- [ ] Темы добавлены в `src/lib/topics.ts` с блёрбами и постами
- [ ] Связаны с карьерным нарративом (интервью-готовность)
- [ ] Governance-тема появляется когда появится контент (не пустой роут)
- [ ] sitemap обновлён под новые topic-роуты

**Task Breakdown:**
- [Контент]: Medium (ждёт контент)
- [Taxonomy]: Small (0.5h)

**Dependencies:** REQ-006; внешнее — контент постов

#### REQ-017: OG-PNG dual-format (P7 residual)
**Описание:** `<picture>` webp + PNG для социальных карточек (lazy-превью в MaterialStrip).

**Acceptance Criteria:**
- [ ] OG-превью в ленте используют webp (lazy), OG-meta сохраняет PNG
- [ ] Social card рендер не сломан (PNG доступен для краулеров)
- [ ] Никакой видимой регрессии в MaterialStrip

**Task Breakdown:**
- [Media]: Small (1h)

**Dependencies:** REQ-007, REQ-012

#### REQ-018: ARIA-activedescendant (P7 residual)
**Описание:** Combobox-поиск: скринридер анонсирует навигацию по результатам.

**Acceptance Criteria:**
- [ ] `aria-activedescendant` проставляется на активный результат
- [ ] `aria-controls`/`aria-expanded` корректны; Screen-reader анонсирует выбор
- [ ] Существующая клавиатурная навигация не регрессирует

**Task Breakdown:**
- [A11y]: Medium (2h)

**Dependencies:** REQ-005

#### REQ-019: Поисковое ранжирование (P7 residual)
**Описание:** Поднять качество выдачи: prefix/token-взвешивание, fuzzy для опечаток.

**Acceptance Criteria:**
- [ ] Точное соответствие заголовку ранжируется выше body
- [ ] Опечатки ≤2 символов находят целевой результат (fuzzy)
- [ ] Производительность: индекс build-time, инкремент не нужен (статик)

**Task Breakdown:**
- [Search]: Medium (2h)

**Dependencies:** REQ-005

#### REQ-020: EN-блог (P8, отложен)
**Описание:** Перевод ключевых постов (bayesian, cohort, rfm) в `posts-en` для EN-рынка.

**Acceptance Criteria:**
- [ ] Коллекция `posts-en` с Zod-схемой
- [ ] 3 ключевых поста переведены и связаны с EN-домашней
- [ ] sitemap/titles/OG обновлены под EN
- [ ] Готовность: появление спроса на EN-рынке (трафик/внешний сигнал)

**Task Breakdown:**
- [Контент]: Large (ждёт решения по рынку)

**Dependencies:** REQ-001, REQ-003

### Nice to Have (P2)

#### REQ-021: Страница /now
**Описание:** Рекуррентно обновляемая страница «чем занимаюсь сейчас».

**Acceptance Criteria:**
- [ ] `/now` в sitemap, доступна с навигации
- [ ] Обновление по расписанию (2–4 нед) — процесс задокументирован
- [ ] EN-версия при наличии

**Task Breakdown:**
- [Content]: Small (0.5–1h) + recurrent

**Dependencies:** REQ-001

#### REQ-022: Мини-игры аналитические
**Описание:** Хаб browser-мини-игр + новые игры (retention-план live).

**Acceptance Criteria:**
- [ ] Хаб игр + 5 игр доступны; `game_selected` трекается
- [ ] Рекорды/streak через localStorage (персист)
- [ ] CTA-поверхность в играх → контакт (закрыты `best_broken`, `contact_click`)

**Task Breakdown:**
- [Games]: Medium (3h)

**Dependencies:** REQ-001, REQ-009

## 6. Non-Functional Requirements

### Performance
- LCP < 2.5s, INP < 200ms, CLS < 0.1 (таргеты Lighthouse CI на /, /en/, /writing/, /topics/, /projects/volta/)
- Lighthouse CI: a11y/best-practices/seo ≥0.95 (error), perf ≥0.85 (warn)
- JS-бюджет: zero-JS-by-default для публичных страниц; скрипты только там, где интерактив
- Все изображения с явными размерами; LCP eager, остальное lazy

### Security
- Статический сайт — нет серверного кода/БД; поверхность атак минимальна
- `.env` не коммитится; PostHog-ключи — GitHub secrets
- Session recording с `mask_all_inputs: true` (PII не пишется)
- Нет форм сбора PII (нет автокомментариев/email-захвата)

### Scalability
- GitHub Pages + CDN: нагрузка портфолио (десятки–сотни посетителей/день) не проблема
- Рост данных: контент-коллекции build-time; граф пересобирается при каждом билде

### Reliability
- GitHub Pages статик: SLA ~100% при доступности Pages
- 404 lang-aware; `make check` гарантирует отсутствие битых внутренних ссылок
- CI-гейты блокируют деплой при регрессии (astro check 0 ошибок, make check OK)

## 7. Technical Considerations

### Архитектура
```
Astro 5 static build
├── src/content/        # Zod-коллекции: projects, projects-en, posts, posts-en, volta-parts(+en)
├── src/lib/            # topics.ts, graph.ts, path.ts
├── src/components/     # SearchBox, MaterialStrip, KnowledgeGraph, Analytics, CapabilitiesGrid(новый)
├── src/pages/          # 50+ страниц, /search-index.json.ts, llms.txt.ts, robots.txt.ts (sitemap — интеграция @astrojs/sitemap, не страница)
├── public/             # demos/, games/, images/og/
└── dist/ → GitHub Pages (base: /)
Analytics: PostHog (edge: none — клиентские события, build-time индексы)
```

### Технологический стек
- **Frontend:** Astro 5 (static), компоненты `.astro`, нативные `<script>`-острова (no React/Vue)
- **Backend:** нет (статик)
- **Контент:** Markdown content collections + Zod
- **Инфраструктура:** GitHub Pages, GitHub Actions, Lighthouse CI
- **Аналитика:** PostHog (session replay masked, dashboards)
- **Стили:** глобальные токены CSS, 3 темы, scoped-стили

### Внешние зависимости
1. **GitHub Pages:** хостинг; fallback — любой статик-хостинг, no-code миграция (чистый `dist/`)
2. **PostHog:** аналитика; при недоступности сайт работает (ленивая инициализация, no-block)
3. **GitHub Actions:** CI; локальная верификация (build/check/make check) — эквивалент без CI

### Миграция (для существующих систем)
1. Изменения контента — additive (новые коллекции, frontmatter-поля опциональны)
2. Деплой статики: CI на push; откат = revert коммита (пересборка dist)
3. Нет бета-ростапа — портфолио, полный выкат допустим

### Тестирование
- Unit: vitest 83/83 (qa-corpus «differentiate»)
- Integration: `astro check` (0 ошибок), `make check` (все внутренние ссылки)
- E2E: Lighthouse CI на 5 таргетах (perf/a11y/seo/bp)
- Perf: Lighthouse perf ≥0.85, LCP-таргет
- Контраст: `contrast-gate.js` PostToolUse-хук (WCAG AA)

## 8. Implementation Roadmap

### Phase 0: Продакшен-база (P0–P3) — DONE
**Goal:** Сайт живёт, аналитика собирается, метрики baseline зафиксированы.
**Tasks:** REQ-001…REQ-013 (выполнено исторически; верификация 2026-08-29: astro check 0/0, vitest 83/83, build 91 стр., make check OK).
**Validation Checkpoint:** метрики из PostHog (90д до 2026-09-01) задокументированы в §3.

### Phase 1: Capabilities grid (REQ-014) — DONE 2026-09-02
**Goal:** Конкретика вместо бейджей на главной — метрика скилл-восприятия.
**Tasks:**
- [x] 1.1: Компонент + грид 6 ячеек — `<CapabilitiesGrid.astro` (221 строка, scoped-стили, 3/2/1 responsive, hover/focus-visible)
- [x] 1.2: Контент ячеек — A/B (+6.24pp), retention (ARPU/LTV), RFM (%→% выручки), SQL (sub-100ms), bot (0 ручных шагов), product (€/yr); метрики из `src/lib/metrics.ts`
- [x] 1.3: Верификация — build 91 стр., astro check 0/0/0, make check OK; дорожная карта обновлена (P4 ✅)
**Validation Checkpoint:** грид на главной RU+EN, 6 ячеек с ссылками, 3 проверки зелёные. ✅

### Phase 2: Testimonials (REQ-015) — ждёт отзывы
**Goal:** Social proof от коллег/менторов.
**Tasks:**
- [ ] 2.1: Собрать ≥2 реальных отзыва (шаблон в TESTIMONIALS.md) — Medium
- [ ] 2.2: Компонент блока (скрыт при пустом списке) — Small (1h)
**Validation Checkpoint:** блок рендерит отзывы без ломания вёрстки; EN-вариант готов к отзывам.

### Phase 3: Senior-темы (REQ-016) — ждёт контент
**Goal:** Сдвиг восприятия уровня к senior.
**Tasks:**
- [ ] 3.1: Добавить causal inference + metric design в topics.ts — Small (0.5h)
- [ ] 3.2: Посты + governance-тема когда контент готов — Medium
**Validation Checkpoint:** темы в таксономии, посты связаны, sitemap обновлён.

### Phase 4: Тех-residuals (REQ-017…019) — DONE 2026-09-02
**Goal:** Закрыть известные a11y/perf/SEO-хвосты.
**Tasks:**
- [x] 4.1: OG dual-format (REQ-017) — уже был реализован (`<picture>` webp + PNG-фолбэк в MaterialStrip) — Small (1h)
- [x] 4.2: aria-activedescendant (REQ-018) — уже был реализован (SearchBox:361, `role="listbox"`) — Medium (2h)
- [x] 4.3: Search ranking/fuzzy (REQ-019) — добавлен `src/lib/fuzzy.ts` `ldWithin()` (Левенштейн ≤2, early-exit) в `score()`; title-boost/prefix/locale-boost были. Тест `tests/lib/fuzzy.test.ts` — Medium (2h)
**Validation Checkpoint:** скринридер анонсирует поиск; social-превью не регрессировали; выдача на опечатки находит цель. ✅ vitest 100/100, build 91, check 0/0/0, make check OK

### Phase 5: EN-блог (REQ-020) — отложен
**Goal:** Расширение на EN-рынок при спросе.
**Tasks:** Перевод 3 ключевых постов — Large (6h+).
**Validation Checkpoint:** posts-en live, EN-домашняя ведёт на EN-посты, sitemap EN.

### Зависимости задач
```
Phase 1 → Phase 4 (независимы от 2/3)
Phase 2 ← внешнее (отзывы)
Phase 3 ← внешнее (контент)
Phase 5 ← рыночный сигнал
Critical Path: Phase 1 (сейчас) → анализ PostHog через 90д → пересчёт метрик G1–G3
```

### Оценка усилий
- Phase 1: ~2h
- Phase 2: ~2h + ожидание отзывов
- Phase 3: ~2.5h + ожидание контента
- Phase 4: ~4h
- Phase 5: ~6h (отложен)
- **Итого (активные):** ~8.5h работника + ожидание внешних входов
- **Риск-буфер:** +20%

## 9. Out of Scope

1. **Серверный бэкенд / БД** — сайт остаётся статическим; нет причин для Node API.
2. **Полный EN-блог (P8)** — RU-рынок первичен; запуск при внешнем спросе.
3. **Редизайн темы / дизайн-система** — принцип conservative, additive; текущие 3 темы финальные.
4. **A/B-тестирование рано** — трафик мал (16 уник./90д), детект +20% rel незначим; вернуться при ≥100 уник./мес.
5. **Платный домен / premium-хостинг** — GitHub Pages достаточно.
6. **Автокомментарии / формы сбора email** — нет PII-поверхности, контакт только прямой.
7. **Портфолио-артефакты за пределами сайта** (отдельные GitHub-репо проектов) — сайт ссылается, не хостит.

## 10. Open Questions & Risks

### Open Questions
#### Q1: Брать ли реальные отзывы сейчас?
- **Статус:** шаблон в `TESTIMONIALS.md` готов, отзывов нет.
- **Варианты:** (A) попросить 2–3 коллег/наставников сейчас; (B) ждать естественных.
- **Владелец:** автор.
- **Дедлайн:** до конца P5-фазы.
- **Влияние:** Low (блокирует только P5).

#### Q2: Позиционирование senior — правда ли?
- **Статус:** causal inference/metric design добавлены; governance ждёт контент.
- **Варианты:** (A) усилить посты по senior-темам; (B) держать middle-якорь до появления реального senior-опыта.
- **Владелец:** автор.
- **Дедлайн:** до P6.
- **Влияние:** High (позиционирование уровня — ключ к фильтрам рекрутеров).

#### Q3: Стоит ли платный домен при росте трафика?
- **Статус:** GitHub Pages subpath сейчас.
- **Варианты:** (A) оставить; (B) кастомный домен при ≥500 уник./мес.
- **Владелец:** автор.
- **Дедлайн:** по метрике.
- **Влияние:** Medium (branding, не конверсия).

### Risks & Mitigation

| Риск | Вероятность | Влияние | Severity | Митигация | Контингенция |
|------|-------------|---------|----------|-----------|--------------|
| Трафик слишком мал для значимых метрик | High | High | **Critical** | Копить 90д-окна, использовать прокси-метрики, не делать A/B рано | Качественная обратная связь (рекрутеры в личке), ручные проверки funnel |
| Testimonials не появятся | Medium | Medium | Medium | Шаблон запроса + личная просьба | Пропустить P5, вернуться позже |
| Контент senior-тем не пишется | Medium | Medium | Medium | Приоритизация постов, связь с интервью-подготовкой | Оставить middle-позиционирование |
| EN-partial ломается (битые ссылки) | Low | Medium | Medium | `make check` + sitemap-гейт | Ручной аудит EN-роутов |
| Битый деплой (CI красный) | Low | Medium | Medium | CI-гейты блокируют деплой | Откат коммита, пересборка |
| Граф-кластеры схлопываются при новых рёбрах | Low | Low | Low | Кластеризация по явным рёбрам; латераль в лейауте | Ручная проверка `COMMUNITY_LABELS` |

## 11. Validation Checkpoints

### Checkpoint 1: Конец Phase 1 (Capabilities grid)
**Критерии:**
- [x] 6 ячеек грида на главной RU+EN, каждая с ссылкой на проект
- [x] `npm run build`, `npm run check` (astro check 0), `make check` — зелёные
- [x] Нет новой визуальной регрессии (битовая идентичность scoped-стилей, build-артефакты чистые)
**Если провален:** откат грида, review контента ячеек, повторный прогон. ✅

### Checkpoint 2: Через 90д — пересчёт Goal 1
**Критерии:**
- [ ] Конверсия «визит → контакт»: 6.25% → ≥10% (или ≥2 контакт-инициативы/мес)
- [ ] Доля визитов до /projects/ ≥60%
- [ ] Решение по Q2 (senior-позиционирование) на основе данных
**Если провален:** аудит funnel (где дроп — главная→projects→контакт), A/B на hero-CTA при ≥100 уник./мес, пересборка приоритетов P5–P8.

---

**Конец PRD**
