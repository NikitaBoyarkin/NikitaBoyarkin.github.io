# Portfolio Site (NikitaBoyarkin.github.io)

Персональный портфолио-сайт продуктового/data-аналитика: статический Astro, GitHub Pages, PostHog-аналитика. Этот контекст описывает язык конверсионной поверхности главной, CTA и метрик трафика.

Системные термины (членство, доктрина, воронка найма, позиционирование) переехали в корневой контекст `../CONTEXT.md`; термины Volta — в `../volta-banking/CONTEXT.md`. См. таблицу в конце файла.

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
Любое событие, означающее контакт-инициативу: `cv_download_pdf` (единая кнопка «CV» → PDF), `github_footer`, `linkedin_footer`. `hero_projects` контактом НЕ является (переход в проекты). Это click-уровень (что нажали), а не исход контакта — исход ведётся в **Contact stage** (корневой контекст).
_Avoid_: click, conversion event (неспецифично)

## Метрики

**Traffic gate**:
Порог ≥100 уник. визитов/90д, ниже которого конверсионные метрики статистически незначимы. Ниже порога конверсия трекается, но не принимаются решения (track-only).
_Avoid_: порог значимости (общий термин)

## Переехавшие термины (указатели)

Разделы не удалены намеренно: сайтовые PRD ссылаются на термины по имени этого файла (`CONTEXT.md` North Star → `docs/prd-volta-structure.md:151`, `CONTEXT.md` red flag class → `docs/prd-volta-structure.md:97`). Указатель разрешает ссылку и называет нового владельца. **Не дочищать.** Основание: ADR-0006 в корне коллекции.

| Термин | Где теперь |
|---|---|
| Portfolio system | `../CONTEXT.md` |
| Red flag (F-флаг) | `../CONTEXT.md` |
| North Star (контакты рекрутёров/мес) | `../CONTEXT.md` |
| Contact stage | `../CONTEXT.md` |
| Staged contacts log | `../CONTEXT.md` |
| Track-only metric | `../CONTEXT.md` |
| Distribution loop | `../CONTEXT.md` |
| Career-change positioning | `../CONTEXT.md` |
| Synthetic-as-feature | `../CONTEXT.md` |
| Project map (Volta) | `../volta-banking/CONTEXT.md` |
| Volta layer | `../volta-banking/CONTEXT.md` |
| Curated hub charts | `../volta-banking/CONTEXT.md` |
