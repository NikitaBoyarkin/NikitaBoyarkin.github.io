---
title: "Volta — Assisted CAC vs LTV"
description: "Окупается ли trust-трек 45+: LTV/CAC 45+ = 0,66 при гейте ≥3; assisted CAC €120 в ~3× дороже реферала и не окупается (payback 50 мес)."
part: assisted-cac
order: 18
impact:
  - "45+ LTV/CAC 0,66 (гейт ≥3)"
  - "Якорь проходит 3,62 только на реферале"
  - "Assisted CAC €120; payback 50 мес"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "assisted-ltv-cac"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Assisted CAC vs LTV

## Контекст

Первый проект слоя валидации RAT v2: рекомендация v1 «отдельный trust-трек для 45+» проверяется деньгами.

## Данные и метод

- LTV на пользователя (ARPU × маржа вклада × месяцы удержания).
- Blended CAC по сегменту × каналу, LTV/CAC с bootstrap-ДИ, payback.
- Welch t-test якорь vs 45+ по assisted-LTV.

## Выводы

- **Якорь** проходит гейт ≥3 только через реферал: LTV/CAC **3,62**.
- **45+** не проходит гейт ни на одном канале: assisted **0,41**; blended 45+ **0,66**.
- Assisted даёт лучший retention (churn ×0,75), но CAC €120 перекрывает выигрыш — **payback 50 мес**.
- Welch t-test: якорь − 45+ = **€43,99** (p≈2e-13).

## Рекомендации

- Рекомендация v1 «trust-трек» верна по направлению, но пока не по карману — держать (Hold).
- Снижать assisted CAC (удалённый видео-KYC, партнёрское разделение затрат).
- Сочетать с рычагом монетизации 45+ до масштабирования.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
