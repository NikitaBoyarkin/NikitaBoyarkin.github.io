# PRD улучшения — site (NikitaBoyarkin.github.io)

> Публичная поверхность портфолио должна перестать обещать то, чего нет: битая ссылка «Смотреть на GitHub»
> ведёт в приватный репозиторий, замороженные числа не защищены гейтом, а `/topics/*` и EN-двойник
> существуют без маршрута к ним.
> Owner: nikita · Составлен: 2026-10-14 · Область: `NikitaBoyarkin.github.io/` · Видимость: public

## Контекст

`site` — публичный вход всего портфолио: GitHub Pages, Astro 7, 211 страниц, RU по умолчанию + EN-зеркало.
Он не аналитический проект сам по себе, но он **единственная поверхность, где кейсы встречают читателя**:
рекрутер видит карточку STAR, кейс-страницу с графиками, CV и три role-лендинга. Поэтому рубрика
применяется к нему в двух смыслах: (а) как к проекту — воспроизводимость, гейты, CI; (б) как к **носителю
чужих чисел** — всё, что он утверждает о других членах, обязано совпадать с их источником истины.

Источник истины процедуры — `/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/LOOP.md`. Инвариант:
**правда → глубина → нарратив**. Реестр: `registry.yaml` (`id: site`, `kind: member`, `visibility: public`,
`on_site: true`).

## Текущее состояние (доказательства, не мнения)

| Ось | Что сейчас | Доказательство |
|---|---|---|
| **Правда** | Публичные кейс-страницы рендерят «Смотреть на GitHub →» для репозиториев, помеченных в реестре приватными. Все 4 ссылки отдают **404** | `src/content/projects/linkedin.md:24,27`; `src/content/projects/streamlit.md:22,25`; `src/content/projects/supabase.md:23,26`; `src/content/projects/posthog.md:26,29` (зеркало `src/content/projects-en/` — те же строки); `registry.yaml:35,65,77,125,131`; `curl -w '%{http_code}'` → 404,404,404,404 |
| **Правда** | Гейт дрейфа чисел существует, но не запускается ни `make check`, ни CI | `package.json:35` (`audit:content`) vs `Makefile:12-17` (check без него) и `.github/workflows/deploy.yml:147` (`make check`) |
| **Правда** | Числа сайта заморожены, но не сверены с источником: `docs/content-baseline.json` фиксирует *значение*, не *истинность*. 4 известных расхождения нашёл человек, не механизм | `docs/content-baseline.json`; `scripts/content-drift-audit.mjs:1-40`; `reports/loop/BACKLOG.md` (B42) |
| **Правда** | Машинно-читаемое описание описывает главную, которой нет: «intro, featured project (Volta Neobank…), skill taxonomy», при том что `/` — гейт из трёх карточек и в `dist/index.html` 0 вхождений «Volta» и 0 — «навык» | `src/lib/llms-txt.ts:76` vs `dist/index.html` |
| **Глубина** | Таксономия из 10 страниц `/topics/*` недостижима: **0** статических входящих ссылок с любой другой страницы. `llms.txt` при этом зовёт её «Core page» | `grep -rl 'href="/topics/' dist \| grep -v '^dist/topics/' \| wc -l` → 0; `src/lib/llms-txt.ts:80` |
| **Глубина** | `/graph/` — терминальная страница: в `<main>` **0** элементов `<a>`, следующий шаг отсутствует | `grep -c '<a ' ` по `<main>` внутри `dist/graph/index.html` → 0 |
| **Нарратив** | EN-двойник почти пуст: 2 статьи против 24, `en/rss.xml` — 2 item. `hreflang` при этом **корректен** (174/174 цели существуют), т.е. ложных аннотаций нет — вопрос в решении, а не в баге | `ls src/content/posts-en/*.md \| wc -l` → 2; `src/content/posts` → 24; `dist/en/rss.xml` |
| **Упаковка** | `h2` визуально крупнее `h1`: секционный токен `clamp(1.9rem, 2.3vw, 2.4rem)` обгоняет `.page-title` (2rem) с ~1391px. Плюс 8 разных правил `h1 {`, и `/library/` оформляет свой `h1` секционным токеном | `src/styles/global.css:126` vs `src/styles/blog.css:4-6`; `src/components/ReadingBlock.astro:106`; `grep -rn "h1 {" src/styles src/components \| wc -l` → 8 |
| **Упаковка** | Три инлайновые копии акцентной полосы вместо одного рецепта | токен `src/styles/global.css:167`; копии `src/styles/global.css:1701`, `src/styles/blog.css:102`, `src/components/AboutPage.astro:94` |
| **Упаковка** | Перф-хвосты: `/repo-audit/` — perf 51, TBT 1 650 ms, LCP 4.1 s; `/en/` — LCP 3.2 s (порог «good» 2.5 s) | `lhci-reports/localhost-repo_audit_-2026_10_13_23_35_33.report.json`; сводка по 16 URL из того же каталога |
| **Упаковка** | `sitemap.xml`: у 86 из 210 URL нет `lastmod`, включая все 46 страниц модулей Volta — самые запрососпецифичные страницы | `astro.config.mjs:62-69` (в `CONTENT_SOURCES` нет `library`, `volta-parts`, `topics`); подсчёт по `dist/sitemap-0.xml` |
| **Упаковка** | 44 узла `Article` (страницы проектов) без `image` — Google не даёт rich result | `src/pages/projects/[slug].astro:116-122` (в объекте нет `image`) |
| **Flags** | Полоса букв словаря смешивает кириллицу и латиницу в одном ряду: гомоглифы `А/A`, `В/B`, `К/K`, `М/M`, `Р/P`, `С/C` читаются как задвоенные буквы | `src/components/GlossaryFilter.astro:135` (`CYRILLIC + LATIN`) |
| **Flags** | Устаревшие счётчики в README (workflows 3→6, components 27→37, routes 24→36, сьюты 25→38) | `README.md:194,197,199,203,338,348,364,368,373` (уже заведено как **B43**) |
| **Упаковка** | Тесты **не** вакуумны: единственные `describe.skip` условны — идут только на пустой коллекции | `tests/lib/glossary.test.ts:44-50`; `tests/lib/library.test.ts:95-100` |

Preflight: `bash scripts/preflight.sh` → **OK — all 57 claims reproduce from the data** (включая `volta A/B KYC lift (pp) 5.72`, `linkedin ER % 1.71`, `rag recall@5 1.0`). Гейт правды портфолио зелёный —
находки ниже лежат **не** в данных, а в поверхности сайта и в её связке с источником.

## Уже сделано в этом цикле (не переделывать)

| Что | Доказательство на диске |
|---|---|
| Футер несёт маршрут к контакту на каждой странице | `src/layouts/Base.astro:552` |
| Инлайн-навигация в топбаре от 1400px (ниже — drawer) | `src/layouts/Base.astro:806` |
| Токен `--accent-ink`: контраст акцентной плашки в светлой теме 2.61:1 → 6.66:1 | `src/styles/global.css:280` |
| Видимый FAQ вместо разметки-фантома (`FAQPage` без FAQ) | `src/pages/projects/[slug].astro:100,253` |
| Доска `/projects/`: 2 колонки, страница 10 090 → 5 807px | `src/styles/global.css:3380` |
| `/library/`: плитки 570 → 264px | `src/components/ReadingBlock.astro:127` |
| Hero `/hr/` и `/manager/`: пустая колонка 40% убрана | `src/styles/global.css:843` |
| Обложки карточек статей убраны; 45 мёртвых `.webp` (2.1 МБ) удалены; кап чипов на телефоне | `src/styles/blog.css:65`; `src/components/BlogFilter.astro:253`; `scripts/generate-og.mjs` |

## Цели и метрики (baseline → target)

| Метрика | Baseline | Target | Команда воспроизведения |
|---|---|---|---|
| `github:`-ссылки на публичной поверхности, отдающие не-200 | 4 | 0 | `for u in $(grep -rh "^github:" src/content/projects/ \| awk '{print $2}'); do curl -s -o /dev/null -w "%{http_code} $u\n" -L "$u"; done` |
| Дрейф чисел в `make check` / CI | не запускается | красный при дрейфе | `grep -n 'audit:content' Makefile .github/workflows/*.yml` |
| Страницы `/topics/*` без входящих ссылок | 10 | 0 | `grep -rl 'href="/topics/' dist \| grep -v '^dist/topics/' \| wc -l` |
| EN-статей | 2 | 0 (снято) или ≥ 10 | `ls src/content/posts-en/*.md \| wc -l` |
| Страниц, где computed `h2`-секции > `h1` страницы | все ≥1391px | 0 | новый `tests/lib/typography-scale.test.ts` |
| URL sitemap без `lastmod` | 86 | 0 | `grep -c '<lastmod>' dist/sitemap-0.xml` против `grep -c '<loc>'` |
| Узлы `Article` без `image` | 44 | 0 | `grep -c '"@type":"Article"' dist/projects/*/index.html` + проверка `image` |
| TBT на `/repo-audit/` | 1 650 ms | < 300 ms | `bun run build && bun run serve-dist` + `npx lhci autorun` (`.lighthouserc.json`) |

## Требования

### REQ-001 — Публичная страница не ведёт в приватный репозиторий (P1, High, S)

**Находка:** Правда · «Смотреть на GitHub →» рендерится для проектов с `private: true`, и все 4 адреса дают 404.
**Доказательство:** `src/content/projects/streamlit.md:22,25` (и `src/content/projects/supabase.md:23,26`, `src/content/projects/posthog.md:26,29`, `src/content/projects/linkedin.md:24,27`); зеркало `src/content/projects-en/` — те же строки; `registry.yaml:65,77,125,131` (`visibility: private`, `on_site: true`); `curl` → 404 ×4.
**Проблема:** страница одновременно обещает код и признаёт репозиторий приватным — проверочный путь ведёт в пустоту. Для рекрутера это ломает доверие сильнее отсутствия ссылки.
**Требуется:** для проекта с `private: true` ссылка на репозиторий не рендерится ни на карточке, ни на странице кейса; вместо неё остаётся только нота «доступ по запросу». Поле `github:` при этом сохраняется как данные (для `llms.txt`/превью), но не выводится как ссылка.
**Acceptance criteria:**
1. Ни один HTML в `dist/` не содержит `<a … href` на `github.com/NikitaBoyarkin/<private-repo>`.
2. Каждый `github:`-адрес, который всё-таки рендерится, отвечает 200 (команда из таблицы метрик).
3. Новый тест в `tests/lib/` падает, если в одном файле встретились `private: true` и рендерящийся `github:`.
**Проверка:** `bun run build && bun run test:built` зелёные + `grep -rn "private: true" -B4 src/content/projects/`.
**Исполнитель:** @context-architecture.

### REQ-002 — Дрейф чисел ловит гейт, а не человек (P1, High, S)

**Находка:** Правда · механизм есть, запуска нет.
**Доказательство:** `package.json:35`; `Makefile:12-17`; `.github/workflows/deploy.yml:147`.
**Проблема:** правило «переписывай подачу, не число» (`scripts/content-drift-audit.mjs`) держится на памяти — ровно тот случай, который доктрина называет «правило без механизма».
**Требуется:** `make check` включает `bun run audit:content`; деплой наследует это через `make check`.
**Acceptance criteria:**
1. `grep -n audit:content Makefile` находит строку внутри цели `check`.
2. Мутация: правка одного числа в `src/content/posts/cohort-retention-guide.md` → `make check` красный с указанием файла; откат → зелёный.
3. `make check` на интактном дереве зелёный (гейт не шумит).
**Проверка:** `make check` (дважды: с мутацией и без).
**Исполнитель:** @ci-cd-and-automation.

### REQ-003 — Числа сайта сверяются с источником, а не только замораживаются (P1, Med, M)

**Находка:** Правда · `docs/content-baseline.json` фиксирует значение, но ничто не проверяет, что значение верно.
**Доказательство:** `docs/content-baseline.json`; `scripts/content-drift-audit.mjs:1-40`; расхождения уже найдены вручную — `reports/loop/BACKLOG.md` (B42: `src/content/projects/ab.md:3,13` «18 модулей» vs 15; `src/content/projects/cohort.md:3,7`; `src/content/projects/churn.md:3,36`; `src/content/projects/serp-rank.md:13`).
**Проблема:** сайт — носитель чисел шести членов; при расхождении с `scripts/check_claims.py` сайт врёт на самой видимой поверхности, и поймать это может только человек, читавший оба файла.
**Требуется:** сверка чисел кейс-страниц с claim-ами источника. Механизм — часть сайтового `make check`, список пар «страница ↔ claim» явный и расширяемый.
**Acceptance criteria:**
1. 4 расхождения B42 либо исправлены, либо помечены `ack` с причиной.
2. Для ≥5 кейсов (`volta`, `ab`, `cohort`, `churn`, `serp-rank`) хотя бы по одному числу сверено с claim-ом автоматически.
3. Расхождение в тестовой мутации (правка числа в `ab.md`) валит гейт.
**Проверка:** `bash /Users/nikitaboarkin/Desktop/00\ ide/00\ portfolio/scripts/preflight.sh` + `make check`.
**Исполнитель:** @da-metric-reconciliation.

### REQ-004 — `llms.txt` описывает сайт, который есть (P2, Med, S)

**Находка:** Правда · машинно-читаемое описание ссылается на несуществующее содержимое.
**Доказательство:** `src/lib/llms-txt.ts:76` («featured project (…), skill taxonomy») против `dist/index.html` (0 «Volta», 0 «навык»); 52 URL из `dist/sitemap-0.xml` отсутствуют в `dist/llms.txt` (все 23 EN-модуля Volta, все 6 role-страниц, `/projects/`, `/writing/`, `/library/`, `/contact/`).
**Проблема:** AI-краулер получает карту сайта, где входная страница описана как страница-каталог. Это утверждение о себе, которое неверно.
**Требуется:** описание главной соответствует её реальной роли (гейт: имя, роль, три пути); перечислены все хабы и role-страницы; EN-модули Volta — по аналогии с RU-блоком.
**Acceptance criteria:**
1. Ни одно утверждение из `dist/llms.txt` не противоречит `dist/index.html`.
2. Каждый `[label](url)` в `llms.txt` резолвится в существующий файл в `dist/` (0 битых).
3. `reports/loop/BACKLOG.md`-стиль: список URL в `llms.txt` покрывает ≥95% `sitemap-0.xml`.
**Проверка:** `bun run build && bun test tests/lib` + скрипт-сверка «llms.txt ⊂ dist».
**Исполнитель:** @ai-seo.

### REQ-005 — Таксономия `/topics/*` достижима (P2, Med, M)

**Находка:** Глубина · изобретённая глубина без маршрута к ней.
**Доказательство:** 10 страниц `/topics/*`; `grep -rl 'href="/topics/' dist | grep -v '^dist/topics/'` → 0; `src/lib/llms-txt.ts:80` зовёт её «Core page»; в `navLinks` (`src/layouts/Base.astro:132-175`) её нет.
**Проблема:** самый «глубокий» контент сайта — карта компетенций — недостижим кликом. Для читателя этих страниц нет.
**Требуется:** таксономия получает точку входа (нав-пункт или блок на `/writing/` и в кейсах) и обратные ссылки «тема → материалы».
**Acceptance criteria:**
1. ≥1 статическая входящая ссылка с ≥5 страниц (не из `/topics/`).
2. Страницы `/topics/<tag>/` остаются в sitemap и получают `lastmod`.
3. Тест «0 сирот» в `test:built`: каждая страница из sitemap достижима по ссылке.
**Проверка:** `bun run build` + команда из таблицы метрик (0).
**Исполнитель:** @site-architecture.

### REQ-006 — `/graph/` не терминален (P2, Med, S)

**Находка:** Глубина · самая глубокая карта заканчивается ничем.
**Доказательство:** в `<main>` страницы `dist/graph/index.html` — 0 элементов `<a>`; навигация по узлам только JS-обработчиком.
**Проблема:** читатель, дошедший до карты знаний, не получает следующего шага; при выключенном JS страница — статичная картинка.
**Требуется:** ≥2 статических выхода (например, в `/projects/` и `/writing/`) и текстовая альтернатива (список узлов-links уже есть у `ProjectGraph` — распространить на `KnowledgeGraph`).
**Acceptance criteria:**
1. `grep -c '<a '` по `<main>` `dist/graph/index.html` ≥ 2.
2. Страница остаётся `bleed`-раскладкой (визуальная проверка).
3. Ссылки отвечают 200 (покрывается `scripts/check_site.py`).
**Проверка:** `bun run build && python3 scripts/check_site.py`.
**Исполнитель:** @site-architecture.

### REQ-007 — EN-двойник: либо контент, либо честное снятие (P2, Med, M) — **HUMAN**

**Находка:** Нарратив · двуязычность заявлена, но покрывает 8% статей.
**Доказательство:** `src/content/posts` — 24 файла, `src/content/posts-en` — 2; `dist/en/writing/index.html` — 2 карточки; `dist/en/rss.xml` — 2 item; при этом `hreflang` корректен (174 ссылки, все цели существуют).
**Проблема:** EN-раздел выглядит заброшенным; для читателя, пришедшего из англоязычной выдачи, сайт хуже, чем для русскоязычного. Ложных аннотаций при этом нет — это решение о содержании.
**Требуется:** зафиксировать решение: (а) довести EN-статьи до представимого минимума, либо (б) снять `/en/writing/` из навигации, `llms.txt` и `hreflang`-пар.
**Acceptance criteria:**
1. Решение записано в `docs/backlog.md` (сайтовый) с датой.
2. При варианте (б): ни одна RU-статья не ссылается `hreflang="en"` на несуществующий адрес; `/en/writing/` не в `sitemap`.
3. При варианте (а): `ls src/content/posts-en/*.md | wc -l` ≥ 10 и EN-индекс не пуст.
**Проверка:** `python3 -c` сверка `hreflang`-целей против `dist/` (174/174 сегодня) + `bun run test:built`.
**Исполнитель:** @astro-i18n-content-collections. **Снятие раздела — удаление: только после решения человека.**

### REQ-008 — `h2` не крупнее `h1` (P3, Med, S)

**Находка:** Упаковка · нарушена визуальная иерархия заголовков на всех широких экранах.
**Доказательство:** `src/styles/global.css:126` (`--type-section-h2: clamp(1.9rem, 2.3vw, 2.4rem)`) против `src/styles/blog.css:4-6` (`.page-title { font-size: 2rem }`) → с ~1391px секционный заголовок больше заголовка страницы; `src/components/ReadingBlock.astro:106` оформляет `h1` секционным токеном; 8 разных правил `h1 {`.
**Проблема:** `h2` не может быть крупнее `h1` — это ломает чтение с первого взгляда и противоречит самой шкале, которую задаёт `DESIGN.md`.
**Требуется:** у шкалы заголовков страницы есть предел снизу, который всегда выше верхнего предела секционного токена; `/library/` не использует секционный токен для `h1`; набор правил `h1` сведён к явным уровням.
**Acceptance criteria:**
1. Новый `tests/lib/typography-scale.test.ts` сравнивает `.page-title` и верхнюю границу `--type-section-h2` и зелёный.
2. На 1440px computed `font-size` `h1` ≥ `h2` на `/`, `/about/`, `/projects/`, `/writing/`, `/library/`.
3. Число различных правил `h1 {` уменьшено и зафиксировано тестом (реестр уровней в `DESIGN.md`).
**Проверка:** `bun test tests/lib` + `bun run build` и замер на built-страницах.
**Исполнитель:** @design-system.

### REQ-009 — Один рецепт акцентной полосы (P3, Low, S)

**Находка:** Упаковка · «одна семья, объявленная один раз» (DESIGN.md) нарушена трижды.
**Доказательство:** токен `src/styles/global.css:167`; инлайновые копии `src/styles/global.css:1701`, `src/styles/blog.css:102`, `src/components/AboutPage.astro:94`. (Скелетон `src/styles/global.css:2472` — другой рецепт, не в счёт.)
**Проблема:** три копии расходятся при первой же правке акцента; тест `tests/lib/gradient-tokens.test.ts` их не видит, потому что читает только объявления токенов.
**Требуется:** полоса берётся из одного источника (токен или общий класс), компонентные копии удалены.
**Acceptance criteria:**
1. `grep -rn "90deg" src/styles src/components` не находит копий акцентной полосы (кроме токена и скелетона).
2. `bun test tests/lib` зелёный.
3. Визуальная проверка трёх поверхностей (`/projects/`, `/writing/`, `/about/`) в трёх темах.
**Проверка:** `grep` + `bun test tests/lib`.
**Исполнитель:** @design-system.

### REQ-010 — Полоса букв словаря без гомоглифов (P3, Low, S)

**Находка:** Flags · кириллица и латиница в одном ряду дают визуальные дубли.
**Доказательство:** `src/components/GlossaryFilter.astro:135` (`CYRILLIC + LATIN`).
**Проблема:** `А/A`, `В/B`, `К/K`, `М/M`, `Р/P`, `С/C` выглядят одинаково; читатель не понимает, почему буквы «повторяются», и может нажать не ту.
**Требуется:** два алфавита визуально разделены (подпись группы или разделитель), либо латинский диапазон показывается по требованию.
**Acceptance criteria:**
1. Полоса читается как два набора, а не как дубли.
2. Клик по каждой букве фильтрует ожидаемые термины (проверка на 5 буквах, включая пару-гомоглиф).
3. Скриншот RU-словаря на 1440px и 390px.
**Проверка:** ручная проверка кликов + `bun run build`.
**Исполнитель:** @design-system.

### REQ-011 — Перф-хвосты (P4, Low, M)

**Находка:** Упаковка · одна страница ломает бюджет, ещё одна близка к порогу.
**Доказательство:** `lhci-reports/localhost-repo_audit_-2026_10_13_23_35_33.report.json` (perf 51, TBT 1 650 ms, LCP 4.1 s); сводка по 16 URL: `/en/` LCP 3.2 s.
**Проблема:** `/repo-audit/` стоит в навигации рядом с «Проекты» и открывается мгновенно, но грузится 5.9 s до интерактивности.
**Требуется:** TBT `/repo-audit/` < 300 ms либо страница уходит из основной навигации; `/en/` LCP ≤ 2.5 s.
**Acceptance criteria:**
1. Перезамер `npx lhci autorun` по `.lighthouserc.json` даёт TBT < 300 ms на `/repo-audit/`.
2. `/en/` LCP ≤ 2.5 s в том же прогоне.
3. `categories:accessibility` остаётся 1.0 (гейт в `.lighthouserc.json` не ослаблен).
**Проверка:** `bun run build && bun run serve-dist` + `npx lhci autorun`.
**Исполнитель:** @performance-optimization.

### REQ-012 — `lastmod` и `Article.image` (P3, Low, S)

**Находка:** Упаковка · свежесть и rich-result разметка неполны.
**Доказательство:** `astro.config.mjs:62-69` — `CONTENT_SOURCES` без `library`, `volta-parts`, `topics`; подсчёт: 86 из 210 URL без `lastmod` (46 — модули Volta); `src/pages/projects/[slug].astro:116-122` — `Article` без `image` (44 узла).
**Проблема:** у самых специфичных страниц нет сигнала свежести, а разметка `Article` не даёт eligibility для rich result — при том что `og:image` у каждой страницы есть.
**Требуется:** `lastmod` покрывает все контентные семейства (или отсутствует осознанно и документированно); `Article.image` заполнен существующим `ogImage`.
**Acceptance criteria:**
1. `grep -c '<lastmod>' dist/sitemap-0.xml` = `grep -c '<loc>'` (либо остаток объяснён в `docs/backlog.md`).
2. Ни один `Article` не пуст по `image`; значение резолвится в существующий файл.
3. Мутация: удаление `date` из одного `volta-part` не роняет сборку.
**Проверка:** `bun run build` + подсчёт по `dist/sitemap-0.xml` и `dist/projects/*/index.html`.
**Исполнитель:** @seo.

## Вне объёма

- **Реестровое правило «private + on_site без `ack`»** (B22) — это правило `registry.yaml`/`check_registry.py`, не поверхность сайта. REQ-001 чинит симптом на сайте, не правило.
- **Устаревшие счётчики README** (B43) и **устаревшие числа в доктрине сайта** (B46: `docs/prd-v9.md:160`, `docs/prd-projects-category-view.md:67`, `docs/prd.md:108`) — уже заведены в `reports/loop/BACKLOG.md`, второй список не заводим.
- **Нарратив-ниты конкретных кейсов** (B42) — REQ-003 даёт *механизм*; сами числа правятся по B42.
- **Коллизия нумерации ADR** (B34) и **черновые `.mjs` в `scripts/`** (B16) — доктрина/удаление, HUMAN.
- **Глубина самих кейсов** (B21 `tableau`, B24 `volta` сток/поток, B38 `posthog` знаменатель, B57 `rag` вырожденные метрики) — это члены, а не сайт.
- **Тонкости «упаковки» кейсов вне измеренного**: не трогаем то, что не подтверждено замером.

## HUMAN-гейты (нужен человек)

| # | Что | Почему нельзя автономно |
|---|---|---|
| 1 | Решение по EN-двойнику, если это **снятие** `/en/writing/` (REQ-007) | удаление раздела и правка `hreflang`-пар |
| 2 | Устаревшие числа в доктрине сайта (B46) | правка `docs/prd-v9.md` и родственных PRD — доктрина |
| 3 | Коллизия нумерации ADR (B34) | правка `docs/adr/**` — доктрина |
| 4 | Удаление черновых `scripts/.measure-fixes.mjs`, `.verify-projects.mjs` (B16) | удаление файлов |
| 5 | `git push` | никогда не делается агентом |

## Риски

- **Гонка с параллельным сеансом.** В `reports/loop/BACKLOG.md` уже зафиксирован случай двух сеансов, дважды занявших ID `B17–B25`. Смягчение: этот PRD — **единственный новый файл**, общие файлы (`BACKLOG.md`, `registry.yaml`) не трогаются; при заведении REQ в BACKLOG нумерация берётся с диска перед записью.
- **REQ-002/REQ-012 могут дать красный гейт на существующем дрейфе.** Смягчение: сначала прогнать `bun run audit:content` и `bun run audit:content:snapshot` — если дрейф уже есть, это находка правды №1 (правится до включения гейта).
- **REQ-008 меняет шкалу на всех страницах.** Смягчение: static-тест + визуальная проверка 5 страниц × 3 темы до включения.
- **REQ-001 меняет маркетинговую поверхность** (ссылка исчезает с 4 кейсов). Смягчение: поле `github:` остаётся в данных, ссылку можно вернуть одной строкой после снятия приватности.
- **LHCI-замеры в отчётах от 2026-10-13** — baseline может быть устаревшим. Смягчение: REQ-011 начинается с перезамера, а не с правки.

## Handoff

- **Исполнение:** `@portfolio-cycle-run` (по одной оси за цикл, cap 3 пункта) либо `@prd-taskmaster` для разбиения REQ на задачи. REQ-001 и REQ-002 — первые два, они обе оси «Правда».
- **Перепроверка результата:** `bash /Users/nikitaboarkin/Desktop/00\ ide/00\ portfolio/scripts/preflight.sh` (должен остаться OK) + `make check` в члене + `bash scripts/check_site.py`.
- **Запись в бэклог:** после приёмки REQ завести строками в `reports/loop/BACKLOG.md` с доказательством `file:line` и ID, взятым с диска.
