// Shared project-board configuration for RU/EN locales.
// Single source of truth for the display order and the track (category) taxonomy
// used by ProjectBoard and ProjectSpotlight.

export const PROJECT_ORDER = ['volta', 'ab', 'games', 'supabase', 'posthog', 'streamlit', 'sales-calls', 'sql', 'rfm', 'cohort', 'churn', 'causal', 'rag', 'python', 'bot', 'scrolly', 'garden', 'serp-rank', 'airflow', 'ml', 'linkedin', 'promo', 'site'];

// PRD v6 S2.6 — three headline case studies on the home page, each a distinct
// proof with at least one reachable public artifact:
//   volta  — experimentation + funnel + retention (public repo + demo)
//   sql    — analytics engineering (public repo + live report)
//   cohort — retention / product metrics (public repo + interactive demo)
// Private-repo projects (supabase, posthog, streamlit) stay in the compressed
// list until their S2.1–S2.3 compensating artifacts land; then they can swap in.
export const HEADLINE_PROJECTS = ['volta', 'sql', 'cohort'] as const;

// ---------------------------------------------------------------------------
// Audience taxonomy — `docs/prd-persona-landing.md` §5. The three personas the
// site splits into at the gate (`/`), replacing the never-written
// recruiter|analyst|learner set. The same three literals are mirrored in one
// place that cannot import them — the pre-paint script in `Base.astro` — and
// `tests/lib/projects.test.ts` binds the copy.
// ---------------------------------------------------------------------------

export const AUDIENCES = ['hr', 'manager', 'colleague'] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Landing for a visitor with no stored choice (PRD Q11 — gate never redirects). */
export const DEFAULT_AUDIENCE: Audience = 'colleague';

/**
 * Entry order per role. Slugs must exist in `PROJECT_ORDER`, and every role
 * must list the WHOLE catalogue — a role is an angle on the portfolio, not a
 * filter over it, so no version hides a project (2026-10-11).
 *
 * What changed on 2026-10-20: the angle is the *order*, not the copy. Until
 * then all three roles read `PROJECT_ORDER`, so `/manager/` and `/colleague/`
 * were the same board behind two different headings — a reader switching
 * versions saw the same first card. Now:
 *   - `hr`       reads the chronological list (`ProjectList` + `groupByYear`);
 *   - `manager`  reads results first: the cases with a number to show lead;
 *   - `colleague` reads method first: the toolkits and the causal work lead.
 * `RoleLanding` passes the sequence to `ProjectBoard` with `ordered`, which
 * keeps this order instead of regrouping by track. Membership is still the
 * full catalogue, and `tests/lib/projects.test.ts` binds both invariants.
 *
 * Validity is bound by `tests/lib/projects.test.ts`, not by the type system:
 * `PROJECT_ORDER` is a plain `string[]`, and `as const` would force casts at
 * four call sites (`sortByProjectOrder`, `HeadlineCases.astro`, both
 * `projects/[slug].astro`) for a check a test covers more cheaply.
 */
const RESULT_FIRST: readonly string[] = [
  'volta',
  'ab',
  'cohort',
  'rfm',
  'churn',
  'sql',
  'causal',
  'serp-rank',
  'sales-calls',
  'ml',
  'rag',
  'posthog',
  'supabase',
  'streamlit',
  'airflow',
  'bot',
  'python',
  'games',
  'scrolly',
  'garden',
  'linkedin',
  'promo',
  'site',
];

const METHOD_FIRST: readonly string[] = [
  'ab',
  'sql',
  'causal',
  'serp-rank',
  'rag',
  'cohort',
  'rfm',
  'churn',
  'volta',
  'ml',
  'python',
  'airflow',
  'posthog',
  'supabase',
  'streamlit',
  'sales-calls',
  'games',
  'scrolly',
  'garden',
  'linkedin',
  'promo',
  'bot',
  'site',
];

export const ROLE_CURATION: Record<Audience, readonly string[]> = {
  hr: PROJECT_ORDER,
  manager: RESULT_FIRST,
  colleague: METHOD_FIRST,
};

/** Curated slugs for a role, in display order. */
export function curatedSlugs(role: Audience): readonly string[] {
  return ROLE_CURATION[role];
}

/**
 * Which rows of the STAR skeleton a board card teases (the full four-row block
 * lives on the project page).
 *
 *   - `result`      — outcome only. The default: on the colleague board the card
 *                     is an index entry.
 *   - `task-result` — Task + Result. The manager landing (`/manager/`) reads a
 *                     case as "what was asked → what moved", so the card has to
 *                     state the brief before the number or the number is just a
 *                     claim. `tests/lib/manager-card-star.test.ts` binds it.
 *   - `none`        — no STAR rows; the card falls back to the file's
 *                     `description`. The catalogue board (`/projects/`) uses it:
 *                     with the cover shown, the card is a preview of the work,
 *                     not a verdict on it, and the Result belongs to the case.
 */
export type StarPreview = 'result' | 'task-result' | 'none';

export interface RoleCopy {
  /** `<title>` — the visible page title. */
  title: string;
  /** `<meta name="description">`. */
  description: string;
  /** The hero `<h1>`. Role-specific, so the heading carries the persona. */
  h1: string;
  /** One-line role pitch rendered under the `h1`. */
  lead: string;
}

// Per-role copy for the three landings (PRD §8: HR reads role/stack, a manager
// reads impact/decisions, a colleague reads how it is made). One record, read
// by the route wrappers for the `<Base>` head and by `RoleLanding` for the body.
// The `h1` is role-specific: three pages that all announced "Продуктовый
// аналитик" gave the heading no information (the persona lived only in the small
// role-switch label), so each now names its own angle.
export const ROLE_COPY: Record<'ru' | 'en', Record<Audience, RoleCopy>> = {
  ru: {
    hr: {
      title: 'Никита Бояркин — продуктовый аналитик, найм',
      description:
        'Продуктовый аналитик: 5 лет в исследованиях, SQL, Python, A/B-тесты. Стек и метрики — для скрининга по вакансии.',
      h1: 'Продуктовый аналитик — для найма',
      lead: 'Роль, стек и метрики — чтобы сверить с вакансией.',
    },
    manager: {
      title: 'Никита Бояркин — продуктовый аналитик, результаты',
      description:
        'Кейсы продуктовой аналитики с результатом: +5,72 п.п. KYC-конверсии, retention, RFM-сегментация, причинные эффекты.',
      h1: 'Продуктовый аналитик — результат',
      lead: 'Кейсы с решением и результатом: что изменилось и почему.',
    },
    colleague: {
      title: 'Никита Бояркин | Продуктовый аналитик',
      description:
        'Портфолио Никиты Бояркина — продуктовый аналитик. A/B-тесты и retention: SQL, Python, воспроизводимая методология.',
      h1: 'Продуктовый аналитик — как это сделано',
      lead: 'Код, данные, метод и граф знаний — весь путь до решения.',
    },
  },
  en: {
    hr: {
      title: 'Nikita Boyarkin — Product Analyst, hiring',
      description:
        'Product analyst: 5 years in research, SQL, Python, A/B testing. Stack and metrics — for screening against a vacancy.',
      h1: 'Product Analyst — for hiring',
      lead: 'Role, stack and metrics — to match against a vacancy.',
    },
    manager: {
      title: 'Nikita Boyarkin — Product Analyst, impact',
      description:
        'Product analytics cases with a result: +5.72 pp KYC conversion, retention, RFM segmentation, causal effects.',
      h1: 'Product Analyst — impact',
      lead: 'Cases with the decision and the result: what changed, and why.',
    },
    colleague: {
      title: 'Nikita Boyarkin | Product Analyst',
      description:
        'Portfolio of Nikita Boyarkin — product analyst. A/B testing and retention: SQL, Python, reproducible methodology.',
      h1: 'Product Analyst — how it is made',
      lead: 'Code, data, method and the knowledge graph — the whole path to the decision.',
    },
  },
};

const TRACKS = {
  ru: [
    { key: 'experiments', label: 'Эксперименты' },
    { key: 'analytics', label: 'Аналитика' },
    { key: 'product', label: 'Продукт' },
    { key: 'engineering', label: 'Инженерия' },
  ],
  en: [
    { key: 'experiments', label: 'Experiments' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'product', label: 'Product' },
    { key: 'engineering', label: 'Engineering' },
  ],
};

export function projectTracks(lang: 'ru' | 'en'): { key: string; label: string }[] {
  return lang === 'en' ? TRACKS.en : TRACKS.ru;
}

// ---------------------------------------------------------------------------
// Category (track) view — pure helpers shared by the projects board (server
// render) and its filter controller (client script). Deliberately free of
// Astro/DOM imports: the same functions run in both environments and are
// directly testable under `bun test`.
// ---------------------------------------------------------------------------

export interface TrackGroup<T> {
  key: string;
  label: string;
  projects: T[];
}

/** Slug without the `.md` extension, the form used across the board. */
export function stripExt(id: string): string {
  return id.replace(/\.md$/, '');
}

/** Rank of a project slug in `PROJECT_ORDER`; unknown slugs sink to the end. */
export function projectRank(id: string): number {
  const index = PROJECT_ORDER.indexOf(stripExt(id));
  return index === -1 ? PROJECT_ORDER.length : index;
}

/** Canonical board order (`PROJECT_ORDER`); unknown slugs sink to the end. */
export function sortByProjectOrder<T extends { id: string }>(projects: readonly T[]): T[] {
  return [...projects].sort((a, b) => projectRank(a.id) - projectRank(b.id));
}

/** Non-empty tracks in taxonomy order, each with its projects. */
export function groupByTrack<T extends { track: string }>(
  projects: readonly T[],
  lang: 'ru' | 'en' = 'ru',
): TrackGroup<T>[] {
  return projectTracks(lang)
    .map((track) => ({ ...track, projects: projects.filter((p) => p.track === track.key) }))
    .filter((track) => track.projects.length > 0);
}

/**
 * Flat board order: every project once, grouped track by track (taxonomy order,
 * then `sortByProjectOrder` inside each track). The board renders one grid, so
 * the flat order is what the reorder controller persists — each track's cards
 * have to stay contiguous or a saved order would interleave two tracks.
 * `trackLabel` rides along so the card can print its track as a badge without
 * the board re-deriving labels.
 */
export function flattenByTrack<T extends { track: string }>(
  projects: readonly T[],
  lang: 'ru' | 'en' = 'ru',
): { project: T; trackLabel: string }[] {
  return projectTracks(lang).flatMap(({ key, label }) =>
    projects.filter((p) => p.track === key).map((project) => ({ project, trackLabel: label })),
  );
}

/** Track key → localized label, for views that print the label without a grid. */
export function projectTrackLabels(lang: 'ru' | 'en' = 'ru'): Record<string, string> {
  return Object.fromEntries(projectTracks(lang).map(({ key, label }) => [key, label]));
}

export interface YearGroup<T> {
  year: number;
  projects: T[];
}

/**
 * Reverse-chronological groups, one per year of `date ?? updated` — the HR
 * landing's list order (`ProjectList.astro`). Newest year first, newest project
 * first inside it; several projects share a publication date, so
 * `PROJECT_ORDER` breaks the tie and the order is stable across builds.
 *
 * Undated projects are dropped rather than bucketed under a fake year:
 * `tests/lib/project-dates.test.ts` binds `date` on every project file, so a
 * drop here is unreachable until that test goes red.
 */
export function groupByYear<T extends { id: string; date?: Date; updated?: Date }>(
  projects: readonly T[],
): YearGroup<T>[] {
  const when = (project: T): Date => (project.date ?? project.updated) as Date;
  const ordered = projects
    .filter((project) => Boolean(project.date ?? project.updated))
    .sort((a, b) => when(b).getTime() - when(a).getTime() || projectRank(a.id) - projectRank(b.id));

  const groups: YearGroup<T>[] = [];
  for (const project of ordered) {
    const year = when(project).getFullYear();
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.projects.push(project);
    else groups.push({ year, projects: [project] });
  }
  return groups;
}

/** Project count per track key, including empty tracks (`0`). */
export function trackCounts<T extends { track: string }>(
  projects: readonly T[],
  lang: 'ru' | 'en' = 'ru',
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { key } of projectTracks(lang)) counts[key] = 0;
  for (const project of projects) {
    if (project.track in counts) counts[project.track] += 1;
  }
  return counts;
}

export const ALL_TOOLS = 'all';

/** Sentinel for "every category" in the track filter. */
export const ALL_TRACKS = 'all';

export interface ToolFilter {
  key: string;
  label: string;
}

const TOOL_KEYS = ['python', 'sql', 'tableau', 'jupyter', 'typescript'] as const;

const TOOL_LABELS: Record<string, string> = {
  python: 'Python',
  sql: 'SQL',
  tableau: 'Tableau',
  jupyter: 'Jupyter',
  typescript: 'TypeScript',
};

/**
 * Tool chips in display order; `all` is prepended and localized. The label is
 * spelled out ("All tools", not "All") because the category tabs already own a
 * plain "All" chip directly above it.
 */
export function projectToolFilters(lang: 'ru' | 'en' = 'ru'): ToolFilter[] {
  return [
    { key: ALL_TOOLS, label: lang === 'en' ? 'All tools' : 'Все инструменты' },
    ...TOOL_KEYS.map((key) => ({ key, label: TOOL_LABELS[key] })),
  ];
}

/** Case-insensitive substring match of a tool key against a project's tools. */
export function matchesTool(tools: readonly string[], toolKey: string): boolean {
  if (toolKey === ALL_TOOLS) return true;
  const needle = toolKey.toLowerCase();
  return tools.some((tool) => tool.toLowerCase().includes(needle));
}

/**
 * Tool keys that match nothing inside `projects` — the combinations to disable
 * in the active category so a chip never leads to an empty board.
 */
export function emptyToolKeys<T extends { tools: string[] }>(
  projects: readonly T[],
  lang: 'ru' | 'en' = 'ru',
): string[] {
  return projectToolFilters(lang)
    .filter(({ key }) => key !== ALL_TOOLS)
    .filter(({ key }) => !projects.some((p) => matchesTool(p.tools, key)))
    .map(({ key }) => key);
}