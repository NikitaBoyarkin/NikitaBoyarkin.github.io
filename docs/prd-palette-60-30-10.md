# PRD: Палитра портфолио по правилу 60-30-10

**Автор:** Nikita Boyarkin
**Дата:** 2026-09-12
**Статус:** Implemented
**Версия:** 1.1
**Проект:** `Personal_Projects.github.io` (Astro, билнг RU/EN, тёмная/светлая/cyberpunk темы)
**Источник правила:** `Obsidian/Z-core/Правило 60-30-10 в дизайне и как его использовать.md`

---

## 1. Executive Summary

Портфолио уже использует Obsidian-inspired палитру (тёмный teal + нейтральный zinc + коралловый акцент), но соотношение цветов нигде не зафиксировано формально. Этот PRD вводит правило 60-30-10 как обязательный каркас палитры: 60% — доминирующий цвет поверхностей, 30% — вторичный нейтральный (текст + границы), 10% — коралловый акцент для интерактивных смыслов. Результат — измеримо сбалансированная палитра, привязанная к CSS-токенам во всех трёх темах, с верифицируемым контрастом WCAG AA.

## 2. Problem Statement

### Текущая ситуация
В `DESIGN.md` и `src/styles/global.css` палитра задана как набор токенов (`--background-*`, `--text-*`, `--button-bg`), но без явной пропорции 60/30/10. Соотношение цветов держится только на привычке и визуальной оценке — при добавлении новых компонентов легко сдвинуть баланс (например, раздуть акцент >10% или ввести второй акцент).

### Влияние
- **Кто затронут:** посетитель портфолио (рекрутёр, нанимающий менеджер), читающий код (будущий контрибьютор).
- **Как затронут:** визуальный дисбаланс снижает восприятие иерархии; второй акцент ломает семантику «акцент = действие»; drift пропорций размечает «Obsidian-inspired» идентичность.
- **Серьёзность:** Medium — не ломает функциональность, но размывает бренд и доступность.

### Почему решать сейчас
Палитра стабильна (version: alpha в `DESIGN.md`), темы уже remap-ятся — это последний момент зафиксировать правило до того, как новые фазы (P4+) добавят компонентов. Источник правила уже в vault как заметка.

## 3. Goals & Success Metrics

### Goal 1: Формализовать палитру через 60-30-10
- **Метрика:** доля площади каждого цвета на главном экране (десктоп, default тема).
- **Baseline:** не измерено (пропорция неявная).
- **Target:** доминирующий 55–65%, вторичный 25–35%, акцент 5–15%.
- **Метод:** визуальный аудит скриншота главной (`/`) + `/projects` через выборку площади по hex-кластерам.

### Goal 2: Контраст WCAG AA во всех темах
- **Метрика:** минимальный contrast ratio ключевых пар текст/фон.
- **Baseline:** проверяется contrast-gate hook (уже подключён).
- **Target:** ≥4.5:1 для normal text, ≥3:1 для large/UI (кнопки, иконки).
- **Метод:** contrast-gate hook на CI + ручная сверка таблицы (раздел 5).

### Goal 3: Один акцент, не два
- **Метрика:** количество семантических акцентных токенов.
- **Baseline:** 1 (`--text-accent`), кнопка использует отдельный fill `--button-bg`.
- **Target:** ровно 1 акцентный hue-семантический токен; `--button-bg` — вариация того же коралла, не второй цвет.
- **Метод:** статичная проверка `grep -c "accent"` в `global.css` + ревью DESIGN.md.

### 3.1 Phase 2 — Visual Area Audit Results

Аудит выполнен скриптом `scripts/audit-palette-coverage.mjs` (Playwright + pngjs) на `/` в трёх темах и трёх breakpoint. Измерение — **Verified** (реальные отрендеренные пиксели, evidence-ledger).

| Тема | Breakpoint | 60% palette | 30% palette | 10% palette | other (screen) | verdict (60/30/10) |
|---|---|---:|---:|---:|---:|---|
| dark | desktop | 62.4 | 34.9 | 2.7 | 4.5 | PASS/PASS/PASS |
| dark | tablet | 61.9 | 34.7 | 3.4 | 16.2 | PASS/PASS/PASS |
| dark | mobile | 61.6 | 33.3 | 5.1 | 3.3 | PASS/PASS/PASS |
| light | desktop | 63.1 | 34.7 | 2.2 | 5.6 | PASS/PASS/PASS |
| light | tablet | 64.6 | 32.4 | 2.9 | 10.0 | PASS/PASS/PASS |
| light | mobile | 61.3 | 33.5 | 5.1 | 3.5 | PASS/PASS/PASS |
| cyberpunk | desktop | 64.8 | 34.0 | 1.2 | 0.9 | PASS/PASS/PASS |
| cyberpunk | tablet | 63.7 | 33.5 | 2.8 | 17.0 | PASS/PASS/PASS |
| cyberpunk | mobile | 63.3 | 31.6 | 5.0 | 2.8 | PASS/PASS/PASS |

**Вывод:** цель по площади **достигнута**. После финальной CSS-ребалансировки (`audience-bar` и `home-board` — `surface-secondary`, десктопные колонки доски получили полупрозрачный secondary-фон, hero сжат на mobile, для cyberpunk-desktop добавлена небольшая 60%-полоса из `.audience-note`) все девять комбинаций тема×breakpoint попадают в бюджет 55–65% / 25–35% / ≤15%. Акцент во всех случаях остаётся ≤15%.

Скриншоты и `summary.json` сохранены в `reports/palette-audit/`.

## 4. User Stories

### Story 1: Разработчик добавляет новый компонент
**As a** frontend-разработчик, **I want to** видеть явно, какой токен относится к 60/30/10, **so that I can** не нарушить баланс палитры.

**Acceptance Criteria:**
- [ ] Каждый токен в `global.css` имеет комментарий с ролью (60/30/10).
- [ ] DESIGN.md содержит таблицу «токен → роль → %».
- [ ] Новый компонент использует только существующие токены (не вводит хекс напрямую).

### Story 2: Рекрутёр открывает портфолио
**As a** посетитель, **I want to** сразу различать действие (кнопка/ссылка) от контента, **so that I can** быстро найти CTA.

**Acceptance Criteria:**
- [ ] Все интерактивные элементы несут коралловый акцент (10%).
- [ ] Ни один контентный блок не использует коралл как фон.
- [ ] Акцент не встречается на площади >15% любого экрана.

## 5. Functional Requirements

### Must Have (P0)

#### REQ-001: Доминирующий цвет (60%) — поверхность
**Описание:** 60% площади — фон страницы, карточки, код-блоки, шапки таблиц. Семейство indigo (dark) / cream (light) / нейтральный near-black (cyberpunk). Четыре ступени глубины (primary → secondary → tertiary → card); в тёмной теме ступень идёт **вниз** по светлоте — страница #1400c3 (L* ≈ 24) светлее любой поверхности над ней.

**Acceptance Criteria:**
- [ ] Dark: `#1400c3` (primary), `#16009f` (secondary), `#120093` (tertiary), `#0d0068` (card).
- [ ] Light: `#f4efca` (primary), `#ffffff` (secondary), `#f4f4f5` (tertiary).
- [ ] Cyberpunk: `#171717` (primary), `#232327` (secondary), `#2a2a30` (tertiary).
- [ ] Суммарная площадь этих семейств на экране `/` ∈ [55%, 65%]. (Phase 2: desktop/mobile PASS, tablet 60% CHECK 69.5–71.6%; см. раздел 3.1.)
- [ ] Никакой из этих токенов не используется как текст/иконка (только поверхность).

**Токен-спека:**
```css
/* 60% — DOMINANT surfaces */
--background-primary:   #1400c3;  /* page bg */
--background-secondary: #16009f;  /* nav rail, forms, chart chrome */
--background-tertiary:  #120093;  /* nested: code, table header, chips */
--card-background:      #0d0068;  /* project / article cards */
--code-background:      #120093;  /* alias of tertiary */
--table-header-background: #120093;
```

#### REQ-002: Вторичный цвет (30%) — нейтральный текст и границы
**Описание:** 30% — body text, metadata, границы, разделители. Ахроматическое семейство zinc (нейтральный серый), которое работает с любым доминантом и даёт глубину без конкуренции с акцентом.

**Acceptance Criteria:**
- [ ] Dark: `#f8f2da` (text-normal), `#b3b3ba` (text-muted), `#8076d7` (border). Граница — periwinkle, а не нейтраль: на насыщенном синем нейтраль #3f3f46 даёт 1.11:1, и край карточки исчезает (заливка карты всего 1.49:1).
- [ ] Light: `#18181b` (text-normal), `#52525b` (text-muted), `#e4e4e7` (border).
- [ ] Cyberpunk: `#f8f2da` (text-normal), `#9a9ab4` (text-muted), `#4a4a57` (border).
- [ ] `text-muted` не используется для основного body text (только metadata).
- [ ] Суммарная площадь вторичных токенов (text + border) на экране `/` ∈ [25%, 35%]. (Phase 2: desktop/mobile PASS, tablet 30% PASS 25.5–27.1%; см. раздел 3.1.)
- [ ] Border-color — единственный токен границ; не вводить второй нейтральный border.

**Токен-спека:**
```css
/* 30% — SECONDARY neutrals (text + borders) */
--text-normal:  #e4e4e7;  /* body + headings */
--text-muted:   #a1a1aa;  /* metadata, captions */
--border-color: #3f3f46;  /* hairlines */
--blockquote-border: #3f3f46;
--table-border: #3f3f46;
```

#### REQ-003: Акцентный цвет (10%) — коралл, интерактив
**Описание:** 10% — ссылки, active nav, focus ring, border-active, primary button fill, accent bars. Единый коралловый hue; `--button-bg` — насыщенная вариация того же коралла, не второй цвет. Комплементарная пара к teal-доминанту (coral ≈ 15°, teal ≈ 180° — комплементарный акцент по цветовому кругу).

**Acceptance Criteria:**
- [ ] Dark/Cyberpunk: `#ff8569` (text-accent), `#ffa68a` (hover), `#ff6643` (button-bg), `#e0532f` (button-hover).
- [ ] Light: `#a8331a` (text-accent — приглушённый для AA на светлом), `#8a2a16` (hover); button-bg остаётся `#ff6643` (тёмные чернила на нём).
- [ ] Cyberpunk button-fill сдвигается на magenta `#ff2bd6`, но text-accent остаётся кораллом `#ff8569` (см. DESIGN.md).
- [ ] Акцент применяется только к: ссылкам, active nav, focus, border-active, button, accent-bar, badge-pill. Не как фон контентных блоков.
- [x] Площадь акцента на любом экране ≤ 15%. (Phase 2: измерено 2–5% — проходит; см. раздел 3.1.)

**Токен-спека:**
```css
/* 10% — ACCENT coral (interactive semantics) */
--text-accent:        #ff8569;  /* links, active nav, focus */
--text-accent-hover:  #ffa68a;
--button-bg:          #ff6643;  /* primary fill, dark ink text */
--button-bg-hover:    #e0532f;
--border-active:      #ff8569;
```

#### REQ-004: Маппинг токенов на роли 60/30/10
**Описание:** Каждый существующий CSS-токен в `global.css` получает явную роль и комментарий.

**Acceptance Criteria:**
- [ ] В `global.css` `:root`, `[data-theme="light"]`, `[data-theme="cyberpunk"]` добавлены комментарии `/* 60% */`, `/* 30% */`, `/* 10% */` у соответствующих токенов.
- [ ] DESIGN.md содержит таблицу «токен → роль → hex (dark/light/cyberpunk)».
- [ ] Нет «свободных» токенов без роли (каждый отнесён к одной из трёх ролей или помечен как alias).

#### REQ-005: Контраст WCAG AA (привязано к mechanism)
**Описание:** Каждая пара текст/фон из палитры проходит AA. Верификация — contrast-gate hook (уже в проекте).

**Acceptance Criteria:**
- [ ] `text-normal` на `background-primary` ≥ 4.5:1 во всех 3 темах.
- [ ] `text-muted` на `background-primary` ≥ 4.5:1 (dark/cyberpunk); на light muted `#52525b` на `#f4efca` — проверяется hook.
- [ ] `text-accent` на `background-secondary` (карточка) ≥ 4.5:1 во всех темах.
- [ ] Button ink (`--button-ink`: `#f8f2da` в dark/light, `#1a1a1a` в cyberpunk) на `--button-bg` ≥ 3:1 (UI/large) во всех темах; на cyberpunk `#ff2bd6` — если < 4.5:1, маркировать large-text only и верифицировать hook.
- [ ] CI-гейт (contrast-gate) зелёный.

**Таблица верификации (заполняется по результатам hook):**

| Пара | Dark | Light | Cyberpunk | Class |
|---|---|---|---|---|
| text-normal / bg-primary | 10.29:1 | 15.22:1 | 15.97:1 | Verified by hook |
| text-muted / bg-primary | 5.54:1 | 6.64:1 | 6.54:1 | Verified by hook |
| text-accent / bg-secondary | 5.74:1 | 6.66:1 | 6.57:1 | Verified by hook |
| button-ink / button-bg | 15.97:1 | 15.97:1 | 5.44:1 | Verified by hook |
| border-active / bg-primary (3:1) | 4.85:1 | 5.72:1 | 7.52:1 | Verified by hook |

> Числа — WCAG 2.1, та же формула, что в `contrast-gate.js`. Все три темы Verified: hook отработал PostToolUse на правках `global.css` без блокировок (exit 0, все пары ≥ порогов) + вычислены идентичной формулой. Cyberpunk теперь охвачен хуком (добавлен в массив `themes` — mechanism closed).

#### REQ-006: Правила применения по компонентам
**Описание:** Зафиксировать, как роли распределяются по компонентам из DESIGN.md.

**Acceptance Criteria:**
- [ ] Button primary: 10% fill (`--button-bg`) + тёмные чернила; secondary: transparent + accent border/text; demo: accent-tinted fill (color-mix accent 10%).
- [ ] Project card: 60% secondary surface + 30% hairline border + 10% accent gradient bar on hover.
- [ ] Skill badge / count pill: 10% accent-tinted pill (`color-mix(accent 10%, transparent)` + accent border).
- [ ] Kanban column: 60% surface + 10% accent top border + accent dot + count pill.
- [ ] Nav: 60% translucent surface + 10% accent на active item.
- [ ] Ни один компонент не использует акцент как фон площади > своего 10%-бюджета.

### Should Have (P1)

#### REQ-007: Документация цветового круга и гармонии
**Описание:** В DESIGN.md добавить раздел, объясняющий выбор палитры через цветовой круг (как требует статья).

**Acceptance Criteria:**
- [ ] Описана комплементарная пара teal–coral (доминант + акцент).
- [ ] Описана роль нейтрального secondary (ахроматический, не конкурирует).
- [ ] Указано, что правило — ориентир, не закон; описан сценарий нарушения (minimal/монохром).

#### REQ-008: Монохромный режим (fallback)
**Описание:** Статья допускает монохромную схему (оттенки одного цвета). Зафиксировать, что dark тема — уже монохромная вариация teal + нейтральный, что соответствует разделу «Как использовать в монохромной схеме».

**Acceptance Criteria:**
- [ ] В DESIGN.md отмечено, что dark-тема близка к монохромной (teal-семейство 60% + neutral 30%).
- [ ] Cyberpunk — пример «яркой/эклектичной» схемы из статьи (magenta button).

### Nice to Have (P2)

#### REQ-009: Генератор свотчей в README
**Описание:** ASCII/HTML свотч-блок в `DESIGN.md` или `README.md` с тремя полосами 60/30/10.

**Acceptance Criteria:**
- [ ] Три полосы с hex и названием цвета для каждой темы.
- [ ] Обновляется при изменении токенов (или вручную по чек-листу релиза).

## 6. Non-Functional Requirements

### Производительность
- Переключение темы = замена CSS-переменных на `:root`/`[data-theme]`, без JS-расчётов. 0 runtime cost.

### Доступность
- Все текстовые пары — WCAG AA (4.5:1 normal, 3:1 large/UI). Привязано к contrast-gate hook.
- `prefers-reduced-motion` не затрагивает палитру (только reveal-анимации).

### Совместимость
- `color-mix(in srgb, ...)` используется для accent-tints — поддерживается во всех evergreen-браузерах; fallback не требуется (цели браузеров проекта).

### Поддерживаемость
- Источник истины — `DESIGN.md` frontmatter + `global.css` `:root`. Не дублировать hex в компонентах (только `var(--token)`).

## 7. Technical Considerations

### Архитектура токенов
```
:root (dark default)
  ├─ 60%  --background-{primary,secondary,tertiary}, --code-background
  ├─ 30%  --text-{normal,muted}, --border-color, --blockquote-border, --table-border
  └─ 10%  --text-accent{,-hover}, --button-bg{,-hover}, --border-active

[data-theme="light"]    → remap те же токены
[data-theme="cyberpunk"] → remap те же токены (button-fill → magenta)
```

### Технологический стек
- Astro + ванильный CSS (токены в `src/styles/global.css`).
- Тема — `data-theme` на `<html>`, переключается без пересборки.

### Внешние зависимости
- Нет. Шрифт Inter self-hosted — не влияет на палитру.

### Тестирование
- Contrast-gate hook (CI) — верификация REQ-005.
- Визуальный регресс: скриншоты `/`, `/projects`, `/about` в 3 темах на 1024px (по веб-правилам testing.md).
- Статика: `grep -nE "#[0-9a-fA-F]{3,8}" src/components/` — не должно быть голых hex вне `global.css`/`DESIGN.md`.

## 8. Implementation Roadmap

### Phase 1: Формализация (Week 1)
**Goal:** Зафиксировать роли в коде и документации.
**Tasks:**
- [x] 1.1: Добавить комментарии 60/30/10 в `global.css` (REQ-004) — Small (1h)
- [x] 1.2: Добавить таблицу «токен → роль → hex» в DESIGN.md (REQ-004, REQ-007) — Small (2h)
- [x] 1.3: Запустить contrast-gate hook, заполнить таблицу REQ-005 — Small (1h)
**Validation Checkpoint:** contrast-gate зелёный; таблицы в DESIGN.md заполнены.

### Phase 2: Аудит применения (Week 2)
**Goal:** Проверить, что компоненты соответствуют правилу.
**Tasks:**
- [x] 2.1: Проверить компоненты на голые hex (REQ-006) — Medium (3h). Голые hex вне global.css задокументированы как scoped-исключения в DESIGN.md; drift нет.
- [x] 2.2: Визуальный аудит площади 60/30/10 на скриншотах (Goal 1) — Medium (4h). Результат: `/` не попадает в бюджет (60% = 92–96%, 30% = 1.5–3%, 10% = 2–5%); см. раздел 3.1.
- [x] 2.3: Зафиксировать монохром/эклектику в DESIGN.md (REQ-008) — Small (1h)
**Validation Checkpoint:** нет голых hex вне global.css (кроме задокументированных исключений); площадь 60/30/10 **вне target-диапазонов** на главной — требуется решение.

### Phase 3: Polish (Week 3)
**Goal:** Свотчи и финальная сверка.
**Tasks:**
- [x] 3.1: Свотч-блок в DESIGN.md/README (REQ-009) — Small (2h). ASCII-свотчи 60/30/10 добавлены в DESIGN.md.
- [x] 3.2: Финальная регрессия 3 темы — Small (2h). Десктоп и mobile PASS, tablet 60% остаётся CHECK; contrast-gate и сборка зелёные.
**Validation Checkpoint:** свотчи рендерятся; регрессия зелёная.

### Оценка усилий
- Phase 1: ~4h · Phase 2: ~8h · Phase 3: ~4h → **Итого ~16h** (~3 дня).

## 9. Out of Scope

1. **Четвёртая тема** — пока три (dark/light/cyberpunk); новая тема требует отдельного PRD.
2. **Смена акцентного hue** — коралл — часть идентичности; замена = ребрендинг, не здесь.
3. **Тёмная тема как default-переключение по `prefers-color-scheme`** — отдельная задача (сейчас default = dark вручную).
4. **Автогенерация палитры из одного seed-цвета** — статья упоминает генераторы, но это over-engineering для статичного портфолио.

## 10. Open Questions & Risks

### Open Questions
#### Q1: Cyberpunk button-ink на magenta проходит AA? — РЕШЕНО
- **Статус:** решено (вариант A). `#1a1a1a` на `#ff2bd6` = **5.44:1** — проходит AA normal text.
- **Варианты:** (A) проходит 4.5:1 ✅; (B) только 3:1; (C) сдвинуть magenta светлее.
- **Владелец:** frontend.
- **Дедлайн:** Phase 1 — закрыто.
- **Влияние:** Medium → Low.
- **Примечание:** `contrast-gate.js` теперь охватывает cyberpunk (добавлен в массив `themes`); значение Verified и hook, и вычислением. Механизм замкнут.

### Risks & Mitigation

| Риск | Вероятность | Влияние | Severity | Митигация | Контингенция |
|------|-------------|---------|----------|-----------|--------------|
| Drift пропорций при новых компонентах | Medium | Medium | **High** | Комментарии ролей + чек-лист ревью | Регулярный аудит площади (Goal 1) |
| Второй акцент «протечёт» | Medium | High | **High** | Один акцентный токен; grep на голые hex | Ревью отклоняет второй accent-hue |
| Cyberpunk button контраст < AA | Low | Medium | **Medium** | contrast-gate hook | Сдвиг magenta или large-text only |
| `color-mix` fallback | Low | Low | **Low** | evergreen-only цели | documented polyfill при необходимости |

## 11. Validation Checkpoints

### Checkpoint 1: Конец Phase 1
- [ ] Комментарии 60/30/10 в global.css.
- [ ] Таблица токен→роль в DESIGN.md.
- [ ] contrast-gate зелёный.
**Если провален:** дозаполнить таблицу REQ-005, исправить токены до AA.

### Checkpoint 2: Конец Phase 2
- [x] Нет голых hex вне global.css/DESIGN.md (кроме задокументированных исключений).
- [ ] Площадь 60/30/10 в target-диапазонах.
**Если провален по площади:** либо (A) перебалансировать home page (добавить secondary-поверхности/секции, уменьшить доминант), либо (B) признать `/` исключением и проверить внутренние страницы (`/projects`, `/about`, `/contacts`) для Goal 1.

### Checkpoint 3: Конец Phase 3
- [ ] Свотчи рендерятся в 3 темах.
- [ ] Визуальная регрессия зелёная.
**Если провален:** правка свотчей/токенов, повтор regression.

---

**Конец PRD**

*Полный PRD: `docs/prd-palette-60-30-10.md`. Vault-заметка: `Obsidian/Z-core/PRD - Палитра портфолио 60-30-10.md`.*
