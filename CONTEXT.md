# Portfolio Site (NikitaBoyarkin.github.io)

Персональный портфолио-сайт продуктового/data-аналитика: статический Astro, GitHub Pages, PostHog-аналитика. Этот контекст описывает язык конверсионной поверхности главной и метрик.

## Конверсионная поверхность

**Capabilities surface**:
Конверсионная «concrete»-поверхность главной, показывающая конкретные результаты (не абстрактные бейджи). Исторически — CapabilitiesGrid (удалён, ADR-0001); сейчас — featured project card + bento + доска проектов.
_Avoid_: skill grid, capabilities grid, бейджи навыков

**Featured project**:
Карточка флагманского кейса в hero (сейчас Volta Neobank — публичный `volta-banking`), несущая основной «concrete»-сигнал главной. Событие `featured_project`. С 16.09 флагман должен указывать на публичное репо (приватные репо не занимают featured-позицию).
_Avoid_: hero project, showcase card

**Bento**:
Сетка секций главной под hero: CareerSnapshot, Stack, Knowledge Graph, Notes, ReadingBlock. События `bento_stack`/`bento_graph`/`bento_notes`.
_Avoid_: bento grid (только имя секции), dashboard

## Контакт и CTA

**Hero CTA**:
Primary-действие в hero: «Смотреть проекты» / «See my work» (событие `hero_projects`). Вторичные — «Связаться» (`hero_contact`), «CV» (`cv_download_pdf` — скачивание PDF). Компонент детерминирован (A/B `hero_cta_variant` снят 13.09).
_Avoid_: hero CTA variant, A/B CTA

**Contact action**:
Любое событие, означающее контакт-инициативу: `cv_download_pdf` (единая кнопка «CV» → PDF), `github_footer`, `linkedin_footer`. `hero_projects` контактом НЕ является (переход в проекты). Это click-уровень (что нажали), а не исход контакта — исход ведётся в **Contact stage**.
_Avoid_: click, conversion event (неспецифично)

**Contact stage**:
Исходная стадия контакта в воронке найма, дополняющая click-уровень **Contact action**: `contact` (первое входящее сообщение рекрутера/нанимающего) → `screening` (скрининг/HR-звонок/тест) → `interview` (предметное интервью) → `final` (финальный раунд) → `offer`; терминальная — `rejected`. Ведётся вручную в `docs/contact-log.md` (PRD v7, V0.1). `contact` — leading, `final`/`offer` — lagging.
_Avoid_: contact action (это клики сайта, не исход), click

**Staged contacts log**:
Ручной лог входящих контактов (`docs/contact-log.md`) со схемой `date | source | company | segment | stage | evidence | next action`. Различает контакт, дошедший до скрина, и контакт, дошедший до финала — то, чего не может click-уровень `Contact action`.
_Avoid_: contact form (это форма на сайте), CRM

## Метрики

**Traffic gate**:
Порог ≥100 уник. визитов/90д, ниже которого конверсионные метрики статистически незначимы. Ниже порога конверсия трекается, но не принимаются решения (track-only).
_Avoid_: порог значимости (общий термин)

**Track-only metric**:
Метрика, которая мониторится, но не гейтит решений, пока выборка не набрана.
_Avoid_: watch metric, KP-флаг

## Система портфолио (скоуп v5)

**Portfolio system**:
Совокупность поверхностей, которыми управляет v5: сайт + репозитории проектов (root `00 portfolio/`) + GitHub-профиль (`NikitaBoyarkin/`) + CV (`cv/`) + дистрибуция. PRD v1–v4 управляли только сайтом.
_Avoid_: сайт (когда речь о всей системе)

**Red flag (F1–F7)**:
Доверие-ломающий артефакт в системе портфолио: флагман, указывающий на приватный репо (лечится переключением на публичный), карточка на заглушку, пустое репо, сломанное имя папки, пустой README при живом коде. Полный перечень — PRD v5 §2.2. Приватные репо сами по себе не red flag, если не в featured-позиции.
_Avoid_: технический долг, недоделка

**North Star (контакты рекрутеров/мес)**:
Число контакт-инициатив от рекрутеров/нанимающих в месяц — прямая цель профиля (Goal 14). С v7 двухуровневая: `contact` (leading, ручной **Staged contacts log**) + `final`/`offer` (lagging, абсолютный счёт). Измеряется PostHog-дашбордом + ручным логом входящих контактов, не только кликами сайта.
_Avoid_: цель-конверсия (это Goal 10)

**Synthetic-as-feature**:
Подача синтетических (seeded, воспроизводимых) данных как намеренного свойства кейсов («без NDA, всё перепроверяемо»), а не как скрываемого ограничения. Связано с честным career-change позиционированием.
_Avoid_: фейковые данные, симуляция

**Distribution loop**:
Управляемый контур охвата (Phase 12): каналы LinkedIn + hh.ru + GitHub-профиль, каждая публикация с UTM, атрибуция в PostHog, фокус на 1 канал по данным 30-го дня.
_Avoid_: контент-план (это только REQ-051)

**Career-change positioning**:
Честный нарратив «психология → аналитика»: PhD по психологии труда как дифференциатор (понимание пользователя, исследовательская строгость), заявленный опыт подкреплён разделами CV, а не только саммари.
_Avoid_: «4+ года опыта» без раздела «Опыт работы»

## Volta: структура (v8)

**Project map (Volta)**:
Секция `## Карта проекта` / `## Project map` на хабе Volta — **23** подпроекта, сгруппированные по слоям `core | extended | market-jobs | rat-v2 | causal`. Генерируется из коллекции `volta-parts` скриптом `bun run volta:map` (`scripts/gen-volta-map.mjs`), не пишется руками. На part-страницах слой виден как метка и в навигации (prev/next по `order`).
_Avoid_: досье (это part-страница, не карта), оглавление

**Volta layer**:
Поле `layer` в `voltaPartSchema` — машинночитаемый слой подпроекта: `core` (петля 1–4), `extended` (5–12), `market-jobs` (13–17), `rat-v2` (18–22), `causal` (23, `causal-kyc`). Заменяет prose-таксономию из хаба.
_Avoid_: категория, track (это поле проектов, не частей)

**Curated hub charts**:
Хаб Volta показывает 6 отобранных графиков (`onboarding-funnel`, `kyc-ab-conversion`, `cohort-retention-heatmap`, `retention-pre-post`, `segmentation-size-vs-revenue`, `segmentation-pareto-cumulative`); остальные графики живут на своих part-страницах. Введено PRD v8 (`docs/prd-volta-structure.md`), baseline был 34.
_Avoid_: все графики на хабе