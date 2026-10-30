---
title: "User Journey / Path Analysis: где теряется пользователь"
date: 2026-08-27
category: guide
image: /images/og/user-journey-path-analysis.png
tags:
  - product-analytics
  - user-journey
  - path-analysis
excerpt: "Пользователь видит ценность только через неделю — и это не проблема продукта, а проблема пути. Как аналитику разобрать user journey по шагам, найти узкое горлышко и сократить time-to-value с 144 часов до 24."
related:
  - /posts/first-value-moment-activation/
  - /projects/volta/
  - /posts/cohort-triangles-retention/
  - /glossary/funnel/
keywords:
  - user journey analysis
  - path analysis
  - анализ пользовательских путей
draft: false
---

В SaaS-продукте для командной работы мы потеряли 86% регистраций между первым проектом и ценностью. Дашборд показывал красивую воронку онбординга, но никто не видел, что медианный пользователь ползёт до первого «вау-момента» шесть дней — и 88% отваливается раньше. Карта пути, построенная по событийным логам, выявила конкретный барьер: шаг приглашения команды с конверсией 30%. Без path analysis эта дыра невидима.

## Кратко

User Journey Path Analysis — систематический разбор всех шагов от триггера до цели, с измерением времени, конверсии и эмоций на каждом переходе. Цель — перейти от *предполагаемого* опыта к *реальному* (что пользователь делает в логах).

Аналитик собирает путь из событий, сегментирует по шагам, считает time-to-value по перцентилям, ищет узкие горлышки, сравнивает траектории конвертеров и отвалившихся, находит аномальные петли.

В кейсе ниже путь из шести шагов сжали с 144 до 24 часов, подняв D30 retention с 22% до 41% — +570 retained-пользователей в месяц и +$1.23M ARR.

## Что такое пользовательский путь и зачем его анализировать

**Пользовательский путь (User Journey)** — детальное описание опыта взаимодействия с продуктом: от осознания проблемы до достижения цели. **Анализ путей** — выявление всех точек соприкосновения, действий, эмоций и болевых точек на этом пути.

Четыре выгоды: **эмпатия** — команда видит продукт глазами клиента; **узкие места** — путь показывает, *где* в последовательности теряется масса (агрегированная воронка не даёт); **приоритизация** — ресурсы уходят на барьер с самым большим drop-off; **комплексный взгляд** — анализ захватывает экосистему: поиск, рекламу, поддержку.

Карта пути состоит из слоёв: персона, триггер/цель, точки соприкосновения, действия, мысли и чувства, болевые точки, возможности. Каждый слой отвечает на свой вопрос: *кто* идёт, *почему* пришёл, *где* встречает продукт, *что* делает, *что* думает, *что* мешает, *как* исправить.

## Методы анализа: от воронки к последовательностям

Path analysis — не одна техника, а набор методов, каждый отвечает на свой вопрос.

**Воронка путей.** Сколько дошли до каждого шага, какой процент отвалился между шагами. Отвечает на «где теряется масса». Хороша для линейных journey, но скрывает ветвления и петли.

**Common paths.** Вместо предопределённой последовательности — реальные траектории: `A → B → C → D` у 32% пользователей, `A → C → B → D` у 18%, `A → B → B → C` у 9%. Выявляет обходные пути и зацикливания, которые воронка усредняет.

**Time-to-conversion по шагам.** Для каждого перехода — распределение времени: медиана, p75, p90. Медиана важнее среднего — распределение скошено, тяжёлый хвост тянет среднее вверх.

**Сегментация конвертеров vs отвалившихся.** Какие шаги конвертеры делают, а отвалившиеся — нет? Какое событие первой недели — strongest predictor retention? База для поиска First Activation Event.

**Аномальные петли.** Пользователи, повторяющие шаг 3+, 5+, 10+ раз — признак фрикции: не заполняется форма, не находится кнопка, не проходит KYC. Часто самый конкретный actionable сигнал.

**Сравнение по сегментам.** Как путь отличается по каналу, устройству, гео, тарифу? Один продукт может иметь две разных customer journey для двух сегментов.

Методология — пять этапов: scope → сбор данных (логи + интервью) → карта пути → болевые точки → рекомендации. Это цикл Analyze → Improve → Measure → Repeat.

## Кейс: SaaS для командной работы, time-to-value 6 дней

### Контекст проблемы

SaaS-продукт для командной работы, 3 000 новых регистраций в месяц. Жалоба продукта: «Пользователь видит ценность только через неделю». Бизнес-цель: сократить time-to-value. Без path analysis непонятно, где теряется время: онбординг? создание проекта? приглашение команды? совместная сессия?

### Шаг 1: Карта текущего пути

Собираю путь из событийных логов: для каждого пользователя нахожу время первого наступления каждого события от регистрации и считаю распределение.

```sql
WITH user_journey AS (
  SELECT
    u.user_id,
    u.signup_date,
    MIN(CASE WHEN e.event_name = 'onboarding_completed'
             THEN e.event_date END) AS onboarding_completed,
    MIN(CASE WHEN e.event_name = 'first_project_created'
             THEN e.event_date END) AS first_project,
    MIN(CASE WHEN e.event_name = 'team_member_invited'
             THEN e.event_date END) AS first_invite,
    MIN(CASE WHEN e.event_name = 'collaboration_session'
             THEN e.event_date END) AS first_collaboration,
    MIN(CASE WHEN e.event_name = 'value_moment'
             THEN e.event_date END) AS value_moment
  FROM users u
  LEFT JOIN events e ON u.user_id = e.user_id
  WHERE u.signup_date >= CURRENT_DATE - INTERVAL '3 months'
  GROUP BY u.user_id, u.signup_date
),
time_deltas AS (
  SELECT user_id,
    EXTRACT(EPOCH FROM (onboarding_completed - signup_date)) / 3600 AS hours_to_onboarding,
    EXTRACT(EPOCH FROM (first_project - signup_date))     / 3600 AS hours_to_project,
    EXTRACT(EPOCH FROM (first_invite - signup_date))      / 3600 AS hours_to_invite,
    EXTRACT(EPOCH FROM (value_moment - signup_date))      / 3600 AS hours_to_value
  FROM user_journey
)
SELECT 'Signup → Onboarding' AS step,
       AVG(hours_to_onboarding) AS avg_hours,
       MEDIAN(hours_to_onboarding) AS median_hours,
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY hours_to_onboarding) AS p75,
       PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY hours_to_onboarding) AS p90
FROM time_deltas
UNION ALL
SELECT 'Signup → First Project', AVG(hours_to_project), MEDIAN(hours_to_project),
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY hours_to_project),
       PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY hours_to_project)
FROM time_deltas
UNION ALL
SELECT 'Signup → Team Invite', AVG(hours_to_invite), MEDIAN(hours_to_invite),
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY hours_to_invite),
       PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY hours_to_invite)
FROM time_deltas
UNION ALL
SELECT 'Signup → Value Moment', AVG(hours_to_value), MEDIAN(hours_to_value),
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY hours_to_value),
       PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY hours_to_value)
FROM time_deltas;
```

Текущий путь в часах:

| Шаг | Среднее | Медиана | P75 | P90 |
|---|---|---|---|---|
| Signup → Onboarding | 2.5 | 1.2 | 3.0 | 5.5 |
| Signup → First Project | 18 | 8 | 24 | 48 |
| Signup → Team Invite | 72 | 48 | 96 | 144 |
| Signup → Collaboration | 120 | 96 | 144 | 192 |
| **Signup → Value** | **168** | **144** | **192** | **240** |

Медианный time-to-value — 144 часа, шесть дней. p90 — 240 часов, десять дней. Это значит, что половина пользователей, дошедших до ценности, ждёт неделю, а 10% — почти полторы. Проблема не в онбординге (1.2 часа), а где-то между первым проектом (8 часов) и приглашением команды (48 часов).

### Шаг 2: Корреляция time-to-value с retention

Прежде чем оптимизировать, проверяю, что time-to-value действительно предсказывает удержание. Разбиваю пользователей на бакеты по дню достижения ценности и смотрю D30 retention.

```sql
WITH ttv_analysis AS (
  SELECT
    u.user_id,
    EXTRACT(DAY FROM (v.value_moment - u.signup_date)) AS days_to_value,
    CASE
      WHEN EXTRACT(DAY FROM (v.value_moment - u.signup_date)) <= 1 THEN 'same_day'
      WHEN EXTRACT(DAY FROM (v.value_moment - u.signup_date)) <= 3 THEN 'within_3d'
      WHEN EXTRACT(DAY FROM (v.value_moment - u.signup_date)) <= 7 THEN 'within_7d'
      ELSE 'after_7d'
    END AS ttv_bucket,
    MAX(CASE WHEN e.event_date > u.signup_date + 23
              AND e.event_date <= u.signup_date + 30
             THEN 1 ELSE 0 END) AS retained_d30
  FROM users u
  JOIN events v ON u.user_id = v.user_id AND v.event_name = 'value_moment'
  LEFT JOIN events e ON u.user_id = e.user_id
  WHERE u.signup_date >= CURRENT_DATE - INTERVAL '4 months'
    AND u.signup_date < CURRENT_DATE - INTERVAL '1 month'
  GROUP BY u.user_id, days_to_value
)
SELECT ttv_bucket, COUNT(*) AS users,
       ROUND(AVG(retained_d30) * 100, 2) AS d30_retention
FROM ttv_analysis
GROUP BY ttv_bucket;
```

Результат:

| TTV бакет | Пользователи | D30 Retention |
|---|---|---|
| Same day | 450 | 68% |
| Within 3 days | 1 200 | 52% |
| Within 7 days | 900 | 31% |
| After 7 days | 450 | 12% |

Пользователи, достигшие ценности в день регистрации, удерживаются в 5.7 раза лучше, чем те, кто добрался до неё через неделю. Корреляция time-to-value с retention — r = 0.73. Это один из сильнейших предикторов удержания, значит сжимать путь стоит.

### Шаг 3: Воронка путей — где барьер

Теперь ищу конкретное узкое горлышко — воронка путей за 30 дней.

```sql
WITH funnel AS (
  SELECT 'signed_up' AS step, COUNT(*) AS users
  FROM users WHERE signup_date >= CURRENT_DATE - INTERVAL '30 days'
  UNION ALL
  SELECT 'completed_onboarding', COUNT(DISTINCT user_id) FROM events
  WHERE event_name = 'onboarding_completed'
    AND event_date >= CURRENT_DATE - INTERVAL '30 days'
  UNION ALL
  SELECT 'created_first_project', COUNT(DISTINCT user_id) FROM events
  WHERE event_name = 'first_project_created'
    AND event_date >= CURRENT_DATE - INTERVAL '30 days'
  UNION ALL
  SELECT 'invited_team_member', COUNT(DISTINCT user_id) FROM events
  WHERE event_name = 'team_member_invited'
    AND event_date >= CURRENT_DATE - INTERVAL '30 days'
  UNION ALL
  SELECT 'had_collaboration', COUNT(DISTINCT user_id) FROM events
  WHERE event_name = 'collaboration_session'
    AND event_date >= CURRENT_DATE - INTERVAL '30 days'
  UNION ALL
  SELECT 'reached_value', COUNT(DISTINCT user_id) FROM events
  WHERE event_name = 'value_moment'
    AND event_date >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT step, users,
       ROUND(users * 100.0 / FIRST_VALUE(users) OVER () AS 2) AS pct_of_top,
       LAG(users) OVER () - users AS drop_off,
       ROUND(users * 100.0 / LAG(users) OVER () AS 2) AS step_conversion
FROM funnel;
```

Воронка:

| Шаг | Пользователи | % от начала | Отвал | Конверсия шага |
|---|---|---|---|---|
| Signed up | 3 000 | 100% | — | — |
| Completed onboarding | 1 950 | 65% | -1 050 | 65% |
| Created first project | 1 365 | 45.5% | -585 | 70% |
| **Invited team member** | 410 | 13.7% | **-955** | **30%** |
| Had collaboration | 287 | 9.6% | -123 | 70% |
| Reached value | 201 | 6.7% | -86 | 70% |

Критический барьер — `invited_team_member`: конверсия шага 30%, отвалилось 955 человек. До и после конверсия 65–70%, то есть продукт работает, а приглашение команды — фрикция. Это и есть узкое горлышко, которое path analysis выявляет, а воронка верхнего уровня — нет.

### Шаг 4: Гипотезы и изменения

Три гипотезы барьера: (1) приглашение требует email; (2) нет шаблонов — пустой проект пугает; (3) ценность требует совместной сессии — надо ждать других.

Изменения в спринте 24: **Solo mode** — ценность без приглашения команды, pre-populated templates за один клик, interactive tutorial; **упрощение приглашения** — invite по ссылке вместо email, auto-invite из контактов, skip invite; **quick start** — шаблонные проекты «Project Kickoff» (2 минуты настройки), «Sprint Planning» (3 минуты), «Team Retrospective» (5 минут).

### Шаг 5: Результаты A/B-теста

Сравниваю time-to-value и retention до и после изменений.

```sql
SELECT group_name, COUNT(*) AS users,
  MEDIAN(EXTRACT(EPOCH FROM (value_moment - signup_date)) / 3600) AS median_ttv_hours,
  ROUND(AVG(CASE WHEN EXTRACT(DAY FROM (value_moment - signup_date)) = 0
                 THEN 1 ELSE 0 END) * 100, 2) AS same_day_value_pct,
  ROUND(AVG(retained_d30) * 100, 2) AS d30_retention
FROM (
  SELECT
    CASE WHEN signup_date < '2026-03-15' THEN 'control' ELSE 'treatment' END AS group_name,
    user_id, signup_date, value_moment, retained_d30
  FROM users_with_value
  WHERE signup_date >= CURRENT_DATE - INTERVAL '60 days'
) test_data
GROUP BY group_name;
```

Итог:

| Метрика | Control | Treatment | Δ |
|---|---|---|---|
| Median TTV (часы) | 144 | 24 | -83% |
| Same day value | 8% | 42% | +34 п.п. |
| Within 3 days | 28% | 68% | +40 п.п. |
| D30 Retention | 22% | 41% | +19 п.п. |

Бизнес-эффект: retained users в месяц вырос с 660 до 1 230 (+570). При ARPU $30/мес и среднем времени жизни 6 месяцев — +$102 600 MRR, годовой эффект +$1.23M ARR. Корреляция TTV с retention осталась r = 0.73 — механика не изменилась, изменилось распределение: больше людей попало в зону same-day, где retention 68%.

## SQL и Python для анализа последовательностей

В кейсе выше путь был почти линейным — хватило `MIN(CASE WHEN ...)` по шагам. В реальном продукте пути ветвятся, и нужен другой подход: агрегация событий в массив и анализ массива.

PostgreSQL-скелет для извлечения popular paths:

```sql
WITH ordered_events AS (
  SELECT user_id, event_name,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_date) AS step_n
  FROM events
  WHERE event_date >= CURRENT_DATE - INTERVAL '30 days'
),
paths AS (
  SELECT user_id, ARRAY_AGG(event_name ORDER BY step_n) AS path
  FROM ordered_events GROUP BY user_id
)
SELECT path, COUNT(*) AS users FROM paths
GROUP BY path ORDER BY users DESC LIMIT 20;
```

`ARRAY_AGG ... ORDER BY` собирает упорядоченную последовательность событий — это и есть raw path. Группировка по массиву даёт частоты траекторий. Для длинных путей массив обрезают до первых N шагов.

Python-скелет для поиска common paths и зацикливаний:

```python
import pandas as pd
from collections import Counter

def common_paths(events: pd.DataFrame, max_len: int = 5, top: int = 20):
    """Возвращает top-N популярных траекторий длиной ≤ max_len."""
    paths = (
        events.sort_values(["user_id", "event_at"])
             .groupby("user_id")["event_name"]
             .apply(lambda s: tuple(s.tolist()[:max_len]))
    )
    return Counter(paths).most_common(top)

def loops(events: pd.DataFrame, repeat_threshold: int = 3):
    """Пользователи с повторением одного события ≥ repeat_threshold раз подряд."""
    def has_loop(seq):
        last, count = None, 0
        for x in seq:
            if x == last:
                count += 1
                if count >= repeat_threshold:
                    return True
            else:
                last, count = x, 1
        return False
    return (
        events.sort_values(["user_id", "event_at"])
             .groupby("user_id")["event_name"]
             .apply(lambda s: has_loop(s.tolist()))
             .loc[lambda s: s].index.tolist()
    )
```

`common_paths` даёт частоты реальных траекторий, `loops` — пользователей с зацикливаниями (признак фрикции: не находится кнопка, не проходит форма). Для графового анализа переходов подходит networkx: узлы — события, рёбра — переходы, веса — частоты. PageRank на таком графе выявляет «узкие экраны», через которые проходит большинство траекторий.

## Сравнение путей конвертеров и отвалившихся

Самый actionable slice — сравнение траекторий тех, кто дошёл до ценности, и тех, кто бросил.

Алгоритм: разметить `converter` (есть `value_moment` в 30 дней) и `churned` (есть `signed_up`, нет `value_moment`, но события в первые 7 дней); построить common paths первых 5–7 шагов для каждого сегмента; найти шаги с разрывом `P(step | converter) − P(step | churned)`; проверить, что разрыв не selection bias (если шаг делают только «хорошие» пользователи с длинного канала — это корреляция, не рычаг).

Контроль — сегментация по каналу и когорта.

Шаги с большим положительным lift — кандидаты на First Activation Event. Шаги с большим отрицательным lift — кандидаты на барьер.

## Чек-лист аналитика

- Начинать с «почему»: какой путь, для какой персоны, с какой целью. Без scope path analysis превращается в ковыряние в логах.
- Собирать данные, а не догадки: количественные логи показывают *что*, качественные интервью — *почему*.
- Мерить распределение времени, а не среднее. Медиана, p75, p90 — среднее в скошенных данных бесполезно.
- Искать узкое горлышко с самым большим drop-off, а не оптимизировать все шаги подряд.
- Сегментировать конвертеров и отвалившихся — сравнение траекторий, самый прямой путь к гипотезе.
- Проверять барьер на selection bias до A/B-теста: корреляция шага с retention может быть артефактом канала.
- Итерировать: Analyze → Improve → Measure → Repeat.

## Выводы

- **User Journey — не один график, а набор методов.** Воронка показывает где теряется масса, common paths — как на самом деле ходят, time-to-conversion — где застревают, сравнение конвертеров и отвалившихся — что отличает успех от churn.
- **Искать узкое горлышко, а не улучшать всё подряд.** Один шаг — приглашение команды с конверсией 30% — стоил 955 отвалившихся. Починка дала +19 п.п. retention; починка онбординга (65%) дала бы на порядок меньше.
- **Time-to-value — сильнейший предиктор retention.** Корреляция r = 0.73, разрыв D30 retention между same-day и after-7d — 5.7 раза. Сжатие TTV с 144 до 24 часов подняло retention с 22% до 41%.
- **Мерить распределение, а не среднее.** Медиана 144 часа и среднее 168 часа — разница между «шесть дней» и «семь дней» в формулировке проблемы.
- **Path analysis — цикл, не отчёт.** После изменения пути измеряешь результат, ищешь новое узкое горлышко, повторяешь.
- **Solo mode и templates бьют приглашение как барьер.** Когда ценность продукта зависит от других пользователей, самый дешёвый рычаг — дать первый value без них: solo mode + templates сократили путь до ценности на 83%.