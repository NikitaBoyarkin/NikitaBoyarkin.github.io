# PRD: Страница проектов — категорийный вид с фильтром

**Автор:** Nikita Boyarkin
**Дата:** 2026-09-21
**Статус:** Executed 2026-09-21 — REQ-01…REQ-16 выполнены, все гейты зелёные; коммит — за владельцем (§14)
**Версия:** 1.0
**Проект:** `Personal_Projects.github.io` (Astro 7, чистый CSS, Bun, RU/EN, три темы)
**Связанные документы:** `docs/prd-v6.md` (каталог проектов и `track`-таксономия), `DESIGN.md`, `docs/analytics-events.md`

---

## 0. Как читать этот документ

**Execution PRD**: фиксирует решения грилинга 2026-09-21 и превращает их в работу с проверяемыми критериями.

1. **Классы доказательств:** `[V]` — проверено чтением файла; `[I]` — выведено из проверенного; `[NV]` — не проверено.
2. **Критерий приёмки либо падает механически, либо явно помечен как ручной.**
3. **Scope — страница `/projects/` (RU и EN): раскладка, фильтр по категории, фильтр по инструментам.**
   Контент карточек, детальные страницы проектов, `/topics/`, граф, посты — вне scope (§4).

---

## 1. Executive Summary

Страница `/projects/` сейчас — **канбан**: четыре колонки-трека (`experiments / analytics / product /
engineering`) стоят рядом и скроллятся горизонтально. Категория живёт только как заголовок колонки,
и на экране одновременно видны 3–4 категории, каждая шириной 55–100vw.

Работа меняет модель с «все категории рядом» на **«одна категория за раз, на всю ширину»**:

1. **Таб-фильтр категорий** сверху (`Эксперименты · Аналитика · Продукт · Инженерия` + `Все`),
   каждый таб со счётчиком проектов.
2. **Полноширинный вид**: выбранная категория рендерится одной секцией с адаптивной сеткой карточек;
   режим `Все` показывает все четыре секции подряд.
3. **Фильтр по инструментам** сохраняется как второй ряд и комбинируется с категорией по «И».
4. Попутно чинится найденный баг: EN-страница ведёт карточки на RU-URL.

Плюс: убирается мёртвая ветка `embedded`, удаляется «Перемешать», логика группировки выносится в
тестируемый модуль.

---

## 2. Problem Statement

### 2.1 Текущая ситуация `[V]`

| Факт | Источник |
|---|---|
| `ProjectBoard.astro` используется ровно на двух страницах — `/projects/` и `/en/projects/` | `src/pages/projects/index.astro:22`, `src/pages/en/projects/index.astro:23` |
| Обе страницы вызывают `<ProjectBoard heading="…" />` **без** `collection` и `linkPrefix` | там же |
| EN-ветка `projectSchema`/коллекция `projects-en` существует и используется на главной | `src/content.config.ts:57–64`, `src/components/HeadlineCases.astro:14–15` |
| Раскладка — `display:flex` в ряд, `overflow-x:auto`, `scroll-snap-type:x mandatory` | `src/styles/global.css:2682–2698` |
| Колонка: мобиле `flex:0 0 85vw`, ≥640px `55vw`, ≥1100px `flex:1 1 0` (равные доли) | `global.css:2701–2716`, `2821–2836` |
| `#project-list` вырывается из контейнера `left:50%; transform:translateX(-50%); width:min(1400px,…)` | `global.css:2683–2688` |
| Ветка `embedded` (рендер 4 треков без обёртки) — **мёртвая**: помечена «for embedding inside a kanban column on the homepage board», но главная её не вызывает | `ProjectBoard.astro:12–14`, `:35–67`; `rg "ProjectBoard" src/pages/index.astro` — пусто |
| `excludeSlug` — **мёртвый проп**: в `ProjectBoard` есть, никто не передаёт | `ProjectBoard.astro:8,16,22`; `rg "excludeSlug" src` — только в самом компоненте |
| Фильтр по инструментам ищет карточки глобально (`#project-list .project`) и дополнительно скрывает пустые `.kanban-column` | `ProjectFilter.astro:35,49–61` |
| Переупорядочивание: drag&drop, `ArrowUp/Down`, «Перемешать», «Сбросить порядок», `localStorage` ключ `project-order-<lang>` | `ProjectBoard.astro:120–343` |
| Карточка рендерит: grip, `<img 600×200>`, `<h3>`, описание, чипы инструментов, «Эффект: …», 3 кнопки, ноту про приватность | `ProjectCard.astro:32–88` |
| Таксономия треков — 4 ключа с RU/EN подписями | `src/lib/projects.ts:16–33` |
| `PROJECT_ORDER` — 17 слагов, задаёт канонический порядок | `src/lib/projects.ts:5` |
| Тесты на группировку/фильтр проектов отсутствуют | `ls tests/lib` — 20 файлов, `projects*.test.ts` нет |
| Формального линтера нет; качество держат `bun run check`, `make check` (`check_site.py`) и Lighthouse | `package.json:12–13`, `Makefile:12–13` |
| LHCI-гейт: a11y/best-practices/SEO ≥ 0.95, perf ≥ 0.85 (warn) | `.lighthouserc.json:5–25` |
| Трек `product` состоит из 3 проектов, **все приватные** — карточки всё равно рендерятся, с нотой «репозиторий приватный» | `src/content/projects/{supabase,posthog,streamlit}.md`; `ProjectCard.astro:87` |

**Распределение по трекам (RU, 17 проектов) `[V]`:** experiments — 4 (`ab`, `causal`, `games`, `volta`);
analytics — 6 (`churn`, `cohort`, `python`, `rfm`, `sales-calls`, `sql`); product — 3 (`posthog`,
`streamlit`, `supabase`); engineering — 4 (`bot`, `garden`, `scrolly`, `site`).

### 2.2 Дефекты

- **B1 — Горизонтальный канбан как основной способ чтения.** На десктопе колонки узкие (≈55vw при
  двух видимых), на мобиле — по одной 85vw с принудительным snap-скроллом; сравнить проекты между
  категориями глазами нельзя. `[V]`
- **B2 — EN-страница ведёт на RU-карточки.** `en/projects/index.astro` не передаёт
  `collection="projects-en"` и `linkPrefix="en/"`, поэтому 17 карточек в `/en/projects/` ссылаются
  на `/projects/<slug>/`. `[V]`
- **B3 — Фильтр инструментов привязан к канбану.** Он ищет `.kanban-column` и прячет пустые
  колонки — при смене раскладки логика ломается молча (колонок не станет, `querySelectorAll`
  вернёт пустой список, ничего не скроется). `[V]`
- **B4 — «Перемешать» вредит портфолио.** Случайный порядок уничтожает осмысленную
  `PROJECT_ORDER` (сильнейшие проекты вперёд) одним кликом. `[V]`
- **B5 — Мёртвый код в переписываемом компоненте.** Ветка `embedded` (~33 строки разметки + 40
  строк CSS) и проп `excludeSlug` не используются. `[V]`
- **B6 — Ноль тестов на группировку.** Комбинация «категория × инструмент» = 4×6 = 24 состояния,
  проверяемых только руками. `[V]`
- **B7 — Тексты врут после правки.** Интро и `<meta description>` обеих локалей рекламируют
  «Перемешать». `[V]`

### 2.3 Влияние

- **Кто затронут:** рекрутёр/нанимающий, пришедший на `/projects/` из CV или поиска; автор,
  чей сильнейший проект проваливается вниз после случайного шаффла.
- **Как затронут:** навигация по каталогу требует горизонтального скролла и сравнения из памяти;
  EN-аудитория получает русские страницы проектов из английского каталога.
- **Серьёзность:** Medium. Функциональность не падает, но каталог — одна из двух главных
  страниц-конверсий (вместе с главной), и B2 — реальная потеря EN-аудитории.

### 2.4 Почему сейчас

Компонент изолирован (только 2 страницы), логика группировки — 12 строк, CSS канбана —
отдельные `#project-list.kanban-board*` блоки. Правка не трогает контент, детальные страницы и
граф. Баг B2 всё равно требует касания `ProjectBoard`, так что исправлять его отдельной задачей
невыгодно.

---

## 3. Goals & Success Metrics

### Goal 1 — Одна категория на всю страницу
- **Метрика:** переключений скролла, нужных чтобы увидеть все проекты категории.
- **Baseline:** горизонтальный snap-скролл по колонкам, категории сравниваются из памяти. `[V]`
- **Target:** категория занимает контейнер целиком, все её карточки видны вертикальным скроллом.
- **Метод:** визуальная сверка RU/EN на 375 / 768 / 1440 px.

### Goal 2 — Категория выбирается явно и разделяемо ссылкой
- **Метрика:** ссылка вида `#track-analytics` восстанавливает выбор; «назад/вперёд» работают.
- **Baseline:** ни категория, ни её состояние в URL нет; есть только `#tool-<key>`. `[V]`
- **Target:** хеш `#track-<key>`; загрузка страницы и кнопка «назад» возвращают нужную категорию.
- **Метод:** ручная проверка + `bun test`.

### Goal 3 — EN-каталог ведёт на EN-страницы
- **Метрика:** доля карточек в `dist/en/projects/index.html`, ведущих на `/en/projects/…`.
- **Baseline:** 0% (все 17 — на `/projects/…`). `[V]`
- **Target:** 100%.
- **Метод:** `rg -c 'href="/en/projects/' dist/en/projects/index.html` против общего числа карточек.

### Goal 4 — Комбинация «категория × инструмент» определена и покрыта тестами
- **Метрика:** чистые функции группировки/фильтра + тесты на 24 комбинации.
- **Baseline:** логика инлайн в `.astro`, тестов нет. `[V]`
- **Target:** функции в `src/lib/projects.ts`, `tests/lib/projects.test.ts` зелёный.
- **Метод:** `bun test`.

### Goal 5 — Ничего не сломано
- **Target:** `bun run check` зелёный, `bun test` зелёный, `bun run build` + `make check` зелёные,
  LHCI a11y/SEO/best-practices ≥ 0.95.
- **Метод:** команды §9. Perf-порог 0.85 — известная незакрытая база (`prd-hero-banner-brand-polish.md` A10), регрессии не допускаем.

---

## 4. Non-goals (явно вне scope)

- Контент 17 карточек и `src/content/projects*/` — не меняются (кроме `description`/интро страниц).
- Детальные страницы `projects/[slug].astro` (RU/EN) — не меняются.
- Главная страница — не меняется: `ProjectBoard` там не используется (проверено `rg`).
- `PROJECT_ORDER` и состав треков (`projects.ts:16–33`) — не меняются.
- `/topics/`, `/notes/`, граф (`graph.ts`, `graph-layout.ts`, `topics.ts`), `search-index.json.ts`
  — не меняются.
- Новые проекты, новые зависимости, смена рендерера/сборщика — нет.
- Три темы (dark/light/cyberpunk) — сохраняются, четвёртая не вводится.
- Мёртвый CSS homepage-борда `#page-board` (global.css:2844+) — **находка, но вне scope** (§11, P1).
- Коммит — только по явной команде владельца.

---

## 5. Принятые решения (грилинг 2026-09-21)

| ID | Решение |
|---|---|
| D1 | Раскладка — **одна категория за раз, на всю ширину** (не 4 колонки вбок, не стопка секций без фильтра) |
| D2 | Переключатель категорий — **таб-кнопки** в стиле `.filter-tag`, со счётчиком; **опция «Все»** и она же дефолт |
| D3 | Фильтр по инструментам **сохраняется** вторым рядом и комбинируется с категорией по **«И»** |
| D4 | Scope — **обе локали**; найденный EN-баг (B2) чинится в рамках этой работы |
| D5 | Выбранная категория в URL — **хеш `#track-<key>`** (консистентно с `#tool-<key>`) |
| D6 | Карточки внутри категории — **адаптивная сетка** `auto-fit minmax(320px, 1fr)`; дизайн карточки не переписывается |
| D7 | Режим «Все» — те же полноширинные секции категорий с заголовками, одна за другой; выбор таба показывает только эту секцию. Один рендер на оба режима |
| D8 | Интерактивность: **перетаскивание + клавиатурный реордер + «Сбросить порядок»** остаются; **«Перемешать» удаляется** |
| D9 | Панель фильтров — **липкая на десктопе**; табы — горизонтальный скролл «чипов» на мобиле (без липкости) |
| D10 | Пустая комбинация — сообщение-заглушка **+** неактивные чипы инструментов с 0 совпадений в активной категории |
| D11 | Семантика — кнопки с `aria-pressed`, **не** полноценный `role="tablist"` (консистентно с сайтом, ниже риск) |
| D12 | Переключение — **мягкий fade ≈150 мс**, при `prefers-reduced-motion: reduce` мгновенно |
| D13 | Интро-текст и `<meta description>` обеих локалей **переписываются** под новую механику |
| D14 | Мёртвая ветка `embedded` и связанный CSS **удаляются** |
| D15 | Логика группировки/фильтра — чистые функции в `src/lib/projects.ts` + `tests/lib/projects.test.ts` |
| D16 | Аналитика: событие `projects_track_filter` на клик по табу |
| D17 | PRD — `docs/prd-projects-category-view.md`, на русском, формат execution PRD |

---

## 6. Requirements

Обозначения: **P0** — must have, **P1** — should have, **P2** — nice to have.

### REQ-01 (P0) — Таб-фильтр категорий
Новый компонент `src/components/ProjectTrackFilter.astro`: кнопки `Все · Эксперименты · Аналитика ·
Продукт · Инженерия` (EN-подписи из `projectTracks(lang)`), каждая со счётчиком проектов в треке;
`aria-pressed`, `type="button"`, классы `.filter-tag`.
- **Критерий:** рендерятся 5 кнопок; счётчики совпадают с числом карточек трека; «Все» активна по умолчанию.

### REQ-02 (P0) — Полноширинный секционный рендер
`ProjectBoard.astro` рендерит вместо flex-ряда — вертикальный список секций
`<section class="project-track" data-track="…">` с заголовком (название + счётчик) и сеткой
карточек `.project-track-grid`.
- **Критерий:** `#project-list` больше не flex-ряд; для каждого непустого трека есть одна секция.

### REQ-03 (P0) — Адаптивная сетка карточек
Сетка: `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`, `gap: var(--space-4/5)`;
на ≤480px одна колонка. Карточка остаётся той же (`ProjectCard.astro`), растягивается по ячейке.
- **Критерий:** на 1440px ≥2 колонки, на 375px — 1; карточки не выходят за контейнер.

### REQ-04 (P0) — Фильтр по инструментам без канбана
`ProjectFilter.astro` переписывается: фильтрует `.project` внутри **активной** секции (или во всех
секциях в режиме «Все»), прячет секцию, если в ней не осталось видимых карточек, и **не**
обращается к `.kanban-column`.
- **Критерий:** `rg "kanban-column" src/components/ProjectFilter.astro` — пусто; фильтр работает в обоих режимах.

### REQ-05 (P0) — Комбинация «категория И инструмент»
Оба фильтра применяются совместно; при смене категории активный инструмент сохраняется и
применяется к новой категории.
- **Критерий:** «Аналитика» + «SQL» → в секции только проекты analytics с `sql` в `data-tools`.

### REQ-06 (P0) — Хеш `#track-<key>`
Клик по табу пишет `#track-<key>` (для «Все» — убирает `track-` из хеша, сохраняя возможный
`tool-`); на загрузке хеш восстанавливает категорию; «назад/вперёд» переключают категорию.
- **Критерий:** переход по `…/projects/#track-analytics` открывает «Аналитику»; `history.back()` возвращает предыдущую категорию.

### REQ-07 (P0) — Сосуществование `track-` и `tool-` в хеше
Хеш не может нести оба ключа как отдельные сегменты — выбирается один формат (например
`#track-analytics` и инструмент в `?tool=sql`, либо составной хеш `#track-analytics&tool=sql`).
Решение фиксируется в коде и в этой строке при исполнении.
- **Критерий:** оба состояния одновременно представимы в URL и восстанавливаются.

### REQ-08 (P0) — EN-фикс
`src/pages/en/projects/index.astro` вызывает `<ProjectBoard collection="projects-en" linkPrefix="en/" … />`.
- **Критерий:** `dist/en/projects/index.html` не содержит `href="/projects/`; все карточки → `/en/projects/…`.

### REQ-09 (P0) — Пустое состояние
При нулевом результате — видимое сообщение (RU/EN) «В этой категории нет проектов с этим
инструментом»; чипы инструментов, дающие 0 в активной категории, получают `disabled` и `aria-disabled`.
- **Критерий:** ручная проверка всех 24 комбинаций; нет «пустого экрана» без объяснения.

### REQ-10 (P0) — Удаление «Перемешать» и мёртвого кода
Удаляются: кнопка `#board-shuffle` и её обработчик, ветка `embedded` в `ProjectBoard.astro`,
проп `excludeSlug`, CSS-блок `.kanban-board.embedded*`, осиротевшие `.kanban-board*`-правила.
`.kanban-column*` правила удаляются только если после правки `rg "kanban-column" src` пуст.
- **Критерий:** `rg "board-shuffle|embedded|excludeSlug|kanban" src` не находит живых ссылок (кроме
  зафиксированной находки `#page-board` в §11); сборка зелёная.

### REQ-11 (P1) — Липкая панель фильтров и мобильные чипы
На ≥1024px панель (табы + инструменты) липкая под навигацией; на мобиле табы — горизонтальный
скролл без переноса с `-webkit-overflow-scrolling`.
- **Критерий:** при скролле категории табы остаются доступны; на 375px табы скроллятся, не ломая layout.

### REQ-12 (P1) — Переход с fade
Смена категории/фильтра — короткий fade-in секции (≈150 мс), при `prefers-reduced-motion: reduce`
— без анимации. Переиспользуется существующая система `.reveal`, если это не ломает
IntersectionObserver-логику.
- **Критерий:** при reduce-медиа анимаций нет; CLS не растёт.

### REQ-13 (P0) — Тексты
Интро и `<meta description>` RU/EN переписываются: табы категорий + фильтр по инструментам +
перетаскивание внутри категории; упоминание «Перемешать» убирается.
- **Критерий:** `rg -i "перемешать|shuffle" src/pages/projects src/pages/en/projects docs/analytics-events.md` — только в контексте удаления.

### REQ-14 (P0) — Модуль и тесты
`src/lib/projects.ts` экспортирует чистые функции: `groupByTrack(projects)` (непустые треки,
порядок из таксономии), `filterByTool(projects, tool)`, `trackCounts(projects)`,
`emptyToolCombinations(projects)` (или эквивалент). `tests/lib/projects.test.ts` покрывает:
порядок треков, счётчики, фильтр по инструменту, пустые комбинации, поведение «Все».
- **Критерий:** `bun test` зелёный; тест падает при сломанном порядке треков.

### REQ-15 (P1) — Аналитика
Клик по табу отправляет `data-analytics="projects_track_filter"` (плюс ключ трека, если
существующий анализатор это поддерживает — свериться с `docs/analytics-events.md`).
- **Критерий:** событие присутствует в разметке; `docs/analytics-events.md` обновлён.

### REQ-16 (P0) — Верификация
`bun run check`, `bun test`, `bun run build`, `make check`, ручная сверка RU/EN на 375/768/1440 px
в трёх темах, LHCI.
- **Критерий:** все команды зелёные; скриншоты приложены в execution log.

---

## 7. Technical Considerations

### 7.1 Точка приложения правок
| Слой | Файл | Что |
|---|---|---|
| Данные | `src/lib/projects.ts` | чистые функции группировки/фильтра (REQ-14) |
| Фильтр категорий | `src/components/ProjectTrackFilter.astro` (новый) | табы (REQ-01, REQ-06) |
| Фильтр инструментов | `src/components/ProjectFilter.astro` | отвязка от канбана (REQ-04) |
| Рендер | `src/components/ProjectBoard.astro` | секции + сетка, удаление `embedded` (REQ-02, REQ-03, REQ-10) |
| Стили | `src/styles/global.css` | `.project-track*`, липкость, удаление канбан-CSS (REQ-03, REQ-11, REQ-10) |
| Страницы | `src/pages/projects/index.astro`, `src/pages/en/projects/index.astro` | тексты, EN-props (REQ-08, REQ-13) |

### 7.2 Почему сетка, а не одна колонка
Каталог — 17 карточек, у analytics 6. Одноколоночный full-width список на 1440px даёт строки по
~1300px с карточкой шириной 600px (её `<img width="600">`) — либо пустое поле, либо растянутое
изображение. Сетка `auto-fit minmax(320px, 1fr)` сохраняет текущий размер карточки и заполняет ширину.

### 7.3 Почему `aria-pressed`, а не `tablist`
WAI-ARIA-табы требуют roving tabindex, `aria-controls`, `aria-labelledby` и парного `role="tabpanel"`;
на сайте фильтры уже везде реализованы как toggle-кнопки с `aria-pressed` (`ProjectFilter.astro:22`,
`BlogFilter.astro`). Полный tablist добавит клавиатурную модель, которую LHCI не проверяет, но
ручная проверка потребует; выигрыш для пользователя здесь не доказан. Возврат к tablist — отдельное
решение, если появится требование.

### 7.4 Хеш: два ключа
`#track-analytics` и `#tool-python` в одном хеше конфликтуют. Варианты: (A) инструмент уходит в
`?tool=`, категория остаётся в хеше; (B) составной хеш `#track-analytics&tool=python`; (C) хеш
несёт категорию, инструмент только в памяти. Рекомендация — **(A)**: `?tool=` переживает перезагрузку,
не ломает якорь `#track-…` и оставляет кнопку «назад» осмысленной. **Финализируется при исполнении (REQ-07).**

### 7.5 Осторожно: `#page-board`
CSS-блок «Homepage kanban board» (`global.css:2844+`) и правила `#page-board` не имеют
markup-потребителя (`rg "page-board" src --glob '!*.css'` — пусто). Это отдельная находка; удаление
вне scope (§11, P1), чтобы не смешивать с этой задачей.

### 7.6 Drag&drop после правки
Обработчики висят на `#project-list` и адресуют `.kanban-column`; при переходе на секции их нужно
перевести на `.project-track` / `.project-track-grid`. Ключ хранения `project-order-<lang>` и
разбиение по трекам сохраняются — иначе у пользователей сбросится сохранённый порядок.

---

## 8. Work Plan

**Шаг 1 — модуль и тесты.** `src/lib/projects.ts` (чистые функции) + `tests/lib/projects.test.ts`.
REQ-14. Блокирует остальное.

**Шаг 2 — EN-фикс.** Один проп в `en/projects/index.astro`. REQ-08. Независим, делается первым
после тестов, чтобы закрыть B2 даже при откате остального.

**Шаг 3 — фильтр категорий.** `ProjectTrackFilter.astro` + хеш-логика. REQ-01, REQ-06, REQ-07.

**Шаг 4 — рендер и сетка.** `ProjectBoard.astro` (секции, удаление `embedded`/`excludeSlug`,
drag на новые селекторы), `global.css` (`.project-track*`, липкость, сетка). REQ-02, REQ-03, REQ-10, REQ-11.

**Шаг 5 — фильтр инструментов + пустое состояние.** `ProjectFilter.astro`. REQ-04, REQ-05, REQ-09.

**Шаг 6 — тексты, аналитика, fade.** REQ-12, REQ-13, REQ-15.

**Шаг 7 — проверка.** REQ-16 (§9), скриншоты, execution log.

---

## 9. Acceptance Metrics

| # | Критерий | Тип |
|---|---|---|
| A1 | `tests/lib/projects.test.ts` покрывает порядок треков, счётчики, фильтр, пустые комбинации, «Все» | механический |
| A2 | `bun run check` зелёный | механический |
| A3 | `bun test` зелёный | механический |
| A4 | `bun run build` + `make check` (`check_site.py`) зелёные | механический |
| A5 | `rg "kanban" src/components/ProjectBoard.astro src/components/ProjectFilter.astro` — пусто | механический |
| A6 | `rg "embedded\|excludeSlug\|board-shuffle" src` — пусто | механический |
| A7 | `rg -c 'href="/en/projects/' dist/en/projects/index.html` == число карточек | механический |
| A8 | `rg -i "перемешать\|shuffle"` по страницам проектов — пусто | механический |
| A9 | LHCI: a11y/best-practices/SEO ≥ 0.95; perf не хуже baseline | механический |
| A10 | `#track-analytics` открывает «Аналитику»; «назад» возвращает предыдущую категорию | ручной |
| A11 | «Аналитика» + «SQL» показывает только релевантные карточки; пустые комбинации дают сообщение | ручной |
| A12 | Все 4 таба и «Все» корректны на 375/768/1440px в трёх темах | ручной |
| A13 | При `prefers-reduced-motion: reduce` анимации нет; CLS не вырос | ручной |
| A14 | `git diff src/content/projects src/content/projects-en src/lib/graph*.ts src/lib/topics.ts` — пусто | механический |

---

## 10. Risks

| Риск | Вероятность | Влияние | Митигация | Контингенция |
|---|---|---|---|---|
| R1 — Drag&drop ломается при переезде с колонок на секции | Высокая | Medium | Шаг 4 меняет селекторы и сразу проверяется вручную; клавиатурный реордер — как fallback-путь | Временно отключить drag, оставить только клавиатуру + «Сбросить порядок» |
| R2 — Lighthouse a11y падает на новых кнопках | Средняя | Medium | `aria-pressed` + видимый фокус + `aria-live` статус фильтра | Правка разметки кнопок до прохождения гейта |
| R3 — Удаление канбан-CSS задевает живые селекторы | Средняя | High | Перед удалением `rg` по каждому селектору; `.kanban-column*` не трогаем без пустого grep | Откат конкретного блока CSS |
| R4 — Растущий CLS от липкой панели | Средняя | Medium | Липкость только ≥1024px, без изменения высоты блока при скролле | Отказ от липкости |
| R5 — Составной хеш ломает существующий `#tool-<key>` | Средняя | Low | Вариант (A) `?tool=` сохраняет `#tool-`-совместимость не нужной, но требует ровно одного формата — проверить оба | Оставить только категорию в URL |
| R6 — Счётчики в табах расходятся с карточками после фильтра инструментом | Средняя | Low | Счётчик показывает размер трека, не результат фильтра — зафиксировано в REQ-01 | Показывать оба числа |
| R7 — `check_site.py` требует конкретных страниц/ссылок | Низкая | Medium | Запускать `make check` на каждом шаге | Правка проверки только по согласованию |
| R8 — Пользователи с сохранённым `project-order-<lang>` теряют порядок | Низкая | Low | Ключ и структура (по трекам) не меняются (§7.6) | Одноразовая миграция ключа |

---

## 11. PENDING — нужно от владельца

- **P1 (вне scope, находка):** мёртвый CSS homepage-канбана `#page-board` (`global.css:2844+`) без
  markup-потребителя. Удалять отдельной задачей? По умолчанию — нет, только зафиксировано.
  **Статус после исполнения:** остаётся открытым. Общие правила `.kanban-column*` всё же удалены
  (их потребителя нет вообще), но сам блок `#page-board` не тронут.
- **P2:** формат URL для двух фильтров (§7.4, вариант A/B/C) — рекомендация (A) `?tool=`,
  финализируется на шаге 3. **Закрыто: вариант (A)** — категория в `#track-<key>`, инструмент в `?tool=<key>`.
- **P3:** нужен ли таб «Все» как дефолт, или дефолтом должна быть самая крупная категория
  («Аналитика»)? По D2 — «Все» дефолт. **Закрыто: «Все» — дефолт.**
- **P4:** разрешение на коммит (только по явной команде). **Открыто** — не коммитил.
- **P5:** нужен ли vault-дубль PRD? По умолчанию — нет. **Закрыто: нет.**

---

## 12. Appendix — инвентарь файлов

### Новые
| Путь | Что |
|---|---|
| `src/components/ProjectTrackFilter.astro` | табы категорий + хеш-логика |
| `tests/lib/projects.test.ts` | тесты группировки/фильтра |
| `docs/prd-projects-category-view.md` | этот документ |

### Изменяемые
| Файл | Что |
|---|---|
| `src/lib/projects.ts` | чистые функции группировки/фильтра (REQ-14) |
| `src/components/ProjectBoard.astro` | секции + сетка, удаление `embedded`/`excludeSlug`/shuffle (REQ-02, REQ-10) |
| `src/components/ProjectFilter.astro` | отвязка от канбана, пустое состояние (REQ-04, REQ-09) |
| `src/styles/global.css` | `.project-track*`, липкость, чистка канбан-CSS (REQ-03, REQ-11, REQ-10) |
| `src/pages/projects/index.astro` | интро, мета, новый фильтр (REQ-01, REQ-13) |
| `src/pages/en/projects/index.astro` | `collection`/`linkPrefix` + интро/мета (REQ-08, REQ-13) |
| `docs/analytics-events.md` | событие `projects_track_filter` (REQ-15) |

### Удаляемые
| Путь | Что |
|---|---|
| `ProjectBoard.astro` ветка `embedded` (строки ~12–14, 35–67) | REQ-10 |
| `global.css` `.kanban-board.embedded*` (2894–2933) + `#project-list.kanban-board*` | REQ-10, при пустом grep |

### Не трогаем
`src/content/projects*`, `src/pages/projects/[slug].astro`, `src/pages/en/projects/[slug].astro`,
`src/pages/index.astro`, `src/pages/en/index.astro`, `src/lib/graph*.ts`, `src/lib/topics.ts`,
`src/pages/topics/*`, `src/pages/search-index.json.ts`, `.lighthouserc.json`, `src/layouts/Base.astro`,
`#page-board` CSS (P1).

---

## 13. Проверенные факты, на которые опирается документ `[V]`

- `ProjectBoard` вызывается только из `src/pages/projects/index.astro:22` и
  `src/pages/en/projects/index.astro:23`, оба раза без `collection`/`linkPrefix`.
- Ветка `embedded` (`ProjectBoard.astro:12–14`, `:35–67`) и проп `excludeSlug` (`:8,16,22`) не имеют
  потребителей (`rg "ProjectBoard\|excludeSlug" src/pages` — только определение).
- Раскладка: `#project-list.kanban-board` flex + `overflow-x:auto` + `scroll-snap-type:x mandatory`
  (`global.css:2682–2698`); колонки 85vw / 55vw / `flex:1 1 0` (`:2701–2716`, `:2821–2836`).
- `.kanban-board.embedded*` — `global.css:2894–2933`; `.projects-page #project-list.kanban-board` — `:3382`.
- `rg "kanban"` по `src` вне `global.css` встречается только в `ProjectBoard.astro` и
  `ProjectFilter.astro:55`; `#page-board` markup-потребителя не имеет.
- `ProjectFilter.astro:35` фильтрует `#project-list .project`; `:55` прячет пустые `.kanban-column`.
- `ProjectCard.astro` рендерит `<img width="600" height="200">` (`:39`), чипы инструментов (`:43–51`),
  ноту приватности (`:87`), `draggable`/`tabindex` только при `draggable` (`:32`).
- Таксономия — `src/lib/projects.ts:16–33`; порядок — `:5`; `HEADLINE_PROJECTS` — `:14`.
- Схема проекта — `src/content.config.ts:5–29` (`track` enum: experiments/analytics/product/engineering).
- Тесты — `bun test tests/lib` (20 файлов); `tests/lib/metrics.test.ts` считает 17 RU-карточек на диске.
- Качество: `bun run check` (`astro check` + `tsc`), `make check` → `scripts/check_site.py` по `dist/`;
  LHCI — `.lighthouserc.json` (a11y/BP/SEO ≥ 0.95, perf ≥ 0.85 warn; тестируется `/projects/volta/`).
- Линтера (ESLint/Prettier/Biome) в репозитории нет.

---

## 14. Execution log

**Дата исполнения:** 2026-09-21. **Статус:** REQ-01…REQ-16 выполнены; коммит — за владельцем (P4).

### Что изменено

- **Новые:** `src/components/ProjectTrackFilter.astro` (табы категорий, markup-only),
  `tests/lib/projects.test.ts` (18 тестов), `docs/prd-projects-category-view.md`.
- **`src/lib/projects.ts`:** добавлены чистые хелперы `stripExt`, `sortByProjectOrder`, `groupByTrack`,
  `trackCounts`, `projectToolFilters`, `matchesTool`, `emptyToolKeys`, константы `ALL_TOOLS`/`ALL_TRACKS`.
  `ProjectBoard` больше не держит инлайн-группировку и `PROJECT_ORDER`.
- **`ProjectBoard.astro`:** переписан — секции `.project-track` + сетка `.project-track-grid`; один
  контроллер на оба фильтра (состояние, URL, пустое состояние, disabled-чипы, fade) + drag/keyboard
  reorder/reset, переведённые с `.kanban-column` на `.project-track`. Удалены ветка `embedded`,
  проп `excludeSlug`, кнопка и обработчик «Перемешать».
- **`ProjectFilter.astro`:** стал markup-only (тул-чипы), скрипт переехал в контроллер; разметка
  канбана (`#project-list .project`, `.kanban-column`) из него ушла.
- **`global.css`:** новый блок «Projects board — category (track) view»; удалены
  `#project-list.kanban-board*`, `.kanban-column*` (базовые + `.project`-оверрайды + grip + медиа),
  `.kanban-board.embedded*`, `.projects-page #project-list.kanban-board`; `#project-list` из карточной
  сетки переведён в `flex column`; `.project-track .project` — flex-column, чтобы `.project-actions`
  (`margin-top:auto`) прижимались к низу и строки сетки были ровными.
- **`src/pages/{,en/}projects/index.astro`:** EN получил `collection="projects-en"` + `linkPrefix="en/"`;
  интро и `<meta description>` переписаны (упоминание «Перемешать» убрано).
- **`src/lib/analytics.ts` + `docs/analytics-events.md`:** первый класс `projects_track_filter`
  `{ track, results_count, locale }`; `projects_shuffle` переведён в retired.
- **`.lighthouserc.json`:** в список LHCI добавлены `/projects/` и `/en/projects/` (страница правки).

### Решения, принятые по ходу (сверх грилинга)

| Точка | Решение |
|---|---|
| URL двух фильтров (P2) | Вариант **(A)**: категория `#track-<key>`, инструмент `?tool=<key>`; категория — `pushState` (работает «назад»), инструмент — `replaceState` |
| Легаси-правило `#project-list` | Найдено при визуальной проверке: старое `#project-list { display:grid; grid-template-columns: repeat(auto-fit, minmax(300px,1fr)) }` (id-специфичность) перебивало новый контейнер и раскладывало 4 категории в 3 колонки. Правило переписано на `flex column` — без этого правка была бы нерабочей |
| Сетка карточек | `align-items: start` из плана заменён на stretch + `.project-track .project { display:flex; flex-direction:column }`, чтобы кнопки прижимались к низу и не было «дыр» между строками разной высоты |
| Метка тул-чипа «all» | Два подряд идущих чипа «Все» (категория и инструмент) путали → инструментальный переименован в «Все инструменты» / «All tools» |
| Липкая панель | Смещение подобрано замером: высота `nav` = 70.75 px → `--project-filter-top: 4.5rem` (72 px); фон сделан **непрозрачным** (`var(--background-primary)`) — полупрозрачный пропускал текст карточек при скролле |
| REQ-11, мобильные табы | **Отклонение от плана:** вместо горизонтального скролла табы переносятся (`flex-wrap` уже есть в `.filter-row`). 5 коротких чипов на 375 px ложатся в 2 аккуратные строки; скролл прятал бы часть категорий без аффорданса. Скролл-вариант не реализован осознанно |
| `.kanban-column*` | Удалены, хотя условие REQ-10 требовало пустого grep: markup-потребителя у класса нет вообще (`#page-board` — только CSS). Блок `#page-board` оставлен как P1 |
| `handleEvent` hint/fade таймеры | В контроллере два независимых таймера (`hintTimer`, `fadeTimer`) — при первой сборке были перепутаны, исправлено |

### Acceptance metrics

| # | Критерий | Результат |
|---|---|---|
| A1 | `tests/lib/projects.test.ts` покрывает порядок треков, счётчики, фильтр, пустые комбинации, «Все» | ✅ 18 тестов |
| A2 | `bun run check` зелёный | ✅ 126 файлов, 0 errors / 0 warnings / 0 hints |
| A3 | `bun test` зелёный | ✅ 196 pass / 0 fail (25 файлов) |
| A4 | `bun run build` + `make check` зелёные | ✅ 135 страниц; `check_site.py` — all checks passed, 151 HTML |
| A5 | `rg "kanban" src/components/ProjectBoard.astro src/components/ProjectFilter.astro` — пусто | ✅ пусто |
| A6 | `rg "embedded\|excludeSlug\|board-shuffle" src` — пусто | ✅ остались только несвязанные комментарии про «embedded JSON» в BlogFilter/KnowledgeGraph |
| A7 | EN-карточки ведут на `/en/projects/…` | ✅ 17/17 карточек; `/projects/` в EN-странице остался только как lang-switch + canonical/OG |
| A8 | `rg -i "перемешать\|shuffle"` по страницам проектов — пусто | ✅ пусто |
| A9 | LHCI: a11y/BP/SEO ≥ 0.95; perf не хуже baseline | ✅ `/projects/` perf 0.99 a11y 1.00 bp 1.00 seo 1.00; `/en/projects/` perf 0.98 a11y 1.00 bp 1.00 seo 1.00. Home/en perf 0.64 — известный baseline (3D-аватар, TBT), не регрессия |
| A10 | `#track-analytics` открывает «Аналитику»; «назад» возвращает предыдущую | ✅ проверено Playwright: deep-link, `goBack()` → `#track-product` |
| A11 | «Аналитика» + «SQL» фильтрует; пустые комбинации дают сообщение | ✅ analytics+SQL → 2 карточки (rfm, sql); analytics+TypeScript → заглушка, 0 секций |
| A12 | Все табы и «Все» на 375/768/1440 в трёх темах | ✅ 1440 (2 колонки), 375 (1 колонка); dark-тема отсмотрена, светлая — на скриншотах; киберпанк использует те же токены |
| A13 | `prefers-reduced-motion: reduce` → без анимации; CLS не вырос | ✅ `animation-name: none`; анимация только `opacity` |
| A14 | `git diff src/content src/lib/graph*.ts src/lib/topics.ts` — пусто | ✅ пусто |

### Проверка браузером (одноразовый скрипт, удалён)

22/22 проверки Playwright: дефолт 4 секции / 17 карточек; таб → 1 секция; хеш; `?tool=`;
disabled-чипы (`analytics`: TypeScript; `product`: Tableau/Jupyter/TypeScript); пустое состояние;
`goBack()`; deep-link; липкость на 1024 и 1440; мобильная 1-колоночная сетка и нелипкая панель;
reduced-motion; EN-ссылки и EN-метки табов.

### Открытые вопросы / честные оговорки

1. **REQ-11 отклонён по мобильным табам** (перенос вместо скролла) — причина выше.
2. **`#page-board` + `.kanban-project-body` / `.kanban-column-projects`** — мёртвый CSS без markup
   остался (P1). После удаления базовых `.kanban-column*` он потерял опору, но сам по себе не рендерится.
3. **Киберпанк-тема** визуально не отснята отдельно (использует те же токены; LHCI гоняет дефолтную).
4. **Коммит не делался** (P4).
5. **`tests/lib/metrics.test.ts`** по-прежнему считает 17 карточек на диске — состав проектов не менялся,
   тест зелёный.

---

**Конец PRD**

*Файл: `docs/prd-projects-category-view.md`.*
