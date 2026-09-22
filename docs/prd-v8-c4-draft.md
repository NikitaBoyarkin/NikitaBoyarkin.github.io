# C4 — блок «подойдёт, если…» на `/value/` — черновик

> PRD v8, задача P0-C4. **Статус: `PENDING` — черновик, не опубликован.**
> Владелец черновика: agent. Утверждает: владелец.
> Создан 2026-09-22. Правок в `src/pages/` не делалось — гейт аутрича не пройден (§3 PRD v8).

---

## Зачем

Закрывает третью работу читателя из PRD v8 §4 — «проверить совпадение с вакансией».
Сейчас её закрывают два абзаца прозы (`value.astro:61-85`), читаются как описание,
а не как чек-лист. Рекрутер и тимлид ищут признаки совпадения, а не прилагательные.

## Правило формата

3–5 пунктов. Каждый пункт — **проверяемый признак**: стек, формат или тип задач.
Оценочное прилагательное без критерия — брак.

| Плохо | Почему |
|---|---|
| «нужен ответственный аналитик» | не проверяемо |
| «люблю сложные задачи» | не проверяемо |
| «глубокий анализ данных» | не проверяемо |

---

## Черновик (RU) — 5 пунктов

Заголовок блока: **«Подойдёт, если…»**

**1. В вакансии A/B — как задача, а не как слово.**
Если от аналитика ждут дизайна эксперимента: AA-тест до раскатки, CUPED для снижения
дисперсии, ship-gate после. Кейс: KYC-шаг Volta, +5.72 п.п., годовой эффект €656K.

**2. Нужен разбор удержания, а не один срез.**
Если в описании роли есть retention, когорты, CLV или winback. Кейс: retention M3
+9.2 п.п., эффект на LTV €227K.

**3. Сегментация, которая меняет распределение выручки.**
Если задача — не «сделать сегменты», а перераспределить работу с базой.
Кейс: RFM, доля выручки в 4 ключевых сегментах 12% → 41%.

**4. Стек совпадает.**
SQL + Python (pandas, scipy/statsmodels), продуктовая аналитика на PostHog или аналоге,
BI-слой поверх. Плюс: dbt, Supabase/Postgres, Streamlit — есть в кейсах.

**5. Данные синтетические, методология настоящая.**
Если готовы оценивать метод, а не бизнес-эффект: все кейсы построены на
сгенерированных данных, воспроизводимы и идут с кодом. Это заявлено открыто
и проверяется запуском.

---

## Черновик (EN) — mirror

Заголовок: **«A fit if…»**

**1. A/B is written into the role as a task, not a keyword.**
You expect the analyst to design the experiment: AA before rollout, CUPED for variance
reduction, ship-gate after. Case: Volta KYC step, +5.72 pp, €656K annual impact.

**2. You need retention analysed, not sliced once.**
Retention, cohorts, CLV or winback appear in the description. Case: M3 retention
+9.2 pp, €227K LTV impact.

**3. Segmentation that moves revenue, not just labels it.**
The task is to shift how the base is worked, not to produce segments. Case: RFM,
revenue share in the 4 key segments 12% → 41%.

**4. The stack matches.**
SQL + Python (pandas, scipy/statsmodels), product analytics on PostHog or equivalent,
a BI layer on top. Also in the cases: dbt, Supabase/Postgres, Streamlit.

**5. Synthetic data, real methodology.**
You are willing to judge the method, not the business outcome: every case runs on
generated data, is reproducible, and ships with code. Stated openly — verify by running it.

---

## Куда встраивать

Позиция: `src/pages/value.astro` — между `.value-proof` (строка 59) и первым
`.board-card.value-offer` (строка 61). До блоков «Найм»/«Коллаборация»:
сначала «подходим ли мы друг другу», потом «что я предлагаю».

EN mirror — `src/pages/en/value.astro`, та же позиция.

Новых CSS-классов не требуется: переиспользуется `.board-card` + существующая
типографика. Список — `<ul>`, не `<p>` (пункт = признак, не абзац).

---

## Что проверено / что нет

| Утверждение | Класс | Как проверено |
|---|---|---|
| Цифры +5.72 / €656K / +9.2 / €227K / 12→41 / 2ч→5мин | Verified | `src/lib/metrics.ts` — single source of truth, guarded `tests/lib/metrics.test.ts` |
| CUPED, AA-тесты, ship-gates заявлены на сайте | Verified | `value.astro:65` |
| Стек dbt / Supabase / Streamlit / PostHog присутствует в кейсах | Verified | `grep -rli` по `src/content/`: dbt 2 файла, Supabase 8, Streamlit 12, PostHog 6, CUPED 12, AA-тест 4, ship-gate 5, scipy 53, statsmodels 50 |
| Формулировки пунктов 1–5 | Not verified | это черновик; проверяются владельцем на соответствие реальным вакансиям |
| EN-формулировки | Not verified | требуют вычитки на естественность носителем |

---

## Что нужно от владельца

1. Утвердить или переписать пункты 1–5.
2. Подтвердить, что пункт 4 (стек) соответствует вакансиям, на которые идёт отклик.
3. Решить, нужен ли пункт про PhD (сейчас вынесен в отдельную задачу C5 — не дублировать здесь).
4. После утверждения: правка идёт **в оба языка** одной задачей, иначе появится
   ровно тот рассинхрон, который PRD v8 §2.1 признал проблемой.

## Отменяется, если

Ничего не отменяется — задача за гейтом, но не под условием отмены.
Условие отмены в PRD v8 есть только у P2-1 (`audience`).
