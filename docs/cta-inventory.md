# CTA-инвентарь (REQ-037)

Аудит всех контакт-CTA сайта: локация, текст, событие, целевой URL. Обновлять при добавлении/изменении CTA.

## Инвентарь

| # | Локация | Текст CTA | Событие PostHog | Целевой URL |
|---|---|---|---|---|
| 1 | Hero (index, RU+EN) | «С чего начать» / «Start here» (A/B: «Смотреть проекты» / «See my work») | `hero_cta_click` + `hero_cta_exposure` (variant) | `/start/` (A/B: `/projects/`) |
| 2 | Hero (index, RU+EN) | «CV» | `cv_download_pdf` | `CV-Nikita-Boyarkin.pdf` |
| 3 | Hero (index) | GitHub / LinkedIn | `github_hero` / `linkedin_hero` | внешние |
| 4 | Header nav | Telegram-иконка | `telegram_header` | `t.me/lofinibo` |
| 5 | Footer | GitHub · LinkedIn · Telegram · CV · Writing | `github_footer` / `linkedin_footer` / `telegram_footer` / `cv_download_pdf` / `writing_footer` | внешние + внутренние |
| 6 | HomeBoard (главная) | Telegram / GitHub / LinkedIn | `telegram_board` / `github_board` / `linkedin_board` | внешние |
| 7 | contact.astro | «Telegram: @lofinibo» | `telegram_contact` | `t.me/lofinibo` |
| 8 | contact.astro | «Написать с контекстом →» | `telegram_deeplink` | tg deep-link |
| 9 | contact.astro | «CV» | `cv_download_pdf` | `CV-Nikita-Boyarkin.pdf` |
| 10 | value.astro | «Написать в Telegram →» | `value_cta` | tg deep-link |
| 11 | value.astro | «GitHub →» | `value_github` | `github.com/NikitaBoyarkin` |
| 12 | about.astro (#work) | «Обсудить формат →» | `work_with_me_cta` | tg deep-link |
| 13 | about.astro (links footer) | «Написать в Telegram →» | `whois_cta` | tg deep-link |
| 14 | about.astro / value.astro / CareerSnapshot | «CV» | `cv_download_pdf` | `CV-Nikita-Boyarkin.pdf` |
| 15 | games (`/games/`) | LinkedIn / Telegram (contact-секция) | `contact_click` (channel) | внешние |
| 16 | AskMe (главная) | «Спросить» (открывает панель) | `ask_me_open` | — (панель) |
| 17 | SearchBox (header) | «Поиск» (открывает панель) | `search_open` | — (панель) |
| 18 | ProjectCard | «Смотреть» / «Demo» / «GitHub» | `project_view_<slug>` / `project_demo_<slug>` / `project_github_<slug>` | внутренние + внешние |
| 19 | HeadlineCases (главная, PRD v6 S2.6) | 3 кейса + сжатый список 14 | `headline_case_<slug>` / `headline_demo_<slug>` / `headline_github_<slug>` / `headline_all_projects` / `more_project_<slug>` | внутренние проекты + внешние артефакты |
| 20 | contact.astro (форма, RU+EN) | «Отправить» / «Send» | `contact_submit` (успех); `contact_form_error` с `reason` при отказе | `POST {CONTACT_ENDPOINT}` (Supabase Edge Function `contact`) |
| 21 | contact.astro (под формой, RU+EN) | «Записаться на 30 минут» / «Book 30 minutes» | `booking_click` | `CAL_BOOKING_URL` (Cal.com) |
| 22 | Header nav (Base.astro, RU+EN, под «Контакты») | «Записаться на 30 минут» / «Book 30 minutes» | `booking_click` | `CAL_BOOKING_URL` (`cal.com/lofinibo/30min`) |

Строки 21 и 22 намеренно делят одно событие `booking_click`: это два входа в одно
действие, а не два разных CTA. Разделять их — только через property (`location`),
если понадобится различать вклад рельса и страницы контактов.

## Гэпы, найденные аудитом

| Гэп | Статус |
|---|---|
| Hero-CTA «С чего начать» и «CV» не имели трекинга | ✅ закрыт 2026-09-09: `hero_cta_click`/`hero_cta_exposure` (A/B); CV-кнопка теперь трекается как `cv_download_pdf` (2026-09-19, была `hero_cv`) |
| Ссылки внутри панели AskMe не трекаются (только `ask_me_open`) | ⏳ опционально: `ask_me_link_<label>` |
| `start.astro` — удалён (S1.4); маршрутизация перенесена в jump-nav на `/about` | ✅ закрыт 2026-09-18 |

## A/B-тест главного CTA

**Флаг:** `hero_cta_variant` (PostHog, id 872930, client-side, 50/50).

| Вариант | Текст | Href | Гипотеза |
|---|---|---|---|
| `control` | «С чего начать» / «Start here» | `/start/` | статус-кво |
| `projects` | «Смотреть проекты» / «See my work» | `/projects/` | рекрутер хочет увидеть работу (доказательство), а не маршрутизатор → выше вход в фаннел главная→/projects/→контакт |

**События:** `hero_cta_exposure` (variant, 1/загрузку) — знаменатель; `hero_cta_click` (variant, path) — числитель. Метрика: CTR exposure→click; вторично — вход в фаннел «Рекрутер».

**Решение:** зафиксировать в PostHog (insight по `hero_cta_click` с breakdown по variant) после накопления ≥30 exposure на руку (~2–4 недели при текущем трафике). Победитель — по CTR с учётом SRM (проверка распределения exposure 50/50).

**Реализация:** `src/components/HeroCta.astro` (bundled script, `posthog.onFeatureFlags` → swap text/href, no-JS = control). Трекинг явный, без `data-analytics` (иначе двойной счёт через delegated capture в Analytics.astro).

## S1.2/S1.4 Consolidation mapping (2026-09-18)

The about-cluster (`whois`, `work-with-me`, `now`, `start`) collapsed into `/about` + `/value`.
Redirects in `astro.config.mjs`:

| Old route | Redirect target |
|---|---|
| `/whois/` | `/about/#who` |
| `/work-with-me/` | `/about/#work` |
| `/now/` | `/about/#now` |
| `/start/` | `/about/#start` |
| `/en/whois/` | `/en/about/#who` |
| `/en/work-with-me/` | `/en/about/#work` |
| `/en/start/` | `/en/about/#start` |

(`en/now.astro` never existed — no `/en/now/` redirect.)

**Analytics event preservation (G14 funnel):**

| Event | Old host | New host | Status |
|---|---|---|---|
| `whois_cta` | `whois.astro` (deleted) | `about.astro` links-footer CTA | preserved |
| `work_with_me_cta` | `work-with-me.astro` (deleted) | `about.astro` #work section CTA | preserved |
| `value_cta` | `value.astro` | `value.astro` (unchanged) | preserved |
| `value_github` | `value.astro` | `value.astro` (unchanged) | preserved |

No wired event was dropped. `start.astro` carried no `data-analytics` event, so its deletion
removes no funnel signal.

## CV unification (2026-09-19)

All CV entry points collapsed to a single "CV" button that downloads the PDF
(`CV-Nikita-Boyarkin.pdf`, sourced from the rendercv project `../cv`). Removed:

| Removed | Was |
|---|---|
| `/cv/` HTML page (`src/pages/cv.astro`) | standalone light-themed CV route |
| `hero_cv` | hero CV button (now `cv_download_pdf`) |
| `cv_footer` / `cv_pdf_footer` | footer `Резюме` + `PDF` links (now one `cv_download_pdf`) |
| `cv_source_github` | "Source (GitHub)" on the deleted CV page |

The `CV-Nikita-Boyarkin.pdf` `Disallow` in `robots.txt` is unchanged. Historical
rows for the removed events stay in PostHog.

## Форма связи + запись звонка (2026-09-26)

Основной путь контакта — форма на `/contact` и `/en/contact` (строки 20–21).
Telegram, LinkedIn и GitHub остались как вторичные опции в блоке «Другие способы связи»;
ни одна существующая ссылка не удалена.

| Что | Где | Значение |
|---|---|---|
| Endpoint формы | `src/lib/contact.ts` | `CONTACT_ENDPOINT` — **placeholder `PROJECT_REF`**, заменить в Phase 0 |
| Ссылка на звонок | `src/lib/contact.ts` | `CAL_BOOKING_URL` = `https://cal.com/lofinibo/30min` (заполнено 2026-09-26, был placeholder `USERNAME/15min`) |
| Лимиты полей | `src/lib/contact.ts` | `CONTACT_LIMITS` — зеркало CHECK-констрейнтов `contact_messages` |
| Honeypot | `src/components/ContactForm.astro` | поле `website`, off-screen (`position: absolute; left: -9999px`), `tabindex="-1"` |

Оставшийся placeholder — `CONTACT_ENDPOINT` (и он же константа, а не env-переменная:
отсутствующая в CI env-переменная падает **молча** — это уже случилось с
`PUBLIC_BEACON_ENDPOINT`, — а константа видна в ревью). `CAL_BOOKING_URL` закрыт.
Без JS форма отправляется нативно (`method="post"`), HTML-ответ отдаёт Edge Function.
