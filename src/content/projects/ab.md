---
title: A/B Testing Methodology Toolkit
description: "15 модулей A/B-методологии, каждый откалиброван симуляцией: A/A-тест держит Type I error на уровне α, power-кривые показывают реальную мощность."
track: experiments
hero: images/ab.svg
impact:
  - "15 модулей, каждый откалиброван симуляцией: Type I error ≈ α, power-кривые"
  - "CUPED: SE сжимается в ~corr(X,Y)² раз"
  - "Наивный peeking раздувает Type I error — Pocock/OBF и mSPRT держат его под контролем"
  - "Delta-method даёт корректный SE для ratio-метрик (CTR, RPC) — наивный per-unit t-test смещён"
  - "End-to-end pipeline: SRM → CUPED → delta-method CTR → сегментные ATE + BH → novelty check"
tools:
  - Python
  - NumPy / SciPy
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/ab_test
updated: 2026-09-17
related:
  - /projects/volta/
caseStudy:
  problem: "Методы A/B-тестирования продаются на асимптотических обещаниях, но никто не проверяет Type I error под нулевой гипотезой и power под реальным эффектом. Наивный peeking, неправильный SE для ratio-метрик и множественное тестирование молча ломают решения."
  approach: "Каждый модуль реализован из первичной литературы и откалиброван симуляцией: A/A-проверка на Type I error ≈ α и power-кривая под эффектом. Покрыты 15 тем — SRM, sizing, CUPED, delta-method, alpha-spending (Pocock/OBF), mSPRT, sequential ratio, Bayesian A/B, bootstrap BCa, HTE, Bonferroni/BH, novelty/primacy, switchback. Всё связано в end-to-end pipeline: SRM → CUPED → CTR test → сегментные ATE с BH → novelty check → отчёт."
  result: "Числа проверены, а не предполагаются: тестовый набор ассертит Type I error ≈ α для каждого метода, покрытие CI ≈ 95% для bootstrap, контроль peeking для always-valid/alpha-spending, точность delta-method для ratio-метрик и корректность на known-answer фикстурах."
  metrics:
    - label: "Модулей"
      value: "15"
    - label: "Проверок Type I error"
      value: "A/A для каждого"
    - label: "SE reduction (CUPED)"
      value: "~corr(X,Y)²"
    - label: "Контроль peeking"
      value: "Pocock/OBF, mSPRT"
---

# A/B Testing Methodology Toolkit

## Контекст

Метод A/B-теста настолько же хорош, насколько хороши его ошибки первого рода под нулевой гипотезой и мощность под реальным эффектом. Вместо того чтобы доверять асимптотическим обещаниям, каждый модуль этого тулкита симулирует пайплайн end-to-end и сообщает эмпирические частоты.

## Данные и метод

### Модули

| Модуль | Метод | Что показывает демо |
|--------|-------|---------------------|
| `srm_test.py` | Sample Ratio Mismatch (χ²) | ловит бакинг-баги до любых downstream-тестов |
| `sample_size.py` | Fixed-horizon sizing | n/arm для пропорций и средних |
| `delta_method_ratio.py` | Ratio-метрики (CTR, RPC) | корректный SE для ΣY/ΣX; наивный per-unit t-test смещён |
| `cuped.py` | Variance reduction | SE ↓ в ~corr(X,Y)² за счёт pre-period |
| `group_sequential.py` | Alpha-spending границы | Pocock/OBF держат Type I, пока наивный peeking его раздувает |
| `msprt_always_valid.py` | Always-valid p-values | mSPRT позволяет смотреть и останавливаться когда угодно |
| `sequential_ratio.py` | Sequential ratio-метрики | delta-method + mSPRT для CTR под мониторингом |
| `sequential_ab_testing.py` | Sequential rule Эвана Миллера | воспроизводит таблицу размеров, валидирует Type I/power, экономию выборки |
| `bayesian_ab_test.py` | Analytic Bayesian A/B | Beta-Binomial / Normal-Normal, P(B>A), expected loss, ROPE |
| `bootstrap_ci.py` | Bootstrap CI | percentile и BCa для скошенных метрик |
| `heterogeneous_treatment_effects.py` | HTE по сегментам | interaction-модель ловит Simpson-подобное зануление |
| `multiple_comparisons.py` | Множественное тестирование | Bonferroni (FWER) vs Benjamini-Hochberg (FDR) |
| `novelty_primacy.py` | Time-varying effects | treat×day interaction ловит novelty decay / primacy growth |
| `switchback.py` | Cluster & switchback | cluster-robust SE; carryover bias |
| `test_simulator.py` | Generic calibration | любой DGP + тест → эмпирические Type I и power |

### Сквозной пайплайн

`scripts/run_full_pipeline.py` связывает модули в один реалистичный сценарий на синтетических данных: SRM check → CUPED → delta-method CTR test → per-segment ATE с BH-коррекцией → novelty check → markdown-отчёт в `outputs/report.md`.

### Философия тестирования

Тестовый набор перепрогоняет каждую калибровку с ассертами:

- Type I error ≈ α (± tolerance) для каждого метода под его нулевой гипотезой;
- покрытие CI ≈ 95% для bootstrap;
- наивный peeking раздувает Type I, always-valid / alpha-spending контролируют его;
- наивный per-unit SE для ratio-метрик неточен, delta-method точен;
- корректность на known-answer фикстурах (SRM splits, сегментные uplift-ы).

### Запуск

```bash
uv sync --all-groups
uv run pytest                 # calibration test suite
uv run python scripts/run_full_pipeline.py   # end-to-end demo → outputs/report.md
```

## Эффект

- **15 калиброванных модулей** — от SRM до switchback, каждый с A/A-проверкой.
- **Числа проверены** — Type I ≈ α, coverage ≈ 95%, контроль peeking.
- **Ratio-метрики без смещения** — delta-method вместо наивного per-unit t-test.
- **Связный pipeline** — от SRM-проверки до сегментных ATE и novelty check.

## Документация

- [GitHub → ab_test](https://github.com/NikitaBoyarkin/ab_test)