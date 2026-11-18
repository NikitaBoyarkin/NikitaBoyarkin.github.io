/**
 * Grouping of a project case body into the tabs of the nested dashboard.
 *
 * The case body is authored as one markdown document whose H2 set is almost
 * frozen: 30 of 31 projects carry exactly Situation / Task / Actions / Result /
 * What-I-learned / Discussion / Limitations / Documentation (and the English
 * mirror of it); `volta` alone adds its own sections. Those eight headings are a
 * long scroll on their own, so they are folded into five semantic groups.
 *
 * This module is the single source of truth for that fold: the page builds its
 * tab bar from `caseTabs(headings)`, and the markdown pipeline
 * (`case-sections-hast.ts`) wraps the rendered runs into panels using
 * `groupForHeading`. Both read the same table, so a tab can never point at a
 * panel that was grouped differently.
 *
 * The table is explicit rather than keyed on a word ("anything containing
 * 'действ'"). A heading is a human-written label; a heuristic that guesses wrong
 * files a section under a tab nobody looks in, and no test would notice. Anything
 * absent lands in `more` — visible, not silently dropped — and
 * `isMappedHeading` lets the test assert every shipped heading is spelled out.
 */
export type CaseGroup = 'context' | 'actions' | 'result' | 'review' | 'docs' | 'more';

export type CaseLang = 'ru' | 'en';

export const CASE_GROUP_ORDER: readonly CaseGroup[] = [
  'context',
  'actions',
  'result',
  'review',
  'docs',
  'more',
];

export const CASE_GROUP_LABELS: Record<CaseLang, Record<CaseGroup, string>> = {
  ru: {
    context: 'Контекст',
    actions: 'Действия',
    result: 'Результат',
    review: 'Разбор',
    docs: 'Документы',
    more: 'Ещё',
  },
  en: {
    context: 'Context',
    actions: 'Actions',
    result: 'Result',
    review: 'Review',
    docs: 'Documentation',
    more: 'More',
  },
};

/** Heading text exactly as authored, lower-cased and dash-normalised: `Улики №1–4`
 *  and `Улики №1-4` must land on the same row. Trailing punctuation is dropped so
 *  an authored `Задача:` still matches. */
export function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[\s:.]+$/, '')
    .trim();
}

const CASE_GROUP_BY_HEADING: Record<CaseLang, Record<string, CaseGroup>> = {
  ru: {
    'итог в 30 секунд': 'context',
    ситуация: 'context',
    задача: 'context',
    действия: 'actions',
    'карта проекта': 'actions',
    'улики №1-4': 'actions',
    'слой rat v2 - валидация собственного аудита': 'actions',
    'рекомендации и гейты': 'actions',
    результат: 'result',
    вердикт: 'result',
    'что я понял': 'review',
    'точки обсуждения': 'review',
    ограничения: 'docs',
    документация: 'docs',
    'интерактивный борд': 'more',
    'остальные проекты': 'more',
  },
  en: {
    'the 30-second version': 'context',
    situation: 'context',
    task: 'context',
    actions: 'actions',
    'project map': 'actions',
    'evidence #1-4': 'actions',
    'the rat v2 layer - validating the audit itself': 'actions',
    'recommendations & gates': 'actions',
    result: 'result',
    'the verdict': 'result',
    'what i learned': 'review',
    'discussion points': 'review',
    limitations: 'docs',
    documentation: 'docs',
    'interactive board': 'more',
    'other projects': 'more',
  },
};

export function groupForHeading(text: string, lang: CaseLang): CaseGroup {
  return CASE_GROUP_BY_HEADING[lang][normalizeHeading(text)] ?? 'more';
}

/** Whether the heading is spelled out in the table, as opposed to falling back
 *  to `more`. Bound by `tests/lib/case-sections.test.ts` over every content file. */
export function isMappedHeading(text: string, lang: CaseLang): boolean {
  return Object.prototype.hasOwnProperty.call(
    CASE_GROUP_BY_HEADING[lang],
    normalizeHeading(text),
  );
}

export interface CaseTab {
  /** Matches the `data-panel` the hast plugin writes: `case-<group>`. */
  id: string;
  label: string;
}

/** Tabs for the groups the body actually has, in `CASE_GROUP_ORDER` — a tab that
 *  opens onto nothing is worse than no tab. */
export function caseTabs(headings: readonly { text: string }[], lang: CaseLang): CaseTab[] {
  const present = new Set(headings.map((h) => groupForHeading(h.text, lang)));
  return CASE_GROUP_ORDER.filter((group) => present.has(group)).map((group) => ({
    id: `case-${group}`,
    label: CASE_GROUP_LABELS[lang][group],
  }));
}
