# Аудит слепых зон и точек роста — 2026-10-25

Метод: фан-аут из 4 агентов по независимым осям (продукт/рост, код/архитектура, контент/SEO/GEO, эксплуатация/безопасность) + проверка ключевых находок владельцем на диске. Правок не вносилось — это только аудит и бэклог.

**Шкала:** P0 — блокирует North Star или ломает живой путь; P1 — измеримый тормоз конверсии/доверия/обнаружимости; P2 — гигиена.
**Доказательность:** V — наблюдал в коде/собранном `dist/`; I — вывод из проверенных фактов; NV — проверить не удалось (причина указана). Колонка «Я» — независимо перепроверено владельцем сессии.

---

## 0. Главный вывод

Три находки складываются в один диагноз: **сайт хорошо сделан, но им почти не пользуются, и он не измеряет то, ради чего существует.**

- трафик — **5–27 уникальных посетителей в неделю** (собственный 90-дневный HogQL владельца, `docs/analytics-dead-events.md:23`);
- North Star (20 заявок / 10 разговоров) при таком трафике **арифметически недостижим**;
- у North Star **нет инструмента**: `docs/contact-log.md` отсутствует, а прокси-метрика (CTR резюме) потеряла эмиттер вместе с удалением CV;
- первый экран — личная «новая вкладка», а не питч найма.

Всё остальное (46 Article без `image`, дубли RU/EN, мёртвые компоненты) — реальные дефекты, но они вторичны: при 6 посетителях `/contact` за квартал ни один из них не двигает гейт. **Ограничение — привлечение, а не конверсия на странице.**

---

## 1. P0

| ID | Ось | Находка | file:line | Что ломается | Док. | Я |
|---|---|---|---|---|---|---|
| G1 | продукт | Гейт недостижим при текущем трафике: 5–27 уник./нед, 6 юзеров на `/contact` за 90 дней, 0 кликов на контакты | `docs/analytics-dead-events.md:23,34` | Любая работа над CTA не даёт результата; узкое место — привлечение | I | — |
| G2 | продукт | У North Star нет инструмента: `docs/contact-log.md` не существует, прокси-эмиттер резюме удалён | `docs/prd-v8.md:219,225,276`; `docs/cta-inventory.md:141` | Гейт нельзя оценить — итерации без обратной связи | V | V |
| G3 | продукт | Главная не проходит собственный 5-секундный тест PRD: часы, дата, поиск, шесть ярлыков; h1 = «Никита Бояркин — Продуктовый аналитик», ни грейда, ни цифры, ни CTA | `src/components/HomeNewTab.astro:92`; `src/pages/index.astro:58`; `docs/prd-v8.md:111` | Рекрутёр с LinkedIn попадает на личную страницу вместо питча | V | V |
| G4 | продукт | Заявлена завершённая аспирантура/PhD (2022–2025) в копии и в `alumniOf`, при незавершённой диссертации ВАК 5.3.3 | `src/components/CareerSnapshot.astro:53`; `src/content/about/ru.mdx:37`; `src/pages/about.astro:43` | Проверка одного завышенного факта обесценивает все остальные цифры портфолио | I | V (файлы; статус диссертации — на владельце) |
| G5 | эксплуатация | Уведомление о провале Lighthouse не может сработать: job требует `workflow_run.event == 'push'`, а сам Lighthouse запущен по `workflow_run` | `.github/workflows/ci-failure-notify.yml:32-35` | Регресс a11y/best-practices/SEO живёт на проде бесконечно | V | V |
| G6 | SEO | 46 `Article` (23 RU + 23 EN) без обязательного `image`, хотя `ogImage` есть во frontmatter каждой карточки | `src/pages/projects/[slug].astro:129-146`; `src/pages/en/projects/[slug].astro:134-151` | Ни один кейс не получает article rich result | V | V |
| G7 | эксплуатация | В job с `pages: write` + `id-token: write` исполняется непиннутый PyPI-код (`uv run --with pandas`, `dbt-charts==0.9.1` без hash), токен лежит в `.git/config` | `.github/workflows/deploy.yml:10-13,36,144,161` | Компрометация зависимости = push в Pages-бранч или минтинг OIDC-токена | V | — |

---

## 2. P1

### Продукт и конверсия

| ID | Находка | file:line | Влияние | Док. |
|---|---|---|---|---|
| G8 | Ни на одном лендинге и ни в одном кейсе нет следующего шага: ровно две ссылки на `/contact` (ящик + футер), на `/hr/` — под 23 карточками | `src/components/RoleLanding.astro:194`; `src/layouts/Base.astro:597` | Просьба появляется в момент минимального намерения | V |
| G9 | Обе точки входа в контакт (ящик и футер) без `data-analytics` | `src/layouts/Base.astro:535,599` | Шаг «страница → контакт» нельзя приписать странице/проекту | V (я) |
| G10 | Форма на проде выключена (`PROJECT_REF` не подставлен), email-адреса нет нигде в `src/`/`public/` | `src/lib/contact.ts:13,24`; `src/pages/contact.astro:21` | У корпоративного рекрутёра нет пути «отправить заявку/резюме» | V |
| G11 | `persona_gate_view` мёртв: `HeroGate`/`PersonaCanvas` не импортируются, а событие объявлено и проверяется тестом по несмонтированному компоненту | `src/pages/index.astro:58`; `src/components/HeroGate.astro:171`; `tests/lib/persona.test.ts:167` | Механизм «зелёный», утверждение ложно — дыру никто не видит | V |
| G12 | Бронирование не наблюдаемо: `booking_click` — клик в новую вкладку без возврата и колбэка успеха | `src/pages/contact.astro:34`; `src/lib/analytics.ts:67` | Завершённая бронь и отказ — одна и та же точка данных | V |
| G13 | Грейд и «открыт к предложениям» живут во вкладке `now`, а `/about` открывается на `profile` без призыва | `src/content/about/ru.mdx:26,64` | Рекрутёр с сниппета не узнаёт о доступности | V |
| G14 | EN-трек упирается в тупик: `/en/topics` и `/en/notes` нет, но строка «Topics» в EN-ящике ведёт на RU `/topics/` без переключателя языка | `src/layouts/Base.astro:117,532`; `src/pages/topics/index.astro:30` | Нерусский найминг-менеджер теряет английский сайт без пути назад | V |

### Код и архитектура

| ID | Находка | file:line | Влияние | Док. |
|---|---|---|---|---|
| G15 | RU/EN — копипаст-близнецы: 1384 идентичные строки в 17 парах, 74–91% у восьми крупнейших шаблонов; дрейф уже случился (EN volta-part без `@graph`/breadcrumb, EN project без `ogImage`) | `src/pages/en/projects/volta/[part].astro:57-68` vs `src/pages/projects/volta/[part].astro:60-84` | Каждый фикс надо писать дважды; второй близнец молча отстаёт | V |
| G16 | EN-посты молча теряют кросс-локальные `related`: выборка строится только по `posts-en`+`projects-en` | `src/pages/en/posts/[slug].astro:25-33` | В `dist/` уже: 1 из 3 и 2 из 5 ссылок выпали, ни warning, ни теста | V (я) |
| G17 | Тесты пинят несмонтированные компоненты (см. G11 + `card-recipe`, `body-type-scale`) — зелёные независимо от живого поведения | `tests/lib/persona.test.ts:167,212-237`; `tests/lib/card-recipe.test.ts:29` | Контракт персоны может сломаться внутри `HomeNewTab` — никто не узнает | V (я) |
| G18 | `ProjectGraph.astro` — 458 строк собственного клиентского графа (force, drag, tooltip), дублирует уже протестированные `graph-physics.ts`/`graph-tooltip.ts`, тестов ноль | `src/components/ProjectGraph.astro:103-537` | «Карта связей» на каждом проекте и термине ломается при зелёном сьюте | V |
| G19 | Граница билд→клиент — нешипованный JSON: `JSON.parse` = `any`, оба компонента индексируют поля позиционно | `src/components/KnowledgeGraph.astro:426,485-493`; `src/components/ProjectGraph.astro:119,129-131` | Переименование поля в типизированном билдере компилируется; клиент читает `undefined` | V |
| G20 | SSR пропускает ребро с неразрешённым концом, клиент парит рёбра к `links[i]` по индексу | `src/components/KnowledgeGraph.astro:315` vs `:493,603,1000` | Одно пропущенное ребро сдвигает цвет, хит-зону и физику всех последующих | V |
| G21 | Explorer превращает любой сбой сборки индекса в пустой хаб; теста на собранную страницу нет | `src/pages/explorer.astro:25-30`; `src/pages/en/explorer.astro:20-27` | Пустой Explorer уезжает на прод зелёным, сигнал — только `console.error` в логе сборки | V |

### Контент, SEO, GEO

| ID | Находка | file:line / URL | Влияние | Док. |
|---|---|---|---|---|
| G22 | `/` и `/en/` отдают клиентский «new tab»: 64–69 слов краулеру, 0 упоминаний «Volta»/метрик | `src/pages/index.astro:46-53`; `dist/index.html` | Googlebot-first-pass и все разрешённые AI-краулеры видят имя и меню | V (я) |
| G23 | 24 `/demos/*` индексируемы, но без canonical, 23 без description, текст 22–684 слова | `public/demos/*/index.html` | Тонкий кластер, при этом исключён из sitemap | V |
| G24 | 45 страниц с одинаковым `<title>`: все 23 пары проектов, 6 пар глоссария, `/en/` vs `/en/colleague/`, `/glossary/segmentation/` vs `/topics/segmentation/` | `dist/projects/volta/index.html` + `dist/en/projects/volta/index.html` | SERP не различает RU/EN-дубли | V |
| G25 | Четыре `Person` с конфликтующими `jobTitle`/`image`/`sameAs`, `@id` есть только у одного | `src/pages/index.astro:16-37`; `src/pages/about.astro:16-22`; `src/layouts/Base.astro:247-269` | Разрешение сущности в AI-ответах по имени — ненадёжно | V |
| G26 | `publisher.logo` = `favicon.svg` (707 Б, вектор), Google требует растровый логотип | `src/layouts/Post.astro:54-58`; `src/pages/projects/[slug].astro:138-142` | Комментарий в коде обещает rich results, которые ассет не может дать | V (я) |

### Эксплуатация

| ID | Находка | file:line | Влияние | Док. |
|---|---|---|---|---|
| G27 | Два sibling-репо чекаутятся по плавающему HEAD, без `ref:`; от их коммитов зависят вердикт `make check` и содержимое демо | `.github/workflows/deploy.yml:41-55`; `tests/lib/metrics.test.ts:32,45-47` | Чужой пуш в `sql-analytics-case-study` роняет деплой; пуш в `volta-banking` молча меняет прод | V |
| G28 | Ежедневный refresh GitHub-активности коммитит с `[skip ci]`, деплой триггерится только на `push` | `.github/workflows/github-activity.yml:55-58`; `deploy.yml:4-5` | Цифры на сайте замирают, JSON в репо свежий — расходятся молча | I |
| G29 | Прод никто не наблюдает: LHCI аудитит локальный артефакт на `localhost:4321`, у Prometheus нет `rule_files`, Alertmanager отсутствует | `.lighthouserc.json:6-25`; `monitoring/prometheus/prometheus.yml:1-13` | Падение сайта или формы видит только человек | V |
| G30 | `make check` не воспроизводим с чистого клона: drift-гард жёстко падает без `vendor/sql-analytics-case-study` | `Makefile:12-17`; `tests/lib/metrics.test.ts:34` | «Единый гейт» зелёный только на машине владельца и в его деплое | V |

---

## 3. P2 (сжато)

| ID | Находка | file:line | Док. |
|---|---|---|---|
| G31 | 8 компонентов (1401 строка) не смонтированы: `HeroGate`, `PersonaCanvas`, `ProofBand`, `HeroMetrics`, `LinkedInBadge`, `DashboardGrid/Card/Metrics` | `src/components/*` | V (я) |
| G32 | `global.css` (4775 строк) несёт правила и specificity-хаки под снятые компоненты | `src/styles/global.css:4376-4430,1680-1720` | V |
| G33 | `buildGraph` (с Louvain) вызывается на каждой странице проекта/термина → ~100 раз за сборку; force-layout без мемоизации | `src/lib/graph.ts:774`; `src/lib/graph-layout.ts:103`; `src/pages/projects/[slug].astro:75` | V |
| G34 | `/repo-audit/` под `noindex` стоит в навигации всех страниц | `src/layouts/Base.astro:220-224` | V |
| G35 | `llms.txt` не содержит `/hr/`, `/manager/`, `/colleague/`, `/contact/`; блurb'ы обрезаны посреди слова | `src/lib/llms-txt.ts:75-84,118-126` | V |
| G36 | 13 из 24 постов с одной датой `2026-08-27`, в RU-интерфейсе английский формат даты | `src/content/posts/*.md`; `dist/writing/index.html` | V |
| G37 | Allow-list 14 AI-краулеров в `robots.txt` без поведенческого эффекта (уже `User-agent: *`), список устарел | `src/pages/robots.txt.ts:8-24` | V/I |
| G38 | Нет мониторинга уязвимостей: ни `dependabot.yml`, ни Renovate, ни `bun audit` при ~450 записях в lockfile | `.github/`; `bun.lock` | V |
| G39 | `PUBLIC_BEACON_ENDPOINT` без билд-гарда: пропал — телеметрия исчезает молча (PostHog защищён в `check_site.py`) | `src/components/BeaconMetrics.astro:2-4`; `scripts/check_site.py:242-275` | V |
| G40 | В репо лежат 71 МБ скриншотов `reports/`, локальный лог гейта с `/tmp`-путями, 29.5 МБ блоб в истории (`.git` = 192 МБ) | `reports/`; `.ds-receipts/local.jsonl` | V |
| G41 | Образы мониторинга не пиннуты (`cloudflared:latest`, `oven/bun:1.4-alpine`) | `monitoring/docker-compose.yml:36`; `monitoring/exporter/Dockerfile:1` | V |
| G42 | Ссылка брони `cal.com/lofinibo/bored-call-me` жива, а `docs/cta-inventory.md` документирует мёртвый `30min` | `src/lib/contact.ts:16`; `docs/cta-inventory.md:155` | V |
| G43 | `ProjectGraph`/`KnowledgeGraph`: размер шрифта метки объявлен трижды при комментарии «не переобъявляется» | `src/components/KnowledgeGraph.astro:92,454,1906` | V |
| G44 | Homepage `Person` JSON-LD хардкодит URL сайта, RU и EN — по-разному | `src/pages/index.astro:14,21`; `src/pages/en/index.astro:21` | V |
| G45 | `/topics/` без `BreadcrumbList`; `/writing/2/`,`/3/` делят description с первой страницей; `CollectionPage` без крошек | `dist/topics/index.html`; `dist/writing/{2,3}/index.html` | V |
| G46 | PR из форка не может пройти сборку: шаг PostHog-дрейфа падает на пустом секрете | `.github/workflows/deploy.yml:93-102` | V/I |

---

## 4. Что НЕ является находкой

- **32 «мёртвых» аналитических события** — следствие трафика, а не баги. Разбор по локациям уже сделан владельцем: `docs/analytics-dead-events.md`. Не чинить.
- **24 OG-PNG и отсутствие `.webp` для OG** — осознанно отложено (память проекта, 2026-10-18).
- **`uses-responsive-images` в Lighthouse** — сознательно не в списке ассертов.

---

## 5. Бэклог по рычагу (без правок)

| Порядок | Что | Почему сейчас |
|---|---|---|
| 1 | Инструмент North Star: журнал контактов + эмиттер прокси | Без числа нет петли; G2 |
| 2 | Привлечение (LinkedIn/рассылка/репост) — не код сайта | Гейт недостижим при 5–27 визитах; G1 |
| 3 | Первый экран → питч (грейд, цифра, CTA) + SSR-текст | Самый трафиковый вход; G3, G22 |
| 4 | Статус PhD: подтвердить или переформулировать | Доверие ко всему портфолио; G4 |
| 5 | Следующий шаг после кейса + `data-analytics` на контактных входах | Дёшево, чинит измеримость; G8, G9 |
| 6 | `image` в Article + растровый `publisher.logo` | Rich results, 46 нод; G6, G26 |
| 7 | Уведомления Lighthouse (`event == 'push'` → убрать фильтр для Lighthouse) | Гейт, который не гейтит; G5 |
| 8 | Пиннинг sibling-репо и PyPI в деплое | Прод-риск; G7, G27 |
| 9 | Мёртвые компоненты и тесты: удалить или вернуть в монтаж | Ложная зелень; G11, G17, G31 |
| 10 | Дедуп RU/EN-шаблонов | Тормоз всех будущих фиксов; G15 |

---

## 6. PENDING (нужно от владельца)

- Статус диссертации: защищена или в работе (влияет на G4).
- Доступ к `NikitaBoyarkin/portfolio-contact-backend`: rate-limit, CORS, RLS — не проверялись (G10, OPS-07).
- Живой прод-замер: Lighthouse против задеплоенного домена не запускался (только `dist/`).
- Трафиковые цифры взяты из собственного отчёта владельца, не перезапрошены у PostHog.
