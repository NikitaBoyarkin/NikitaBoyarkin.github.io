// «Сейчас» — what is actually in progress. One source, three surfaces: the
// "Сейчас"/"Now" tab on `/about/`, the bento card on `/`, and the same card in
// the colleague landing's bento grid.
//
// Why a module and not prose: these five lines used to live as bullets inside
// `src/content/about/{ru,en}.mdx`. A card that restated them would be a second
// copy of a list whose whole value is being current — the exact drift this repo
// fights everywhere else (`metrics.ts`, `NowReading`, `library.ts`). The MDX tab
// now renders the same array, so a line is edited once or not at all.
//
// `updated` is a literal, not a clock: a "now" page that claims freshness it
// cannot prove is worse than a dated one. Nothing enforces the date — a test
// cannot know when the list actually changed — so the rule is stated here and
// the visible date makes a stale card self-evident to the reader.

export type Lang = 'ru' | 'en';

export interface NowContent {
  /** Human-readable "last touched" date, shown above the list. */
  updated: string;
  /** Eyebrow for the bento cell. The /about/ tab carries its own <h2>. */
  title: string;
  /** Link label out of the card. */
  more: string;
  /** The list itself, newest concern first. */
  items: readonly string[];
}

export const NOW: Record<Lang, NowContent> = {
  ru: {
    updated: '11 октября 2026',
    title: 'Сейчас',
    more: 'Подробнее →',
    items: [
      'Развиваю этот сайт: личностный слой, граф знаний, аркада из 10 мини-игр.',
      'Поддерживаю Obsidian knowledge base по product analytics — структурированный Zettelkasten с автоматизацией.',
      'Готовлюсь к BI / Data Analyst и Product Analyst junior-интервью: SQL, pandas, алгоритмы, моки.',
      'Экспериментирую с AI-assisted аналитическими workflow на Claude Code + MCP.',
      'Пишу о практических data-техниках: A/B-тестирование, когортный анализ, RFM-сегментация.',
    ],
  },
  en: {
    updated: 'October 11, 2026',
    title: 'Now',
    more: 'Read more →',
    items: [
      'Building out this site: the personal layer, the knowledge graph, a 10-mini-game arcade.',
      'Maintaining an Obsidian knowledge base on product analytics — a structured Zettelkasten with automation.',
      'Preparing for BI / Data Analyst and Product Analyst junior-level interviews: SQL, pandas, algorithms, mocks.',
      'Experimenting with AI-assisted analytical workflows on Claude Code + MCP.',
      'Writing about practical data techniques: A/B testing, cohort analysis, RFM segmentation.',
    ],
  },
};
