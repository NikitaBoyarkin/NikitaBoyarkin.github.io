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
Сетка секций главной под hero: CareerSnapshot, Stack, ReadingBlock. События `bento_stack`/`bento_library`.
_Avoid_: bento grid (только имя секции), dashboard

**Shelf tile**:
Плитка источника в `ReadingBlock`: монограмма, метка «kind · status», название, автор и — если у источника есть URL — внешняя ссылка рядом (не внутри: вложенный `<a>` невалиден). События `library_tile` (переход на страницу источника) и `source_external` (уход на внешний URL).
_Avoid_: book card, library item

**Source kind**:
Закрытый набор: `book`, `course`, `paper`, `talk`. Источник истины — `SOURCE_KINDS` в `src/lib/source.ts`; Zod-схема берёт значения оттуда, тесты — тоже, поэтому набор нельзя расширить в одном месте.
_Avoid_: type, category, tag

**Source status**:
Закрытый набор: `reading`, `reference`, `done`. Ровно одна запись на полке может быть `reading` — именно её показывает строка «Читаю:» на `/about#now` (`NowReading`), а не отдельно набранный текст.
_Avoid_: progress, state

**Applied in**:
Поле, связывающее источник с проектом, где он применился. Деривативное: страница источника собирается из тела заметки, отдельного поля в frontmatter нет — расхождение невозможно.
_Avoid_: used_in, projects

## Контакт и CTA

**Hero CTA**:
CTA-строки в hero больше нет (удалена вместе с компонентом `HeroCta`); «concrete»-сигнал hero несёт featured project card (событие `featured_project`), а единственная CTA-кнопка, оставшаяся на всех страницах, — «CV» (`cv_download_pdf` — скачивание PDF). A/B `hero_cta_variant` снят 13.09.
_Avoid_: hero CTA variant, A/B CTA

**Contact action**:
Любое событие, означающее контакт-инициативу: `cv_download_pdf` (единая кнопка «CV» → PDF), `github_footer`, `linkedin_footer`. Переходы в проекты (`featured_project`, `bento_*`, `headline_all_projects`) контактом НЕ являются. Это click-уровень (что нажали), а не исход контакта — исход ведётся в **Contact stage** (корневой контекст).
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
