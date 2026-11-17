# PRD — Обратная связь 360 (HR / менеджер / коллега)

> Фича-уровень. Растёт из вопроса «как я могу быть полезен как продуктовый аналитик»:
> нужен прямой канал от тех, кто со мной работал, а не догадки из откликов на вакансии.
> Дата: 2026-11-17. Автор: Никита Бояркин.
> Статус: **дизайн прошёл builder-check, ждёт утверждения.** Код не начат.
> Решения владельца 2026-11-17: таблицы — в существующем проекте
> `geojpakugqlcwyhtnjvv`; ссылка на открытую форму — только с `/hire/`.

---

## 1. Зачем

**Intent.** Дать HR, менеджерам и коллегам короткий путь оставить структурированный
отзыв о том, где я полезен и где создаю трение, — и получать его в виде, пригодном
для решения «какие навыки качать и какие задачи брать».

**Что это не так.** Это не сбор отзывов для публикации на сайте, не замена контактной
форме и не конструктор опросников. Публичного показа ответов в MVP нет: анонимность —
условие честного сигнала, публичность — отдельная фича с отдельным согласием.

**Почему сайт.** Отклик приходит человеку по ссылке в переписке; страница на своём
домене не требует аккаунта, не тянет внешний JS и работает без JavaScript.

## 2. Цели / не-цели / анти-цели

| | |
|---|---|
| **Цели** | 10+ содержательных ответов за 6 недель; видно разрез по роли (`hr`/`manager`/`colleague`) и источнику (`open`/`invited`); ответы выгружаются в файл без ручного копирования; форма работает без JS |
| **Не-цели (MVP)** | конструктор вопросов; публичный показ цитат; реакционные задачи; аккаунты исследователя; ветвление по ответам |
| **Анти-цели** | собирать имена/почты по умолчанию; идентифицировать автора анонимного ответа; позволять браузеру читать таблицы; зависеть от внешнего JS; пускать токен приглашения в аналитику |

## 3. Ограничения

- Сайт — Astro static + GitHub Pages, `output: 'static'`. Серверной логики в сайте нет,
  rewrites на GitHub Pages нет: любой неизвестный путь отдаёт `404.html`
  (`src/pages/404.astro`). Динамических маршрутов без `getStaticPaths()` быть не может.
- Supabase-проект сайта: `geojpakugqlcwyhtnjvv`. В этом репо уже живут
  `supabase/migrations/` и `supabase/functions/ingest/` — это **единственный in-repo
  шаблон Edge-функции**, тестов к ней и drift-теста лимитов. Контактная форма в этом репо
  не является рабочим образцом: её функция, миграция и тесты лежат в приватном
  `portfolio-contact-backend`, а `src/lib/contact.ts` до сих пор содержит плейсхолдер
  `PROJECT_REF` и `CONTACT_FORM_ENABLED === false`.
- Zero-JS политика: нативная `<form method="post">` + JS-усиление. Без JS форма должна
  отправляться и получать HTML-ответ.
- **Приватность.** Метки приглашённых (`label`) и свободный текст ответов — это PII.
  Границы: RLS вкл. + 0 политик (браузер не читает ничего), метки не покидают таблицу
  инвайтов, выгрузка идёт вне git-репо, токен в аналитику не попадает. Посылка «PII нет»
  неверна и в обосновании не используется: ответы по определению содержат чужие слова.
- Соль `ip_hash` — **отдельная** от `IP_SALT` у `ingest`, иначе ответы склеиваются с
  `analytics_events` по `ip_hash` и анонимность снимается.
- Деплой функции, `db push` и `secrets set` — действия владельца.

## 4. Рассмотренные пути

| Путь | Что это | Почему нет |
|---|---|---|
| **A. Паттерн ingest (а не контактов)** | статичная страница + типизированный контракт вопросов + Edge Function + 2 таблицы + скрипты приглашений и выгрузки | **выбран**: минимальный объём, ноль новых зависимостей, in-repo шаблон и CI уже есть |
| B. Одна textarea в контактной форме | ноль кода | нет роли, нет `open`/`invited`, ответы несравнимы |
| C. Динамический конструктор из `site_content` + админка | редактирование вопросов, версии опросника | это и есть «Gorilla»: админ-авторизация, версии, UI — месяцы ради пяти вопросов. Фаза 2, если ответов станет много |

## 5. Архитектура (A)

```
браузер ──POST──> Edge Function feedback (verify_jwt = false; этот репо)
  /feedback/                    ├─ honeypot → тихий 200
  /feedback/?t=<token>&r=<role> ├─ валидация ключей и длин → 400
  FeedbackForm.astro            ├─ rate-limit ip_hash 10/час → 429
  + no-JS нативная post         ├─ token_hash → invite: role из инвайта, source=invited
                                ├─ insert (service_role)
                                └─ HTML-ответ при Accept: text/html
                                          │
                                          ▼
                        public.feedback_responses  (RLS on, 0 политик)
                        public.feedback_invites    (RLS on, 0 политик)
                                          │ service_role
                                          ▼
                  scripts/feedback-export.mjs → вне репо
                  scripts/feedback-invite.mjs → печатает персональные URL
```

### 5.1 Приглашение без динамического маршрута

Токен и роль едут **в query-параметрах**: `/feedback/?t=<token>&r=hr`. Статическая
страница их не видит на build-time, поэтому скрытые поля формы заполняет островной
скрипт, читая `location.search`. Роль в URL секретом не является — она и так видна
в приглашении.

**Деградация без JS:** токен и роль в форму не попадают. Функция записывает такой ответ
как `role = other`, `source = open`. Это осознанный потолок, а не баг: иначе пришлось бы
генерировать страницу под каждый инвайт на build и закоммитить токены в репо.

Токен в БД хранится **хешем** (`token_hash = sha256(token)`), в URL — сырым. Утечка
таблицы инвайтов не даёт рабочих ссылок.

### 5.2 Токен не попадает в аналитику

`src/components/Analytics.astro` инициализирует PostHog с `capture_pageview` и
`autocapture`; `$current_url` унёс бы `?t=…` в каждом просмотре. Поэтому в инициализацию
добавляется `sanitize_properties`: для любого свойства, содержащего `/feedback`, из URL
вырезаются параметры `t` и `r`. Событие `feedback_invite_opened` отправляется без токена —
только `{locale}`.

### 5.3 Ключевые решения

- **Токен — не аутентификация.** Он даёт роль, `source=invited` и мягкий лимит ответов.
- **Роль авторитетна из инвайта.** Если токен валиден — присланная форма роль игнорируется.
  На open-пути роль берётся из селекта.
- **Анонимность по умолчанию.** Подпись необязательна. В выгрузку не идут ни `label`,
  ни `ip_hash`, ни `invite_id`.
- **Ответы append-only.** Ни функция, ни скрипты не правят и не удаляют строки.
- **Вопросы — данные в коде, не в БД.** Один типизированный массив в `src/lib/feedback.ts`
  рендерится на сервере; EN — второй массив с теми же ключами.
- **Страница не индексируется**: `noindex, follow`, исключена из sitemap, в навигацию
  не входит; единственная ссылка — вторичная CTA на `/hire/`.

## 6. Контракт

### 6.1 Вопросы (RU; EN — те же ключи)

| key | вопрос | cap |
|---|---|---|
| `task` | С какой задачей вы бы позвали меня завтра? | 600 |
| `helps` | Что в моей работе помогает вам больше всего? | 600 |
| `friction` | Что мешает или вызывает трение? | 600 |
| `gap` | Чего мне не хватает как продуктовому аналитику? | 600 |
| `more` | Что-то ещё — необязательно | 1000 |

Обязательны первые четыре. Роль — `hr | manager | colleague | other`.

### 6.2 Таблицы

```sql
-- feedback_responses
id            uuid primary key default gen_random_uuid()
created_at    timestamptz not null default now()
role          text not null check (role in ('hr','manager','colleague','other'))
source        text not null check (source in ('open','invited'))
invite_id     uuid null references feedback_invites(id) on delete set null
answers       jsonb not null          -- {"task":"...","helps":"...","friction":"...","gap":"...","more":"..."}
signature     text null check (char_length(signature) <= 120)
locale        text not null check (locale in ('ru','en'))
ip_hash       text not null           -- sha256(ip + FEEDBACK_IP_SALT); сырой IP не хранится
-- CHECK (pg_column_size(answers) <= 8192); колонки user_agent нет намеренно

-- feedback_invites
id            uuid primary key default gen_random_uuid()
created_at    timestamptz not null default now()
token_hash    text not null unique    -- sha256(raw token); сырой токен в БД не хранится
role          text not null check (role in ('hr','manager','colleague','other'))
label         text not null           -- приватная метка: «Аня, Яндекс»; в выгрузку не идёт
max_responses int not null default 3 check (max_responses between 1 and 10)
active        bool not null default true
```

RLS on обеих, политик ноль. Индексы: `feedback_responses(created_at)`,
`(ip_hash, created_at)`, `feedback_invites(token_hash)`.

### 6.3 Функция `feedback`

- `supabase/config.toml`: блок `[functions.feedback]` с `verify_jwt = false` — без него
  флаг не применится.
- Скелет как у `ingest`: `payload.ts` (чистая нормализация и валидация) + `handler.ts` +
  `index.ts` + тесты рядом.
- **Два формата входа:** `application/json` (остров) и
  `application/x-www-form-urlencoded` (нативная отправка). Плоские имена полей:
  `role`, `q_task`, `q_helps`, `q_friction`, `q_gap`, `q_more`, `signature`, `locale`,
  `website`, `token`. Один нормализатор сводит оба к одной структуре.
- Ответы: 200 JSON `{ok:true}` / HTML при `Accept: text/html`; 400 с именем поля; 429.
- **Токен:** валиден и `active` → `role` из инвайта, `source=invited`, `invite_id`
  заполняется. Неизвестен или `active=false` → ответ принимается как `open`/`other`
  (не 400: пересланная старая ссылка не должна ломать честный отзыв). Валиден, но
  `max_responses` исчерпан → 429 с текстом «ссылка исчерпана, напишите напрямую».
- **Rate-limit:** 10 в час на `ip_hash`, оба источника вместе, счёт до вставки, при ошибке
  подсчёта — fail-open (как у контактов). Часовое окно без RPC и advisory lock: объём
  откликов мал, гонка принимается и записывается в риски.
- Соль: `FEEDBACK_IP_SALT` (отдельный секрет). Без него функция обязана падать явно,
  а не писать `ip_hash` от пустой соли.

### 6.4 Маршруты

| Путь | Что |
|---|---|
| `/feedback/`, `/en/feedback/` | открытая форма: селект роли, 5 полей |
| `/feedback/?t=<token>&r=<role>`, `/en/feedback/?t=<token>&r=<role>` | роль из инвайта, селект заменён подписью; оба параметра необязательны |

`noindex, follow` на всех `/feedback*`; `@astrojs/sitemap` — фильтр, исключающий
`/feedback` из `sitemap-index`.

### 6.5 Скрипты

- `scripts/feedback-invite.mjs` — `--role hr --label "Аня, Яндекс" [--count 1]`:
  генерирует токен, считает `token_hash`, пишет строку, печатает
  `https://nikitaboyarkin.github.io/feedback/?t=<token>&r=<role>`.
  `--dry-run` по умолчанию, `--apply` пишет.
- `scripts/feedback-export.mjs` — `--apply` обязателен для записи. Пишет JSON + CSV
  в `FEEDBACK_EXPORT_DIR` (по умолчанию `~/Desktop/00 ide/00 portfolio/_feedback-export/`,
  вне git-репо), имя `feedback-YYYY-MM-DD-HHMM.{json,csv}`, существующие файлы не трогает.
  **Колонки:** `id, created_at, role, source, locale, q_task, q_helps, q_friction, q_gap,
  q_more, signature`. Не выгружаются: `ip_hash`, `invite_id`, `label`.

## 7. Аналитика

Новые события в `src/lib/analytics.ts` (типы + `analytics-contract.test.ts`):

| Событие | Свойства |
|---|---|
| `feedback_page_view` | `{locale, source}` |
| `feedback_submit` | `{locale, source}` — роль берётся из БД, не из PostHog |
| `feedback_form_error` | `{locale, reason: validation\|rate_limited\|server\|network}` |
| `feedback_invite_opened` | `{locale}` — токена нет |

`role` намеренно не уходит в PostHog: `track()` дублирует события в
`analytics_events`, чьи разрешённые свойства заданы в `INGEST_PROPS`
(`supabase/functions/ingest/limits.ts`) и зеркалятся в `src/lib/ingest.ts`; добавление
роли туда — отдельная правка контракта, а нужный разрез и так есть в таблице ответов.
Содержимое ответов в аналитику не попадает никогда. Санитизация URL — §5.2.

## 8. Метрики

| Метрика | Источник | Порог |
|---|---|---|
| Ответов за 6 недель | `feedback_responses` | ≥ 10 |
| Разрез по ролям | таблица | все три роли ≥ 2 |
| Приглашённых → ответов | `invites` vs `responses.invite_id` | ≥ 50% |
| Открыл → отправил (только JS-посетители) | PostHog | ≥ 40% |

Последняя метрика видит только JS-посетителей: no-JS-открытия и отправки в PostHog не
попадают, поэтому она измеряет не всех. Абсолютный счёт ответов берётся из БД, не из PostHog.

## 9. Тесты и CI

| Файл | Что связывает |
|---|---|
| `tests/lib/feedback.test.ts` | 5 ключей, RU/EN совпадают по ключам, caps; `validateFeedback` зеркалит CHECK |
| `tests/built/feedback.test.ts` | 5 вопросов в HTML, `method="post"`, honeypot вне tab-порядка, `noindex`, отсутствие в sitemap, EN-близнец, `?t=` не рендерится на сервере |
| `supabase/functions/feedback/payload_test.ts` | пустой обязательный → 400; cap+1 → 400; неизвестный ключ → 400; urlencoded и JSON дают одинаковую структуру |
| `supabase/functions/feedback/limits_drift_test.ts` | caps в `src/lib/feedback.ts` == CHECK == функция (образец — `ingest/limits_drift_test.ts`) |
| `supabase/functions/feedback/migration_security_test.ts` | RLS on, 0 политик на обеих таблицах |
| `tests/lib/feedback-export.test.ts` | колонки выгрузки: нет `ip_hash`, `invite_id`, `label` |

**CI-правки без которых тесты — проза:**
`supabase/deno.json` → `test.include` += `"functions/feedback/"`;
`.github/workflows/supabase.yml` → `deno check functions/feedback/*.ts`.

## 10. Что НЕ делаем

Публичный показ отзывов и страницу «testimonials»; конструктор вопросов и админку;
Supabase Auth; капчу; ветвление; файлы в ответах; Telegram-пинг на каждый ответ;
динамический маршрут `/feedback/t/<token>` (на статике невозможен, см. §5.1).

## 11. Риски и потолки

| Риск | Последствие | Апгрейд когда |
|---|---|---|
| Без-JS приглашённый ответ пишется как `open`/`other` | разрез по ролям занижен | если такие ответы появятся — HTML-страница инвайта, отдаваемая функцией |
| Rate-limit 10/час по `ip_hash` | трое коллег из одного офиса (NAT) могут упереться на четвёртом-пятом | жалобы на 429 → лимит по токену для invited |
| Счёт лимита без advisory lock | гонка пропускает лишний ответ | если начнётся спам — RPC с блокировкой (образец `insert_analytics_events`) |
| Общая ссылка `/feedback/` может утечь в спам | ручная чистка таблицы | >10 спам-строк/нед → капча |
| Метка инвайта деанонимизирует при доступе к таблице | чтение только под `service_role`; в выгрузку не идёт | — |
| Общий `service_role` с аналитикой | утечка ключа открывает и отзывы | если отзывов станет много — отдельный проект |
| Текст ответа может содержать имена и компании | PII вне таблицы | выгрузка вне репо; публикация только с согласием |

## 12. Фазы

1. ~~**Схема и функция**~~ — готово: миграции, `[functions.feedback]`, `feedback` Edge Function, тесты.
2. ~~**Страница**~~ — готово: `src/lib/feedback.ts`, `FeedbackForm.astro`, RU/EN, query-токен, `noindex`.
3. ~~**Скрипты**~~ — готово: invite, export, тесты.
4. ~~**CI и аналитика**~~ — готово: `deno.json`, `supabase.yml`, события, санитизация URL, CTA на `/hire/`.
5. **Деплой (владелец)** — не сделано: `db push`, `secrets set FEEDBACK_IP_SALT`, `functions deploy`,
   первый smoke-ответ.

## 13. Что нужно от владельца

| # | Что | Блокирует |
|---|---|---|
| 1 | ~~Проект~~ — подтверждён: `geojpakugqlcwyhtnjvv` | — |
| 2 | `supabase secrets set FEEDBACK_IP_SALT=…` (новая соль, не `IP_SALT`) | запись ответов |
| 3 | `supabase db push` + `supabase functions deploy feedback` | работу формы |
| 4 | Тексты пяти вопросов (утвердить или переписать) | контент |
| 5 | Push — только после явного разрешения | прод |
