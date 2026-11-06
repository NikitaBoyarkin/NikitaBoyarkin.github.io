---
title: "Feature Impact: как измерить влияние фичи, когда A/B невозможен"
date: 2026-08-27
category: guide
image: /images/og/feature-impact-analysis.png
tags:
  - causal-inference
  - feature-impact
  - ab-testing
  - statistics
excerpt: "Когда фича уже запущена или рандомизация невозможна, A/B-тест молчит. Causal-фреймворк — CUPED, DiD, synthetic control, propensity matching — позволяет выделить чистый эффект фичи из observational данных и не принять self-selection за пользу."
related:
  - /posts/ab-calibration-simulation/
  - /posts/bayesian-ab-testing/
  - /projects/volta/
keywords:
  - feature impact анализ
  - causal inference product
  - difference in differences
  - synthetic control
  - CUPED
draft: false
---

## Кратко

Фича выпущена на 100 % пользователей, A/B-тест не проводился, а продакт-менеджер спрашивает: «она дала что-нибудь?» Обычный ответ — посмотреть adoption rate и retention тех, кто фичей воспользовался.

Это и есть self-selection bias: пользователи, которые нашли и включили фичу сами, почти всегда сильнее вовлечены, чем те, кто не включил.

Разница в retention — это не эффект фичи, это разница между двумя типами пользователей.

Feature Impact Analysis — это методологический фреймворк, который разделяет причинный эффект фичи и смещение отбора.

Когда чистый A/B невозможен (фича уже в проде, есть network effects, этические или юридические ограничения на рандомизацию), на сцену выходят методы causal inference.

Набор такой: CUPED для повышения чувствительности метрик, propensity matching для балансировки групп, difference-in-differences для staggered rollout, synthetic control для geo-экспериментов, uplift modeling для гетерогенных эффектов. Ниже — как выбрать метод под кейс и какие ловушки ждут на каждом шаге.

## Зачем нужен causal-фреймворк

Четыре риска, которые делают наивный pre/post или «сравнение adoption» непригодными для решений:

- **Self-selection bias.** Пользователи, которые сами нашли фичу, систематически отличаются по мотивации, engagement и LTV. Наблюдаемая разница в метриках — смесь эффекта фичи и разницы между типами пользователей.
- **Winner's curse.** Если решения принимаются только по «победителям» A/B-тестов, агрегированная оценка эффекта завышена: публикуются крупные положительные результаты, а нулевые и отрицательные остаются в столе.
- **Proxy metric trap.** Оптимизация под промежуточную метрику (CTR, session depth) вредит North Star — классический Goodhart's Law. Spotify прямо предупреждает: short-term proxy win не гарантирует рост North Star.
- **Непреднамеренный вред.** Локальная победа по целевой метрике может ломать guardrail-метрики: revenue, latency, NPS, error rate. Без guardrails вы узнаете об ущербе post factum.

## Иерархия метрик и повышение чувствительности

До того как выбирать метод оценки, надо понять, какую метрику оцениваем. North Star (Time Spent Listening у Spotify, Nights Booked у Airbnb) измеряется кварталами — для спринта она бесполезна. Experiment metric (OEC) должна быть чувствительной, валидной как прокси и быстрой: эффект виден за неделю, а не за квартал.

| Слой | Пример | Время обнаружения | Владелец |
|------|--------|-------------------|----------|
| North Star | Weekly Active Pinners, Nights Booked | Квартал/год | CPO |
| Input metrics | Onboarding completion, invites sent | Месяц | Продуктовая команда |
| Experiment metric (OEC) | Streaming hours, active days per user | Неделя/спринт | Data Analyst |
| Guardrail metrics | Revenue, latency, SRM, NPS | Неделя | Platform/Trust |
| Counter metrics | Support tickets, chargebacks | Месяц | Ops/Finance |

Чувствительность метрики можно поднять ещё до выбора метода. CUPED (Controlled-experiment Using Pre-Experiment Data) уменьшает дисперсию за счёт ковариат из pre-period: если ρ — корреляция ковариата с метрикой, дисперсия эффекта падает в `(1 − ρ²)` раз. При ρ = 0.7 SE сокращается примерно на 29 % — эквивалентно двойному объёму выборки без её роста.

MLRATE (Meta) делает то же через ML-based regression adjustment, а learned composite metrics (ShareChat/Moj, KDD 2024) дают до 78 % прироста power относительно delayed North Star. Triggered analysis (LinkedIn XLNT) ограничивает анализ только реально exposed пользователями, отсекая шум от тех, до кого фича не дошла.

## Дерево выбора метода

Метод оценки зависит от структуры данных, а не от предпочтений. Первичный вопрос — можно ли рандомизировать чисто.

```
Можно ли сделать A/B-тест?
├── ДА → Стандартный A/B (t-test / CUPED / MLRATE)
│   ├── Нужна гетерогенность? → Causal Forest (EconML), Uplift (CausalML)
│   └── Network effects? → Cluster-randomized experiment
│
└── НЕТ (фича уже запущена, рандомизация невозможна)
    ├── Staggered rollout? → Difference-in-Differences (Callaway & Sant'Anna)
    ├── Один treated geo + доноры? → Synthetic Control
    ├── Sharp threshold? → Regression Discontinuity Design
    ├── Можно randomize encouragement? → Encouragement Design + IV
    └── Богатые pre-treatment ковариаты? → Propensity Score Matching / Weighting
```

Каждый метод имеет ключевое допущение, которое либо выполняется, либо нет — третьего не дано. PSM требует unconfoundedness (все конфаундеры измерены) и overlap. DiD требует parallel trends и no anticipation. Synthetic Control требует, чтобы доноры были в convex hull и не подвергались spillover.

IV требует relevance, exclusion restriction, independence и monotonicity — валидные инструменты редки, и метод оценивает LATE (на compliers), а не ATE.

## Propensity Score Matching: балансировка observational данных

Когда фича opt-in и есть богатые pre-treatment ковариаты, PSM строит синтетический контроль: каждому пользователю, включившему фичу, подбирается похожий пользователь из контрольной группы по propensity score — вероятности быть treated при данных ковариатах.

```python
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import NearestNeighbors

covariates = ['age', 'income', 'tenure_days', 'engagement_score']
ps_model = LogisticRegression(max_iter=1000)
ps_model.fit(df[covariates], df['treatment'])
df['propensity_score'] = ps_model.predict_proba(df[covariates])[:, 1]

# Caliper = 0.2 * SD(logit propensity) — стандартная эвристика
logit_ps = np.log(df['propensity_score'] / (1 - df['propensity_score']))
caliper = 0.2 * np.std(logit_ps)

treated = df[df['treatment'] == 1].copy()
control = df[df['treatment'] == 0].copy()
nn = NearestNeighbors(n_neighbors=1)
nn.fit(control[['propensity_score']])
distances, indices = nn.kneighbors(treated[['propensity_score']])
mask = distances.flatten() <= caliper

matched_df = pd.concat([treated[mask], control.iloc[indices.flatten()][mask]])
att = (
    matched_df[matched_df['treatment'] == 1]['outcome'].mean()
    - matched_df[matched_df['treatment'] == 0]['outcome'].mean()
)
print(f"ATT = {att:.4f}")
```

Ключевые правила: никаких post-treatment переменных в propensity model — это сразу ломает идентификацию. Обязательная проверка common support: если propensity у treated 0.7–0.9, а у control 0.1–0.3 — overlap нет, trim. И balance diagnostics до и после matching: standardized mean difference по каждому ковариату должна упасть ниже 0.1.

Версия с весами (IPW) вместо matching:

```python
df['ipw'] = np.where(
    df['treatment'] == 1,
    1 / df['propensity_score'],
    1 / (1 - df['propensity_score']),
)
ate_ipw = (
    (df['outcome'] * df['ipw'] * df['treatment']).sum() / (df['ipw'] * df['treatment']).sum()
    - (df['outcome'] * df['ipw'] * (1 - df['treatment'])).sum()
      / (df['ipw'] * (1 - df['treatment'])).sum()
)
```

PSM оценивает ATT (средний эффект на treated), а не ATE. Это надо явно проговаривать в отчёте: вопрос был «фича помогла тем, кто ей воспользовался?», а не «фича помогла бы случайному пользователю?».

## Difference-in-Differences при staggered rollout

Если фича раскатывалась по когортам в разное время (страны, сегменты, платформы), работает DiD: сравниваем изменение метрики до и после между treated и control когортами.

Классическая TWFE-регрессия (`outcome ~ treated + post + treated*post`) при staggered adoption даёт biased оценки из-за «forbidden comparisons» (Goodman-Bacon 2021) — уже treated когорты используются как контроль для newly treated.

Решение — современные оценки: Callaway & Sant'Anna (2021) или Borusyak-Jaravel-Spiess (2024).

```python
import statsmodels.formula.api as smf

df['did_term'] = df['treated'] * df['post']
model = smf.ols('outcome ~ treated + post + did_term', data=df).fit(
    cov_type='cluster',
    cov_kwds={'groups': df['user_id']},  # cluster SE на уровне assignment
)
# Коэффициент did_term — это ATT
```

Для staggered rollout — `diff-diff` с оценкой Callaway & Sant'Anna:

```python
from diff_diff import CallawaySantAnna

cs = CallawaySantAnna()
results = cs.fit(
    panel_data,
    outcome='revenue',
    unit='user_id',
    time='week',
    first_treat='first_exposure_week',  # 0 = never treated
    aggregate='event_study',
)
results.print_summary()
```

Обязательная проверка — pre-trend placebo: коэффициенты DiD за периоды до treatment должны быть около нуля. Если «эффект» виден до запуска фичи, parallel trends нарушена и вся оценка недействительна.

## Synthetic Control для geo-экспериментов

Один treated geo (страна, регион, город) и несколько donor-гео, не подвергавшихся воздействию, — сценарий для synthetic control. Метод строит взвешенную комбинацию доноров, которая до treatment максимально точно воспроизводит метрику treated, и сравнивает с фактом после.

Discord применял SCM для Voice Messages (Бразилия vs Synthetic Brazil), Glovo — для алгоритма ранжирования курьеров в Констанце, PayPal — для Delta CV.

Ключевые ограничения: доноры не должны быть подвержены spillover (если фича в Бразилии перетекает в Аргентину через общих пользователей, synthetic Brazil contaminated), pre-period должен быть достаточно длинным, а результат локален — экстраполировать на другие рынки нельзя.

Placebo-тест: поочерёдно притвориться, что каждый donor — treated, и проверить, что истинный treated действительно выделяется на фоне распределения placebo-эффектов.

## Гетерогенность: кому фича помогает, а кому вредит

Средний эффект — это половина ответа. Вторая половина — для кого фича работает. Uplift modeling (CausalML) и Causal Forest (EconML) оценивают CATE — условный средний эффект по сегментам, и отвечают на бизнес-вопрос «кому показывать фичу?».

```python
from econml.dml import CausalForestDML
from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier

est = CausalForestDML(
    model_y=GradientBoostingRegressor(),
    model_t=GradientBoostingClassifier(),
    discrete_treatment=True,
    cv=5,
)
est.fit(df[y_name], df[t_name], X=df[x_names])
treatment_effects = est.effect(df[x_names])
lb, ub = est.effect_interval(df[x_names])
```

Uplift Random Forest из CausalML даёт Qini-кривую: насколько uplift-модель лучше случайного таргетинга. Если Qini score положительный и стабильный на holdout, имеет смысл показывать фичу только сегменту с положительным предсказанным uplift, а для сегмента с отрицательным — скрыть. Это превращает аналитический вывод в продуктовую политику.

## Guardrail-метрики и валидация

Любой causal-анализ без guardrails — это оптимизация вслепую. Airbnb сообщает: ~25 экспериментов в месяц флагаются guardrails, ~20 % останавливаются.

Meta использует SRM (Sample Ratio Mismatch) как trust guardrail — если фактическое соотношение групп отличается от ожидаемого, эксперимент невалиден до выяснения.

При observational оценке аналогичные guardrails: проверяйте, что нет регресса по revenue, latency, error rate, NPS.

Робастность оценки проверяется тремя способами:

- **Placebo / falsification tests.** Pre-trend placebo для DiD, donor placebo для SCM, fake cutoff для RDD, A/A для ML counterfactual. Если метод находит «эффект» там, где его не может быть, метод сломан.
- **Sensitivity analysis.** Rosenbaum bounds: насколько сильным должен быть unmeasured confounder, чтобы перевернуть результат. Oster bounds: степень selection on unobservables относительно observables.
- **DoWhy refutation.** Подмена treatment случайной переменной, удаление случайной подвыборки, placebo common cause — если оценка «прыгает» при этом, её нельзя доверять.

Исследование Twitter/X (2021) показало, что стандартные observational методы (matching, regression adjustment, IPTW) в большинстве случаев даже знак эффекта предсказывают неверно относительно ground-truth RCT. Вывод: observational estimates всегда валидируются через placebo tests и sensitivity analysis, а решение принимается с учётом уязвимости оценки.

## Фреймворк решений

Когда оценка получена, решение не сводится к «эффект положительный → запускать». Решающая матрица:

| Сценарий | Действие |
|----------|----------|
| Эксперимент: эффект положительный + guardrails чистые | Запускать на 100 % |
| Эксперимент: эффект положительный + guardrails в минусе | Эскалация; severity revenue/latency = stop |
| Эксперимент: эффект нулевой, но positive CATE для сегмента | Таргетированный запуск (uplift modeling) |
| Observational: positive, но sensitivity уязвима | Не запускать на 100 %; собрать больше данных или validation A/B |
| Observational: positive + robust + совпадает с business logic | Запуск с 5–10 % holdback-группой на 30–90 дней |

Holdback-группа — единственный честный способ подтвердить observational оценку: держим 5–10 % пользователей без фичи 30–90 дней и сравниваем. Если наблюдаемый эффект совпадает с предсказанным, фича остаётся; если расходится — откатываем.

## Выводы

- A/B-тест остаётся золотым стандартом. Если можно рандомизировать чисто, никакой causal-метод не даст большей валидности. Causal inference — это инструмент для случая, когда A/B невозможен, а не замена ему.
- Self-selection bias — главный враг observational анализа. Разница между теми, кто сам включил фичу, и теми, кто не включил, почти никогда не равна эффекту фичи. Игнорировать это — значит систематически завышать ценность фич.
- Modern DiD обязателен при staggered rollout. Классическая TWFE-регрессия с staggered adoption даёт biased оценки из-за forbidden comparisons. Используйте Callaway & Sant'Anna или Borusyak-Jaravel-Spiess.
- Synthetic Control — выбор для geo-уровня, но с жёсткими ограничениями: доноры не должны подвергаться spillover, pre-period должен быть длинным, а результат локален.
- Uplift modeling отвечает на бизнес-вопрос «кому показывать?». CausalML и EconML позволяют строить таргетированную политику — показывать фичу только сегменту с положительным CATE.
- Guardrail-метрики спасают от локальной оптимизации. Без них вы узнаёте об ущербе revenue или retention post factum. SRM, latency, error rate, NPS — обязательная часть отчёта, а не дополнение.