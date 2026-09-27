# Readability pass — план правок (handoff)

**Статус:** 1 из ~19 правок применена. Остальное — ниже.
**Цель:** улучшить читаемость текста. Верстка абзаца (`justify` + красная строка `1.5em` + `hyphens: auto`) **сохраняется** — это осознанный редакционный выбор в DESIGN.md.
**Область — 3 файла:** `src/styles/global.css`, `src/styles/blog.css`, `DESIGN.md`.

## Что уже сделано (не повторять)

`src/styles/global.css`, блок `body`:
- `font-size: 16px` → `font-size: 1rem` (уважает пользовательский размер шрифта в браузере, при дефолте идентично);
- удалены `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale` (истончают светлый текст на тёмном; DESIGN.md сам требует компенсации для light-on-dark).

## Замеры «до» (Verified, Playwright, 3 темы × desktop 1440 / mobile 390)

Харнесс: `_tmp-readability-audit.mjs` (в корне проекта, временный). Запуск: `PORT=4399 bun _tmp-readability-audit.mjs before`.
Пишет таблицы в stdout и скриншоты в `reports/readability/<label>-*.png`.

| Роль | Кегль | Контраст (dark) | Символов/строку | Ширина |
|---|---|---|---|---|
| project prose (`#project-content > p`) | **16px** | **5.91:1** | **84** | **736px** |
| project list | **16px** | **5.91:1** | **81** | **736px** |
| post prose (`.post-content p`) | **16.8px** | **5.91:1** | **72** | **656px** |
| post list (`.post-content li`) | **14.4px** | **5.16:1** | **76** | **598px** |
| hero prose (`.hero-body`) | **16px** | **11.94:1** | **61** | **534px** |
| featured prose (`.featured-card-description`) | **15.68px** | **5.16:1** | **39** | **344px** |
| bento prose (`.bento-cell-text`) | **15.2px** | **5.16:1** | **39** | **402px** |

Контраст по темам для `--text-muted` на `--background-primary`: dark **5.91:1**, light **6.64:1**, cyberpunk **5.90:1**. Тот же текст под `--text-normal`: dark **11.94:1**, light **15.22:1**, cyberpunk **17.27:1**.

Выводы, которые эти числа доказывают:
1. **Мера.** Проза страниц проектов — **84 симв./строку** при комфортном диапазоне 45–75ch; посты уже на **72** (`.post-content { max-width: 65ch }`). Расхождение между двумя читальными поверхностями, а не новая проблема.
2. **Цвет.** Тело прозы везде покрашено `--text-muted`, хотя DESIGN.md прямо говорит: «`text-muted` — вторичный текст и метаданные; `text-normal` — тело и заголовки». Hero-абзац уже на `--text-normal` (**11.94:1**) — роль в системе есть, проза её просто не использует.
3. **Кегль.** Проза проектов **16px** против **16.8px** у постов — одна роль, два размера.
4. **Худшее место сайта** — карточки featured/bento: **15.2–15.68px** при **5.16:1**.
5. **Списки постов** — **14.4px** при **5.16:1**, самое мелкое и самое бледное.
6. **Микро-лейблы** `.star-compact .star-label` **0.66rem (10.5px)**, `.strip-badge` **0.68rem (10.9px)** — ниже любого читаемого порога.

## Правки

### `src/styles/global.css`

| # | Селектор | Было | Стало |
|---|---|---|---|
| 1 | `#project-content` | нет `max-width`; наследует **736px** | `font-size: 1.05rem; max-width: 65ch;` → **~656px**, **~72 симв./строку** |
| 2 | `#project-content p` | `color: var(--text-muted)` | `var(--text-normal)` → **11.94:1** |
| 3 | `#project-content ul, #project-content ol` | `color: var(--text-muted)` | `var(--text-normal)` |
| 4 | `#project-content blockquote` | `color: var(--text-muted)` | `var(--text-normal)` |
| 5 | `#about p` | `color: var(--text-muted)` | `var(--text-normal)` |
| 6 | `.project p` | `color: var(--text-muted)` | `var(--text-normal)` |
| 7 | `.featured-body p` | `color: var(--text-muted)` | `var(--text-normal)` → **11.94:1** |
| 8 | `.bento-cell-text` | `color: var(--text-muted)` | `var(--text-normal)` → **11.94:1** |
| 9 | `.featured-card-description` | `color: var(--text-muted)` | `var(--text-normal)` → **11.94:1** |
| 10 | `.intro-content p` | `color: var(--text-muted)` | `var(--text-normal)` |
| 11 | `.star-compact .star-label` | `font-size: 0.66rem` (**10.5px**) | `0.72rem` (**11.5px**) |
| 12 | `.strip-badge` | `font-size: 0.68rem` (**10.9px**) | `0.72rem` (**11.5px**) |

### `src/styles/blog.css`

| # | Селектор | Было | Стало |
|---|---|---|---|
| 13 | `.post-content p` | `color: var(--text-muted)` | `var(--text-normal)` → **11.94:1** |
| 14 | `.post-content li` | `color: var(--text-muted)`, кегль **14.4px** | `var(--text-normal)`, кегль `1.05rem` → **16.8px**, **11.94:1** |
| 15 | `.post-content blockquote` | `color: var(--text-muted)` | `var(--text-normal)` |
| 16 | `.blog-card-excerpt` | `color: var(--text-muted)` (**5.16:1**) | `var(--text-normal)` |
| 17 | `.now-item` | `color: var(--text-muted)` | `var(--text-normal)` |
| 18 | `.contact-text` | `color: var(--text-muted)` | `var(--text-normal)` |

### Остаются `--text-muted` (метаданные — правильно)

`.post-meta`, `.post-tag`, `.filter-tag`, `.strip-meta`, `.search-hint`, `.search-empty`, `.search-topics-label`, `footer`, `.project-meta-*`, `.project-tool`, `.now-subtitle`, `.pn-*`, `.blog-card-date`.

### `DESIGN.md` — записать роль-контракт

- **Тело прозы = `--text-normal`**; `--text-muted` — только метаданные (даты, теги, подписи, footer, хлебные крошки). Убрать двусмысленность: сейчас правило написано, но CSS его не соблюдает.
- **Мера 65ch** на обеих читальных поверхностях (`#project-content` и `.post-content`), кегль прозы `1.05rem` — одна роль, один размер, одна мера.
- **База `1rem`**, не `16px`: `rem` уважает пользовательскую настройку размера шрифта в браузере.
- **Пол микро-лейбла `0.72rem`** (~11.5px).
- **Сглаживание:** `-webkit-font-smoothing` не применяется — истончает светлый текст на тёмном.
- **Трекинг на light-on-dark не добавлялся** — осознанно: проза выключена по ширине (`justify`), а `letter-spacing` в оправданном тексте расширяет межсловные пробелы и делает реки заметнее. Компенсация идёт по другим осям: цвет (`muted` → `normal`, ×2 контраста) и возврат веса сглаживанием.

## Верификация

1. `bun run build` (или довольствоваться уже собранным `dist/` — на момент плана он актуален: 18:27, `global.css` 18:16).
2. Сервер: `PORT=4399 bun scripts/serve-dist.mjs` — **именно `bun`**: скрипт использует `import.meta.dir`, в `node` падает с `ERR_INVALID_ARG_TYPE`.
3. `PORT=4399 bun _tmp-readability-audit.mjs after` → сверить таблицу. Ожидания: project prose **~72 симв./строку**, **~656px**, все прозаические роли **11.94:1** (dark) / **15.22:1** (light) / **17.27:1** (cyberpunk); кегль прозы проектов **16.8px**.
4. `bun test tests/lib` — `brand.test.ts` и `demo-tokens.test.ts` парсят токен-блоки и блоки `public/demos/`. **Значения токенов не менялись**, но менять их нельзя: тесты покраснеют.
5. Детектор (обязателен по рецепту `/impeccable typeset`):
   `/Users/nikitaboarkin/.claude/skills/impeccable/scripts/impeccable detect --json --scope type <файлы>`
   Ожидаемый шум, не баг: `overused-font` про Inter (осознан), `design-system-font` про Cormorant (есть в DESIGN.md, детектор не парсит `display` в фронтматтере), **132** `design-system-font-size` (advisory) — единой роль-шкалы нет, это отдельная задача, в объём НЕ входит.
6. Скриншоты: `reports/readability/after-*.png`, сравнить с `before-*.png`. Обязательно посмотреть страницу проекта с широкой таблицей — мера 65ch сузит таблицы (посты уже так живут, прецедент есть).
7. Удалить `_tmp-readability-audit.mjs` в конце.

## Границы

- Токены (`--*`) не трогать: `.claude/hooks/contrast-gate.js` (PostToolUse на `src/styles/global.css`) считает контраст по токен-блокам и вернёт exit 2 при падении ниже AA.
- Второй гард проекта: `.claude/hooks/portfolio-category-guard.js` (фронтматтер постов). Контент не трогаем — не сработает.
- Верстку абзаца (`text-align: justify`, `text-indent: 1.5em`, `hyphens: auto`) не менять.
- 132 размера вне шкалы не сводить к токенам ролей — отдельная задача (пользователь выбрал «хирургия»).
- Тема в Playwright: сайт читает `localStorage['theme']`, иначе `prefers-color-scheme`. Headless Chromium по умолчанию светлый — **тему надо форсить через `addInitScript`**, иначе меряешь light, а не dark.
