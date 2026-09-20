---
title: "Volta — Анализ воронки"
description: "Воронка онбординга необанка: KYC — узкое место с 56,6% step conversion, регистрация теряет больше всех в абсолюте (2 682). Разбивка по каналам и платформам."
part: funnel
order: 1
layer: core
impact:
  - "KYC Complete — крупнейший относительный провал (56,6%)"
  - "Registration — крупнейший абсолютный провал (2 682, 73,2%)"
  - "Referral +11,7 п.п. к paid social; iOS 13,6% против Android 11,7%"
tools:
  - "Python"
  - "pandas / NumPy"
  - "SciPy / Statsmodels"
  - "scikit-learn"
  - "Matplotlib / Seaborn"
  - "uv + ruff"
charts:
  - "onboarding-funnel"
  - "funnel-waterfall"
  - "funnel-age-heatmap"
  - "channel-end-to-end-conversion"
github: https://github.com/NikitaBoyarkin/volta-banking
---

# Volta — Анализ воронки

## Контекст

Первый проект петли **discover**: найти, где необанк «Volta» теряет пользователей в онбординге. Данные синтетические, seeded-генератор → воспроизводимые CSV.

## Данные и метод

- Step conversion и absolute/relative drop-off по каждому шагу воронки (Install → Registration → KYC → Card → First TX).
- Chi-square тест различий каналов привлечения.
- Сравнение платформ (iOS vs Android) и каналов (referral vs paid social) на каждом шаге.

## Выводы

- **KYC Complete** — наибольший относительный отток: **56,6% step conversion** (2 781 из 4 917).
- **Registration** — наибольшая абсолютная потеря: **2 682 пользователя, 73,2% step conv**.
- **Referral** конвертит на **+11,7 п.п.** лучше paid social; **iOS** обгоняет Android (**13,6% против 11,7%**).
- До первой транзакции доходят лишь **1 269 из 10 000** (12,7%) — воронка теряет ~87%.

## Рекомендации

- Переработать UX KYC — прогресс-бар (валидирован в Project 2), подсказки по фото в реальном времени.
- Упростить регистрацию — A/B-тест на удаление поля номера телефона (крупнейшая абсолютная потеря).
- Усилить реферал и перераспределить 15% бюджета paid social.
- Спринт под Android — QA-аудит для закрытия разрыва с iOS.

## Документация

- [GitHub → volta-banking](https://github.com/NikitaBoyarkin/volta-banking)
