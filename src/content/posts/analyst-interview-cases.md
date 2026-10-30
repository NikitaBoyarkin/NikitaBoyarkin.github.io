---
title: "Кейсы с собеседований: как диагностировать просадку метрики"
date: 2026-08-27
category: decision-log
image: /images/og/analyst-interview-cases.png
tags:
  - career
  - interview
  - sql
  - case-study
excerpt: "На интервью аналитику дают просадку метрики и два часа на диагноз. Разбираю два кейса — финтех и маркетплейс — и вытаскиваю универсальный шаблон: от уточнения контекста до плана восстановления со стоп-сигналами."
related:
  - /posts/data-analyst-portfolio-checklist/
  - /posts/product-analyst-collaboration/
  - /posts/analyst-proactivity/
  - /projects/gmv-drop-rca/
keywords:
  - кейсы собеседование аналитик
  - диагностика просадки метрики
  - продуктовые кейсы
draft: false
---

## Кратко

Операционный кейс на интервью — самый частый формат на позиции продуктового или кредитного аналитика: вам дают просадку метрики, таблицы и два часа на диагноз. Хороший ответ не начинается с SQL — он начинается с уточнения контекста, выбора primary KPI и guardrails, и только потом идёт в сегментацию и декомпозицию воронки.

Эта заметка — decision-log по двум кейсам из практики подготовки к собеседованиям. Первый — финтех, просадка одобрения в кредитном продукте после изменения скоринга (главный, потому что цель автора — аналитик в банк).

Второй — маркетплейс, просадка конверсии после релиза iOS (второй иллюстрирующий). Из двух кейсов складывается универсальный шаблон диагностики, который я воспроизвожу на любом интервью с операционной задачей.

## Шаг 1. Уточнить контекст и выбрать метрики

Слабый кандидат сразу открывает SQL. Сильный — тратит первые 10 минут на уточнение, потому что без него любой запрос оказывается запросом не про то.

**Финтех-кейс.** Босс говорит: «Одобрение упало с 45% до 38%, бизнес теряет 200 клиентов в день». Первая ошибка — принять approval rate как primary KPI. В кредитном продукте approval — это прокси, а не цель. Цель — ожидаемая прибыль на заявку: `Expected Profit per Application = (одобренные × средний процент) − (дефолты × потери)`. Пока кандидат не переформулировал primary KPI в деньги, он решает метрику, а не бизнес-задачу.

Guardrails в финтехе жёстче, чем в e-commerce: default rate < 10% (качество портфеля), approval rate > 35% (viability бизнеса), и неонаженный запрет отказывать тем, кто успешно платил в прошлом. Без этих ограничений «откатить скоринг» — это решение вслепую.

**Маркетплейс-кейс.** Босс говорит: «Конверсия упала с 8% до 5% после релиза iOS». Здесь primary KPI проще — Revenue per paying user на iOS, потому что это прямо деньги. Но guardrails те же по логике: App crash rate > 2% — немедленный rollback, Payment error rate > 5% — проблема на провайдере.

Что уточнять в первых 10 минутах:

- Значимо ли падение статистически или это шум? Сколько событий в день?
- Падение только на одной платформе или на всех?
- Были ли параллельные A/B-тесты в момент релиза?
- Какой срок наблюдения — часы, дни, недели? В кредитном продукте дефолты проявляются через месяцы, в e-commerce — через минуты.

## Шаг 2. Сегментация для локализации проблемы

После уточнения — первый SQL-запрос не про воронку, а про сегментацию. Цель — ответить на вопрос «где именно падение»: платформа, версия, гео, сегмент пользователя.

**Маркетплейс — сегментация по платформе.** Первый запрос сравнивает конверсию по iOS, Android и Web за два дня. Если iOS упала, а Android и Web стабильны — это app-specific баг, не системный. Если упали все три — проблема в общих компонентах: платежном провайдере, аналитике, данных.

```sql
SELECT
  os,
  DATE(event_ts) as date,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(CASE WHEN checkout_step = 'payment_success' THEN 1 END) as success,
  ROUND(100.0 * COUNT(CASE WHEN checkout_step = 'payment_success' THEN 1 END)
    / COUNT(DISTINCT session_id), 2) as cvr_pct
FROM events_checkout
WHERE DATE(event_ts) IN (CURRENT_DATE - INTERVAL 1 DAY, CURRENT_DATE)
  AND os IN ('iOS', 'Android', 'Web')
GROUP BY os, DATE(event_ts)
ORDER BY os, date DESC;
```

**Финтех — сегментация по сегменту пользователя.** В кредитном продукте сегментация идёт по стажу пользователя и доходу. Новые пользователи с низким доходом бьются сильнее всего — если new_version скоринга режет именно этот сегмент, это не «улучшение качества портфеля», а системный перекос.

```sql
SELECT
  CASE
    WHEN DATEDIFF(YEAR, signup_date, CURRENT_DATE) < 2 THEN 'new_user'
    ELSE 'established_user'
  END as user_segment,
  CASE
    WHEN income_level < 30000 THEN 'low_income'
    WHEN income_level < 60000 THEN 'mid_income'
    ELSE 'high_income'
  END as income_bracket,
  cd.scoring_version,
  COUNT(DISTINCT cd.application_id) as applications,
  ROUND(100.0 * COUNT(CASE WHEN cd.decision = 'approved' THEN 1 END) /
    COUNT(DISTINCT cd.application_id), 2) as approval_rate,
  ROUND(AVG(cd.approved_amount), 2) as avg_approved_amount
FROM credit_decisions cd
JOIN users u ON cd.user_id = u.user_id
WHERE DATE(cd.decision_date) BETWEEN CURRENT_DATE - INTERVAL 30 DAY AND CURRENT_DATE
GROUP BY user_segment, income_bracket, scoring_version
ORDER BY scoring_version DESC, user_segment, income_bracket;
```

Принцип один: сегментация отвечает на вопрос «кто именно пострадал», а не «насколько упала метрика». Число мы уже знаем из постановки — нам нужна локализация.

## Шаг 3. Проверка данных и трекинга

Прежде чем объяснять падение, проверьте, что падение реально. Это шаг, который слабые кандидаты пропускают полностью.

Типовые проверки:

- Не сломался ли трекинг событий? Если событий стало вдвое меньше при том же трафике — это не просадка метрики, это просадка аналитики.
- Не менялось ли определение метрики? В финтехе — не поменялось ли поле `decision` в новых записях.
- Нет ли параллельного эксперимента, который искажает картину? Таблица `experiments` — первая на соединение.
- Не было ли выброса по одному дню, который тянет весь период?

В маркетплейс-кейсе параллельные эксперименты — обязательная проверка: если 20% трафика было в A/B-тесте на новый дизайн корзины, падение конверсии может быть артефактом микса, а не багом релиза.

## Шаг 4. Декомпозиция воронки

После локализации — следующий запрос декомпозирует воронку по шагам. Цель — найти точный шаг, на котором падает конверсия.

**Маркетплейс — шаги воронки по версии.** Сравниваем конверсию между шагами `cart_view → checkout_start → payment_form → payment_confirm → payment_success` с разбиением по `app_version`. Если падение между `checkout_start` и `payment_form` — баг в UI формы платежа; если между `payment_confirm` и `payment_success` — проблема в платёжном провайдере.

```sql
SELECT
  app_version,
  checkout_step,
  COUNT(DISTINCT session_id) as users,
  ROUND(100.0 * COUNT(DISTINCT session_id) /
    LAG(COUNT(DISTINCT session_id)) OVER (PARTITION BY app_version
      ORDER BY CASE checkout_step
        WHEN 'cart_view' THEN 1
        WHEN 'checkout_start' THEN 2
        WHEN 'payment_form' THEN 3
        WHEN 'payment_confirm' THEN 4
        WHEN 'payment_success' THEN 5
      END), 2) as step_cvr_pct
FROM events_checkout
WHERE os = 'iOS' AND DATE(event_ts) = CURRENT_DATE
GROUP BY app_version, checkout_step
ORDER BY app_version, checkout_step;
```

**Финтех — шаги заявки по скоринг-версии.** В кредитной воронке шаги другие: `application → documents → scoring → sanctions → decision`. Запрос по `application_step` и `scoring_version` показывает, на каком шаге new_version режет заявки.

```sql
SELECT
  application_step,
  scoring_version,
  COUNT(DISTINCT application_id) as applications,
  COUNT(CASE WHEN step_status = 'approved' THEN 1 END) as approved,
  ROUND(100.0 * COUNT(CASE WHEN step_status = 'approved' THEN 1 END) /
    COUNT(DISTINCT application_id), 2) as approval_rate
FROM loan_applications
WHERE DATE(applied_date) BETWEEN CURRENT_DATE - INTERVAL 30 DAY AND CURRENT_DATE
GROUP BY application_step, scoring_version
ORDER BY scoring_version DESC, application_step;
```

Принцип: один запрос — один шаг воронки с разрезом по версии/сегменту. Если кандидат пишет один «большой» запрос на всю воронку без `LAG` — он теряет шаг конверсии между этапами.

## Шаг 5. Гипотезы и проверка через SQL

Когда шаг локализован — формулируем гипотезы и проверяем их запросами. В кейсах на интервью гипотезы — это не список «что может быть», а список «что именно я проверяю следующим запросом».

**Маркетплейс — гипотеза про Apple Pay.** Если падение на шаге `payment_form → payment_confirm` и только на iOS — первая гипотеза: сломана интеграция конкретного платёжного метода. Запрос ниже проверяет success rate по `payment_method` и `app_version` на iOS: если Apple Pay 34%, а Stripe 98% — диагноз подтверждён.

```sql
SELECT
  payment_method,
  app_version,
  COUNT(*) as attempts,
  COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as success,
  ROUND(100.0 * COUNT(CASE WHEN payment_status = 'success' THEN 1 END) /
    COUNT(*), 2) as success_rate,
  ROUND(AVG(CASE WHEN payment_status = 'success' THEN amount ELSE NULL END), 2) as avg_amount,
  STRING_AGG(DISTINCT error_code, ', ') as errors
FROM payments p
JOIN events_checkout e ON p.session_id = e.session_id
WHERE DATE(p.created_at) = CURRENT_DATE
  AND e.os = 'iOS'
GROUP BY payment_method, app_version
ORDER BY success_rate ASC, attempts DESC;
```

**Финтех — гипотеза про причину отказов.** Если new_version режет на шаге скоринга — смотрим `reason_code`. Если доля отказов с причиной `insufficient_income` выросла с 15% до 35%, а остальные причины стабильны — это конкретное изменение в правиле, а не общая консервативность.

```sql
SELECT
  scoring_version,
  reason_code,
  COUNT(DISTINCT application_id) as rejections,
  ROUND(100.0 * COUNT(DISTINCT application_id) /
    SUM(COUNT(DISTINCT application_id)) OVER (PARTITION BY scoring_version), 2) as pct_of_rejections
FROM credit_decisions
WHERE decision = 'rejected'
  AND DATE(decision_date) BETWEEN CURRENT_DATE - INTERVAL 30 DAY AND CURRENT_DATE
GROUP BY scoring_version, reason_code
ORDER BY scoring_version DESC, rejections DESC;
```

## Шаг 6. Бизнес-эффект и качество портфеля

В финтех-кейсе этот шаг — ключевой. Падение approval с 45% до 38% выглядит плохо, но может быть оправдано, если дефолты упали сильнее, чем доход. Считаем net expected profit per loan: процентный доход минус потери по дефолтам.

```sql
SELECT
  cd.scoring_version,
  COUNT(DISTINCT cd.application_id) as approved,
  ROUND(AVG(cd.interest_rate), 2) as avg_interest_rate,
  ROUND(AVG(cd.approved_amount), 0) as avg_loan_amount,
  ROUND(SUM(cd.approved_amount * cd.interest_rate / 100) / COUNT(*), 2) as avg_annual_interest_income,
  ROUND(SUM(d.loss_amount) / COUNT(DISTINCT cd.application_id), 2) as avg_loss_per_loan,
  ROUND(
    SUM(cd.approved_amount * cd.interest_rate / 100) / COUNT(*) -
    SUM(d.loss_amount) / COUNT(DISTINCT cd.application_id), 2
  ) as net_expected_profit_per_loan
FROM credit_decisions cd
LEFT JOIN defaults d ON cd.application_id = d.application_id
WHERE DATE(cd.decision_date) BETWEEN CURRENT_DATE - INTERVAL 90 DAY AND CURRENT_DATE - INTERVAL 30 DAY
  AND cd.decision = 'approved'
GROUP BY cd.scoring_version
ORDER BY cd.scoring_version DESC;
```

В маркетплейс-кейсе бизнес-эффект считается проще: средний чек × доля iOS-трафика × просадка конверсии × число сессий. При среднем чеке $50, 40% iOS-трафика и 100k сессий в день потери — $58–100k за 24 часа. Это та оценка, которая оправдывает немедленный rollback.

## Шаг 7. План восстановления со стоп-сигналами

Сильный кандидат не просто «находит проблему» — он предлагает план с критериями остановки. Без стоп-сигналов план — это пожелание.

**Финтех — гибридная стратегия на 3 месяца.** Не откатывать скоринг целиком, а тестировать гибрид: для новых пользователей с низким доходом — old_version, для остальных — new_version. Пилот на 50% трафика, мониторинг approval и default rate через 30 дней. Стоп-сигнал: default rate > 10% в любой когорте — откат.

**Маркетплейс — немедленный rollback + канарейка.** Откатываем старую версию iOS, параллельно инженеры смотрят дифф платежного потока. После фикса — канарейка: 5% трафика на 2 часа, потом 25%, потом 100%. Stop/go критерии: Apple Pay success rate ≥ 95% и iOS CVR ≥ 7.5% — go; дельта > 10% за час — stop.

## Шаг 8. Красные флаги в интервью

На интервью давят — проверяют, умеет ли кандидат держать удар. Два типовых давления и сильные ответы.

**Давление «может быть, внешний фактор».** В маркетплейсе: «Может, Apple Pay шлюз лежал, откатим — всё равно упадёт». Слабый ответ — «посмотрим логи». Сильный — «если бы лежал шлюз, падение было бы на Android/Web тоже. Там успех 98%. Это app-specific баг, проверим интеграционным тестом 100 платежей». Принцип: внешний фактор бьёт все платформы равномерно, app-specific — только одну.

**Давление «откатили, но как убедиться, что не сломается снова».** Слабый — «будем внимательнее». Сильный — «канарейка 5% → 25% → 100% с мониторингом, автоматические регрессионные тесты на 500 платежей через все методы, real-time alert на success_rate по провайдерам, post-mortem на тему, почему QA не поймал баг». Принцип: процесс, а не намерение.

**Давление в финтехе: «новая версия правильная и одобрять больше опасно».** Сильный ответ — смотрим экономику. Если new_version дешевле по дефолтам (6% против 8%), но теряем на объёме и net profit падает, это плохая сделка. Гибрид: для категорий, где new_version улучшает результат — используем её, для остальных — старую.

## Как говорить на интервью

Несколько практических правил, которые отличают сильный ответ от среднего.

Говорите вслух то, что проверяете. «Сейчас я проверяю гипотезу, что падение только на iOS» — это звучит банально, но интервьюер понимает ваш ход мысли. Молчаливый кандидат, который пишет правильные запросы, проигрывает болтливому кандидату с теми же запросами.

Называйте метрики по имени. Не «конверсия», а «CVR с шага checkout_start на payment_form». Не «доход», а «net expected profit per loan». Точность в языке = точность в мышлении.

Разделяйте primary KPI и guardrails. Primary — что оптимизируем, guardrails — что не ломаем. В финтехе approval — это guardrail, а не primary. В маркетплейсе crash rate — guardrail, primary — revenue.

Всегда предлагайте план, а не только диагноз. Найденная причина без плана восстановления — половина ответа. План без стоп-сигналов — четверть.

## Выводы

- **Уточнение до SQL.** Первые 10 минут — уточнение контекста, выбор primary KPI и guardrails. Без этого любой запрос оказывается запросом не про то.
- **Сегментация локализует, декомпозиция уточняет.** Первый запрос — сегментация (платформа/версия/сегмент), второй — декомпозиция воронки по шагам. Один запрос — один шаг воронки с разрезом по версии.
- **Проверяйте данные до объяснения.** Падение может быть артефактом трекинга, изменения определения или параллельного эксперимента. Прежде чем объяснять — подтвердите, что падение реально.
- **Бизнес-эффект в деньгах, не в процентах.** В финтехе — net expected profit per loan; в маркетплейсе — оценка потерь за 24 часа. Проценты не оправдывают rollback, деньги — оправдывают.
- **План со стоп-сигналами.** Не «откатим и посмотрим», а конкретные stop/go критерии, горизонт наблюдения и порог эскалации. В финтехе — гибридная стратегия с порогом default rate; в маркетплейсе — канарейка с порогом success rate.
- **Красные флаги — это процесс, а не намерение.** «Будем внимательнее» — слабый ответ. «Канарейка + регрессионные тесты + real-time alert + post-mortem» — сильный. Интервьюер проверяет, умеете ли вы строить процесс, а не обещать.