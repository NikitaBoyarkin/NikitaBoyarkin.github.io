# LinkedIn Ads — кампания портфолио (v1)

Дата: 2026-10-26 · Статус: **draft, к запуску не готов** (см. §7)
Креативы: `outputs/2026-10-26/linkedin-ads.csv` (10 строк: 5 углов × RU/EN)
Грундинг цифр: `src/content/projects/volta.md`, `src/lib/projects.ts`, `src/lib/contact.ts`

## 1. Цель и метрика

Гипотеза: платный LinkedIn-трафик на роль-лендинги даёт **10 разговоров** (гейт PRD v8: 20 заявок ИЛИ 10 разговоров) при CPL ≤ `[CPL_TARGET]`.

| Метрика | Источник | Класс |
|---|---|---|
| Бронирования 30-мин | `cal.com/lofinibo/bored-call-me` (`src/lib/contact.ts:16`) | Verified (URL есть) |
| Разговоры | contact-log в приватном репо `portfolio-contact-backend` | Verified (механизм есть) |
| CTR / CPC / CPM | LinkedIn Campaign Manager | Verified после запуска |
| `contact_submit` | `src/lib/analytics.ts:58` | Blocked до Phase 0 формы |

Порог остановки цикла: CPL > `[2× CPL_TARGET]` на ≥1 000 показов/объявление.

## 2. Структура аккаунта

1 кампания = 1 сегмент. Внутри — 1 ad set на язык (RU / EN), 5 объявлений = 5 углов.

| Кампания | Лендинг | Углы (из CSV) | Аудитория |
|---|---|---|---|
| `hr-screening` | `/hr/`, `/en/hr/` | 1-pain, 5-cta | рекрутеры, HRBP |
| `manager-impact` | `/manager/`, `/en/manager/` | 2-proof, 3-contrarian, 5-cta | тимлиды и руководители аналитики |
| `colleague-method` | `/colleague/`, `/en/colleague/` | 4-method | продуктовые аналитики, data |

Логика сегментов не выдумана: сайт уже режет аудиторию на три роли — `src/pages/{hr,manager,colleague}/` + `ROLE_COPY` (`src/lib/projects.ts:156-203`). Комментарий `HeroGate.astro:148` прямо фиксирует: «traffic is analysts and engineers, LinkedIn is recruiters».

## 3. Настройки кампании

| Параметр | Значение | Причина |
|---|---|---|
| Objective | Website visits | конверсии в LinkedIn недоступны: Insight Tag не установлен |
| Bid | automated (max CPC `[BID]` при ручном) | нет исторических данных для ручной ставки |
| Budget | `[BUDGET_DAY]` / день на ad set | не судить до 1 000 показов |
| Placements | LinkedIn feed only, Audience Network **off** | сеть расширения размывает атрибуцию |
| Длительность цикла 1 | 14 дней | один цикл = одна переменная |
| Creative rotation | 5 объявлений на ad set | равные показы, решение по CTR |

После установки Insight Tag: objective → Website conversions, событие = `cal_click` (сейчас отсутствует).

## 4. Матрица таргетинга

Основной фасет — job titles; остальные сужают.

| Фасет | Значения | Проверить в UI |
|---|---|---|
| Job titles | «Продуктовый аналитик», «Аналитик продукта», «Руководитель отдела аналитики», «Тимлид аналитики», «Head of Analytics», «Product Analyst», «Data Analyst», «IT-рекрутер», «HR Business Partner» | точные написания в LinkedIn |
| Seniority | HR: Entry/Senior; Manager: Senior/Manager/Director; Colleague: Senior/Entry | да |
| Industry | IT Services and IT Consulting, Software Development, Financial Services, Banking | да |
| Company size | `[SIZE_RANGE]` (кандидат: 51–5 000) | да |
| Geography | `[GEO]` (кандидат: RU + релокация) | да |
| Skills | SQL, Python, A/B Testing, Product Analytics | да |
| Profile language | RU для RU-ad set, EN для EN-ad set | да |
| Exclusions | своя текущая компания; опционально — свои контакты (audience template) | да |

Правило: не таргетить по возрасту/полу — политика LinkedIn и здравый смысл.

## 5. UTM и атрибуция

Схема:
```
utm_source=linkedin&utm_medium=paid&utm_campaign={hr-screening|manager-impact|colleague-method}
&utm_content={1-pain|2-proof|3-contrarian|4-method|5-cta}&utm_term={ru|en}
```
Пример: `/manager/?utm_source=linkedin&utm_medium=paid&utm_campaign=manager-impact&utm_content=2-proof&utm_term=ru`

Состояние (проверено 2026-10-26):

| Что | Факт | Следствие |
|---|---|---|
| Сайт читает UTM | `grep -rn utm_source src` → 0 | UTM живут только в отчётах LinkedIn/Cal.com |
| `cal_click` | нет | клики по Cal.com не считаются — PENDING |
| Insight Tag | нет (`platform.linkedin.com` встречается только в `LinkedInBadge.astro`) | conversion tracking в LinkedIn выключен |
| `contact_submit` | есть код, форма инертна | до Phase 0 не сработает |
| PostHog | `PUBLIC_POSTHOG_KEY` в `.env.example:7` | база для событий есть |

## 6. Цикл 1 → цикл 2

- Цикл 1: 3 кампании × 2 языка × 5 объявлений; меняется только angle, intro/headline/description фиксированы.
- Победитель = угол с лучшим CTR при CPL в цели; в цикле 2 — 5 новых intro на том же headline.
- Проигравший угол не удалять сразу: минимум 1 000 показов до вердикта.
- Лог итераций — по шаблону навыка `ad-creative`, заполняется после первых данных.

## 7. Prerequisites — блокеры запуска

| # | Что | Статус | Владелец |
|---|---|---|---|
| 1 | LinkedIn Company Page (реклама идёт от страницы) | не проверено | владелец |
| 2 | Ad account + способ оплаты | нет данных | владелец |
| 3 | Phase 0 формы: `PROJECT_REF` | ❌ placeholder (`src/lib/contact.ts:13-24`) | владелец |
| 4 | Insight Tag | ❌ отсутствует | решение |
| 5 | Событие `cal_click` + захват UTM | ❌ отсутствует | решение |
| 6 | EN-событие Cal.com | ⏳ PENDING (E-батч: «Book 30 minutes» на `/en/` ведёт на RU-событие) | владелец |
| 7 | `CONTACT_LOG_TOKEN` (PAT, contents:write на backend-репо) | ⏳ PENDING | владелец |

Без #1 и #2 запуск невозможен. Без #3–#6 кампания работает, но конверсия измеряется только по бронированиям Cal.com вручную.

## 8. Бюджет-модель

`budget = ожидаемые_бронирования × CPL`. CPL неизвестен → `[CPL_TARGET]` задаёт владелец из своей готовности платить за разговор. Это оценка (Inferred), не факт: ни одного платного показа ещё не было.

Стартовая рекомендация: один ad set (manager-impact, RU) первым — там самая сильная цифра (+5,72 п.п.), остальное подключать после первых 1 000 показов.

## 9. Compliance

- Все цифры в объявлениях восходят к `volta.md`; выдуманных кейсов и отзывов нет.
- Нет обещаний трудоустройства, зарплаты, сроков найма.
- Нет ложной срочности; CTA «30 минут» ведёт на реальный Cal.com.
- Rerun проверки фактов перед каждой новой партией: `volta.md`, счётчики `projects/` и `posts/`.

## 10. Чеклист перед запуском

- [ ] Company Page существует и заполнена
- [ ] Ad account, оплата, billing-лимит
- [ ] `[GEO]`, `[SIZE_RANGE]`, `[BUDGET_DAY]`, `[BID]`, `[CPL_TARGET]` заполнены
- [ ] Целевые URL открываются с UTM-параметрами
- [ ] Cal.com отвечает, слотов на 14 дней вперёд ≥ 4
- [ ] `utm_content` в URL совпадает с углом объявления
- [ ] Минимум 1 000 показов на объявление до решения
