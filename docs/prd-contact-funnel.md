# PRD — Прямой контактный фаннел (форма + запись на 15 мин)

> Фича-уровень: **не** заменяет `prd-v8.md`, а исполняет его §3 (гейт аутрича) — гейт
> требует 10 разговоров, а «разговор» до сих пор нельзя было начать, не уйдя с сайта.
> Дата: 2026-09-26. Автор: Никита Бояркин.
> Статус: **код готов и проверен**, ждёт Phase 0 (задачи владельца, §6).

---

## 1. Проблема

`docs/cta-inventory.md` — 20 CTA, все ведут наружу (t.me, LinkedIn, GitHub, CV PDF).
Формы контакта на сайте нет вообще (`grep "<form" src/` → 0), почтового адреса тоже нет.

| Что не работает | Почему это дорого |
|---|---|
| **Фаннел `zlXsA98W` меряет не то** | Шаг «контакт» = клик по внешней ссылке. Клик ≠ контакт: человек открыл Telegram и не написал. North Star (контакты/мес) неотличима от «ушёл наружу» |
| **Порог входа высок** | «Написать и сформулировать» дороже, чем «выбрать слот». Вторая форма конверсии — отвал на самом дорогом шаге |
| **`contact-log.md` ведётся руками** | 7 колонок, placeholder в строке 54, инвариант «одна строка на переход стадии» держится только прозой |
| **Гейт v8 непроверяем** | «10 contact-строк, эскалированных в разговор» считается людьми, а не механизмом |

## 2. Решения владельца (2026-09-26)

| Решение | Выбор | Альтернатива и почему нет |
|---|---|---|
| Backend заявки | Supabase Edge Function + Postgres, **отдельный проект** | Formspree — чужой дата-процессор, нет SQL-доступа для синка |
| Проект создаёт | владелец в дашборде | CLI-создание требует PAT в терминале |
| Деплой функции | вручную `supabase functions deploy` | CI-деплой тянет supabase-cli в workflow ради одной функции |
| Запись на 15 мин | Cal.com **ссылкой** | Embed — внешний JS на сайте с zero-JS политикой |
| ПДн | строка-дисклеймер в форме | Страница `/privacy/` не делается (решение владельца) |
| `contact-log.md` | авто-синк скриптом | Ручное ведение — уже провалилось (лог пуст) |
| Пинг о заявке | новый Telegram-бот только под заявки | Личный бот смешает каналы |

## 3. Архитектура

```
браузер ──POST──> Edge Function (verify_jwt = false)
  ContactForm.astro         supabase/functions/contact/index.ts
  action = CONTACT_ENDPOINT  ├─ honeypot (website) → 200 fake-ok, тихо
  + fetch-энхансмент         ├─ валидация + caps      → 400
    инлайн «спасибо»         ├─ rate-limit по ip_hash → 429
                             ├─ insert (service_role)
                             └─ Telegram Bot API (fire-and-forget)
                                │
                                ▼
                    public.contact_messages (RLS вкл., 0 политик)
                                │ PostgREST + service_role
                                ▼
                  scripts/sync-contact-log.mjs --apply   (append-only)
                                ▼
                        docs/contact-log.md
```

**Ключевые решения и почему:**

- **Endpoint и Cal.com-URL — константы в `src/lib/contact.ts`, не env.** Оба публичны по
  определению. Env-вариант уже показал свой failure mode в этом репо: `PUBLIC_BEACON_ENDPOINT`
  есть в `BeaconMetrics.astro`, но отсутствует в `.env.example` и `deploy.yml` — в CI маяк молча
  выключен. Константа убивает этот класс ошибок и не требует ни одного нового секрета в CI.
- **`verify_jwt = false`.** Клиенту не нужен даже anon key. Граница безопасности — RLS, а не ключ:
  браузерный ключ всё равно уезжает в бандл в любой Supabase-аппке.
- **RLS включён, политик нет.** Ни `anon`, ни `authenticated` не могут вставить строку напрямую
  через PostgREST — пишет только функция под `service_role`. Это отсекает спам в обход honeypot.
- **ПДн минимизированы:** `ip_hash = sha256(ip + соль)`, сырой IP не хранится, `user_agent` не хранится.
- **No-JS работает.** Нативная `method="post"` + JS-энхансмент. Без JS функция отдаёт минимальный
  HTML, если `Accept: text/html`. Ноль внешнего JS, как и на остальном сайте.
- **Роль скрипта — только добавлять.** Существующие строки лога не перезаписываются и не удаляются:
  `screening`/`offer`, `evidence`, `next action` правятся руками и неприкосновенны.

## 4. Требования

| REQ | Требование | Где |
|---|---|---|
| REQ-C01 | Посетитель отправляет заявку, не покидая сайт | `ContactForm.astro`, `contact.astro`, `en/contact.astro` |
| REQ-C02 | Форма работает без JS (нативная отправка + HTML-ответ) | `ContactForm.astro`, `contact/index.ts` |
| REQ-C03 | Honeypot + length caps + rate-limit 3/10 мин по `ip_hash` | `contact/index.ts` |
| REQ-C04 | Заявка видна только через `service_role` (RLS on, 0 политик) | миграция |
| REQ-C05 | Пинг в отдельного Telegram-бота | `contact/index.ts` |
| REQ-C06 | `contact_submit` / `contact_form_error` / `booking_click` в PostHog | `analytics.ts`, `ContactForm.astro` |
| REQ-C07 | Запись на 15 мин отдельной CTA | `contact.astro` / `en/contact.astro` |
| REQ-C08 | Заявки попадают в `contact-log.md` без ручного ввода | `sync-contact-log.mjs`, workflow |
| REQ-C09 | Дисклеймер об обработке данных в форме, без ссылки на несуществующую страницу | обе страницы |

## 5. Что реализовано

| Файл | Что |
|---|---|
| `supabase/config.toml` | `[functions.contact] verify_jwt = false` |
| `supabase/migrations/20260926000000_contact_messages.sql` | таблица `contact_messages`, RLS on + 0 политик, `check`-констрейнты длин, индексы по `created_at` и `(ip_hash, created_at)` |
| `supabase/functions/contact/index.ts` | 205 строк: honeypot → тихий 200, валидация → 400, rate-limit → 429, insert → 502 при сбое, Telegram fire-and-forget, HTML/JSON по `Accept`, CORS на всех ответах |
| `src/lib/contact.ts` | `CONTACT_ENDPOINT`, `CAL_BOOKING_URL`, `CONTACT_LIMITS`, `validateContact()` |
| `src/components/ContactForm.astro` | остров: honeypot off-screen, `aria-live` ошибки, инлайн-успех, `track()` |
| `src/pages/contact.astro`, `src/pages/en/contact.astro` | форма primary, Telegram/LinkedIn вторичны, booking-CTA, ПДн-строка |
| `src/lib/analytics.ts` | +`contact_submit`, `contact_form_error`, `booking_click` |
| `docs/analytics-events.md`, `docs/cta-inventory.md` | события и CTA |
| `scripts/sync-contact-log.mjs` | append-only синк: `--dry-run` по умолчанию, `--apply` для записи |
| `.github/workflows/sync-contacts.yml` | cron 04:23 UTC + `workflow_dispatch`, `contents: write`, самовзводится при появлении секрета |
| `tests/lib/contact.test.ts`, `tests/lib/sync-contact-log.test.ts`, `tests/built/contact.test.ts` | 9 + 12 + 10 тестов |
| `package.json`, `.env.example`, `tsconfig.json` | `sync:contacts(:apply)`, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, exclude `supabase` |

### 5.1 Верификация

| Проверка | Результат | Класс |
|---|---|---|
| `bun run build` | 135 страниц | Verified |
| `bun run check` | 125 файлов, 0 ошибок | Verified |
| `bun test tests/lib` | 185 pass | Verified |
| `bun test tests:built` | 23 pass — форма, `method="post"`, `action`, honeypot, cal.com, отсутствие `/privacy/` | Verified |
| `python3 scripts/check_site.py` | all checks passed | Verified |
| Рантайм функции (`supabase functions serve`) | не запускался | **Not verified** — PostgREST-count и Telegram-пинг не исполнялись |

## 6. Phase 0 — что осталось (владелец)

- [ ] **1. Подставить константы** — `src/lib/contact.ts`, две строки с `TODO(Phase 0)`:
      `CONTACT_ENDPOINT` (`PROJECT_REF`) и `CAL_BOOKING_URL` (`USERNAME`).
      **Без этого форма смотрит в никуда — деплоить нельзя.**
- [ ] **2. Supabase-проект** под сайт → записать `ref`, URL, `service_role`.
- [ ] **3. Telegram-бот** (@BotFather) → токен; написать боту `/start`, чтобы у DM был chat id.
- [ ] **4. Задеплоить backend:**
      ```bash
      supabase link --project-ref <ref>
      supabase db push
      supabase secrets set TELEGRAM_BOT_TOKEN=… TELEGRAM_CHAT_ID=… IP_SALT=…
      supabase functions deploy contact
      ```
- [ ] **5. GitHub-секреты** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — включает cron синка.
- [ ] **6. PostHog:** в фаннеле `zlXsA98W` шаг 3 заменить click-out на `contact_submit` OR `booking_click`.

## 7. Приёмка

Реальная заявка с `/contact/`:

1. Инлайн «спасибо» без перезагрузки — и то же самое при выключенном JS.
2. Строка в Supabase Table Editor.
3. Пинг в Telegram.
4. `contact_submit` виден в PostHog Activity.
5. `bun run sync:contacts:apply` добавляет ровно одну строку в `docs/contact-log.md`.

Плюс негативные: пустое `message` → 400; заполненный honeypot → тихий 200 без строки;
4-я отправка за 10 минут с того же `ip_hash` → 429.

## 8. Метрики

| Метрика | Источник | Было → стало |
|---|---|---|
| North Star: контакты/мес | `contact-log.md`, строки `stage = contact` | клик → подтверждённая заявка |
| Конверсия страницы контактов | `contact_submit` / просмотры `/contact/` | не измерялась |
| Доля заявок через форму | `contact_submit` vs `telegram_contact` + `linkedin_*` | — |
| Booking-интерес | `booking_click` | — |
| Разрыв «заявка → первый ответ» | `created_at` vs `next action = reply`, снятый вручную | — |

## 9. Что НЕ делаем

`@astrojs/node` адаптер (сайт остаётся статикой), свой SMTP, капчу (honeypot + rate-limit
достаточно при текущем трафике), страницу `/privacy/`, правки `scripts/check_site.py`,
изменения делегированного хендлера в `Analytics.astro`.

## 10. Риски и известные потолки

| Потолок | Последствие | Апгрейд когда |
|---|---|---|
| Дедуп по 8 hex-символам id, записанным в `evidence` | Удалил строку руками → следующий синк вернёт её | Если лог начнут чистить вручную — state-файл с id |
| `segment` всегда `other` | Форма не знает целевой сегмент | Правится руками; при потоке — выпадающий список в форме |
| Rate-limit по `ip_hash`, fail-open при сбое подсчёта | Хиккап PostgREST пропускает лишнюю заявку | Осознанно: иначе сбойный lookup глотает реальное сообщение |
| `supabase` в `exclude` tsconfig | Функция не типизируется в CI (проверена отдельным `tsc --strict`) | При росте функции — отдельный `deno check` в workflow |
| Booking — ссылка, не embed | В PostHog виден только клик, не факт встречи | Если booking-конверсия станет метрикой — Cal.com webhook |
| Нет капчи | При целевом спаме — ручная чистка таблицы | При >10 спам-заявках/нед |

## 11. Что нужно от владельца

| # | Что | Блокирует |
|---|---|---|
| 1 | `ref` + URL + `service_role` Supabase-проекта | деплой функции, smoke-тест |
| 2 | Токен нового Telegram-бота + chat id | пинг (остальное работает) |
| 3 | Cal.com username | реальная ссылка вместо плейсхолдера |
| 4 | Подстановка обеих констант в `src/lib/contact.ts` | **работоспособность формы** |
| 5 | PostHog: шаг 3 фаннела `zlXsA98W` | корректность метрики |
| 6 | GitHub-секреты `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | синк лога |
| 7 | Push — только после явного разрешения | деплой в прод |
