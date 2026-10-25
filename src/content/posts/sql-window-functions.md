---
title: "Оконные функции: gaps-and-islands, топ-N, range-join для stickiness"
date: 2026-08-15
updated: 2026-08-23
category: guide
image: /images/og/sql-window-functions.png
tags:
  - sql
  - duckdb
excerpt: "Три паттерна оконных функций, которые отличают продуктового аналитика: gaps-and-islands для стриков, partitioned Top-N и range-join для DAU/MAU stickiness. На DuckDB, без сервера."
related:
  - /projects/sql/
  - /posts/cohort-triangles-retention/
keywords:
  - gaps and islands sql
  - оконные функции duckdb
  - streak удержания sql
  - partitioned top N sql
  - DAU MAU stickiness sql
draft: false
---

## Кратко

Оконные функции — это агрегация без схлопывания строк: `ROW_NUMBER()`, `LAG()`, `SUM() OVER (...)` оставляют исходную детализацию и добавляют к каждой строке значение из окна. Три паттерна закрывают большую часть реальных продуктовых задач:

- **Gaps-and-islands** — найти непрерывные серии (стрики, «сессии подряд», периоды активности).
- **Partitioned Top-N** — топ по каждой группе («3 лучших товара по выручке на категорию»).
- **Range-join** — собрать активность в диапазоне (DAU/MAU, «сколько дней активен в месяце»).

Примеры ниже — на DuckDB, который умеет вычитать целое из даты и работает с одного файла, без сервера.

## Пример

Стрики: разбить активность пользователя на острова (непрерывные дни) и посчитать длину каждого.

```sql
WITH flagged AS (
  SELECT
    user_id,
    activity_date,
    activity_date - ROW_NUMBER() OVER (
      PARTITION BY user_id ORDER BY activity_date
    ) AS grp
  FROM activity
)
SELECT
  user_id,
  COUNT(*)         AS streak_len,
  MIN(activity_date) AS started,
  MAX(activity_date) AS ended
FROM flagged
GROUP BY user_id, grp
HAVING COUNT(*) >= 5
ORDER BY streak_len DESC;
```

Идея: в непрерывной серии `activity_date - row_number` — константа. Пропуск дня сдвигает `grp` — получаются отдельные острова. Группировка по `user_id, grp` собирает каждый остров в одну строку.

## Как пишется

### Gaps-and-islands: метка острова

Ключевой трюк — вычесть из даты `ROW_NUMBER()`. Пока дни идут подряд, разность постоянна; на пропуске она меняется. Так из потока дат получаются группы-острова, которые потом сжимаются `GROUP BY`.

### Partitioned Top-N: ранг внутри группы

```sql
SELECT * FROM (
  SELECT
    product_id,
    revenue,
    ROW_NUMBER() OVER (
      PARTITION BY product_id ORDER BY revenue DESC
    ) AS rn
  FROM sales
) ranked
WHERE rn <= 3;
```

`ROW_NUMBER()` внутри каждой `product_id` нумерует строки по убыванию выручки. Внешний запрос отрезает `rn <= 3`. Для «топ-3 на категорию» достаточно поменять `PARTITION BY` на категорию.

### Range-join: DAU/MAU и stickiness

Stickiness = DAU / MAU — доля активных пользователей месяца в среднем за день. Чтобы посчитать «сколько дней в месяце был активен каждый пользователь», можно range-join дни активности на месяц:

```sql
SELECT
  u.user_id,
  COUNT(DISTINCT a.day) AS active_days,
  COUNT(DISTINCT d.day) AS days_in_month
FROM users u
JOIN activity a  ON a.user_id = u.user_id
JOIN (SELECT generate_series(
        DATE '2026-01-01',
        DATE '2026-01-31',
        INTERVAL 1 DAY
      ) AS day) d
  ON a.day BETWEEN d.day AND d.day
GROUP BY u.user_id;
```

Среднее DAU/MAU по месяцам — и есть stickiness. Для «сильных» продуктов оно держится 0.2–0.3, для привычных инструментов — выше.

## Как понять

### Почему группы строк, а не значения

Главное отличие оконных функций от агрегатов: они не теряют строки. `GROUP BY` сводит сотни строк в одну и навсегда теряет контекст соседних строк. Оконная функция читает окно вокруг текущей строки и возвращает значение к этой строке — поэтому с её помощью можно строить скользящие суммы, ранги и разности `LAG`.

### Ловушка islands: пустые окна

Если у пользователя нет активности в промежутке, острова «склеиваются» только при вычитании `ROW_NUMBER()`. Важно сначала отобрать уникальные даты (`SELECT DISTINCT user_id, activity_date`), иначе дубликаты дат собьют нумерацию и нарежут ложные острова.

### Stickiness ≠ качество продукта

DAU/MAU — частота визитов, а не ценность. Калькулятор с высоким stickiness, но нулевой выручкой — не победа. Читать stickiness в паре с retention-треугольником и монетизацией, а не в одиночку.

## Подсказки

- Перед islands всегда делайте `DISTINCT` по (пользователь, дата).
- `ROW_NUMBER()` vs `RANK()`: если нужны «одинаковые значения = одинаковое место», берите `RANK`/`DENSE_RANK`.
- Строчки `PARTITION BY` — по смыслу группы: юзер, продукт, регион. Перебор групп делает запрос медленным — проверяйте план.
- `generate_series` — самый простой способ построить календарь в DuckDB; для range-join берите его, а не таблицу календаря на диске.
- Каждый паттерн выносите в CTE с именем, описывающим смысл (`flagged`, `ranked`, `active_days`) — запрос читается сверху вниз как история.

## На практике

В проекте [SQL Analytics Case Study](/projects/sql/) собраны 26 самодостаточных кейсов на DuckDB — от воронки до revenue attribution.

Каждый кейс — один `.sql`-файл с вопросом и подходом в leading-комментарии: gaps-and-islands для стриков, partitioned Top-N для топ-товаров, range-join для stickiness, `LAG`-приросты, DAU/MAU. Данные синтетические (seed = 42, ~183k событий) и детерминированные, а к кейсам привязаны regression-тесты: pytest проверяет, что SQL продолжает выдавать ожидаемые метрики после любого изменения генератора.

## На собеседовании

<details>
<summary>❓ Что такое gaps-and-islands и как это решается в SQL?</summary>

Gaps-and-islands — задача найти непрерывные серии в потоке событий: стрики, периоды активности, «подряд идущие дни». Классическое решение — вычесть из даты `ROW_NUMBER()`, посчитанный в окне по порядку дат. Внутри непрерывной серии разность константа, на пропуске меняется — так поток режется на острова, которые потом схлопываются `GROUP BY user_id, grp`. Перед этим обязателен `DISTINCT` по (пользователь, дата).

— Nikita Boyarkin
</details>

<details>
<summary>❓ Как посчитать топ-N внутри группы?</summary>

Подзапросом с `ROW_NUMBER() OVER (PARTITION BY группа ORDER BY метрика DESC)`, затем внешний `WHERE rn <= N`. Ранжирование внутри каждой группы независимо, порядок метрики задаёт «топ». Для значений с одинаковой метрикой, где нужно одинаковое место, — `RANK()` или `DENSE_RANK()`.

— Nikita Boyarkin
</details>

## Ссылки

- [SQL Analytics Case Study](/projects/sql/) — 26 кейсов на DuckDB с regression-тестами
- [Почему агрегат врёт: когортные треугольники](/posts/cohort-triangles-retention/) — stickiness читается в паре с retention