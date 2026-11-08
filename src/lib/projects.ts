// Shared project-board configuration for RU/EN locales.
// Single source of truth for the display order and the track (category) taxonomy
// used by ProjectBoard and ProjectSpotlight.
import { formatDate } from './date';

export const PROJECT_ORDER = ['volta', 'ab', 'games', 'supabase', 'posthog', 'streamlit', 'sales-calls', 'sql', 'clickhouse', 'delivery', 'gmv-drop-rca', 'marketplace-liquidity', 'rfm', 'cohort', 'churn', 'causal', 'crm-experiment-lab', 'rag', 'python', 'bot', 'scrolly', 'garden', 'serp-rank', 'airflow', 'ml', 'linkedin', 'promo', 'product-ab-funnel', 'oss-catalog', 'mm-program-page', 'site'];

// The catalogue used to open with a "С чего начать" strip over three headline
// cases (`HEADLINE_PROJECTS`). It went on 2026-11-08 with the redesign: the
// board now leads with the taxonomy, and the same three cases sit first in
// `PROJECT_ORDER` anyway, so the strip ranked three cards above thirty-one equal
// ones by repeating an order the reader can already see.

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
  'clickhouse',
  'delivery',
  'gmv-drop-rca',
  'marketplace-liquidity',
  'causal',
  'crm-experiment-lab',
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
  'product-ab-funnel',
  'oss-catalog',
  'mm-program-page',
  'site',
];

const METHOD_FIRST: readonly string[] = [
  'ab',
  'sql',
  'clickhouse',
  'delivery',
  'gmv-drop-rca',
  'marketplace-liquidity',
  'causal',
  'crm-experiment-lab',
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
  'product-ab-funnel',
  'oss-catalog',
  'mm-program-page',
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
      title: 'Nikita Boyarkin — Product Analyst, how it is made',
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

/**
 * Newest first, as slug order — the board's "newest first" view. The input is
 * already in curated order and `Array#sort` is stable, so projects sharing a
 * date (four share 2026-08-11) keep their curated slot instead of reshuffling
 * between builds. `date` is an ISO `YYYY-MM-DD` string, so lexicographic order
 * is chronological order and the client needs no `Date` parsing.
 */
export function sortSlugsByNewest<T extends { slug: string; date?: string }>(
  cards: readonly T[],
): string[] {
  return [...cards]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .map((card) => card.slug);
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

// ---------------------------------------------------------------------------
// Sphere (business domain) — a third facet, next to the method (`track`) and
// the stack (`tools`). A track says how the work was made; a sphere says whose
// problem it solves, which is what a reader with a domain in mind scans for.
//
// Authored here rather than in frontmatter on purpose: the key is
// language-neutral, so the same value would have to be duplicated across 23 RU
// and 23 EN files, and nothing would catch the pair drifting apart (`track`
// has the same exposure, but it predates this facet). One map cannot disagree
// with itself; `tests/lib/projects.test.ts` binds it to `PROJECT_ORDER`, so a
// new project without a sphere goes red instead of falling out of the filter.
// ---------------------------------------------------------------------------

export const ALL_SPHERES = 'all';

export const SPHERES = [
  { key: 'fintech', ru: 'Финтех', en: 'Fintech' },
  { key: 'saas-product', ru: 'SaaS-продукт', en: 'SaaS Product' },
  { key: 'commerce-growth', ru: 'Коммерция и рост', en: 'Commerce & Growth' },
  { key: 'learning-content', ru: 'Обучение и контент', en: 'Learning & Content' },
  { key: 'tooling', ru: 'Инструменты', en: 'Tooling' },
  { key: 'meta', ru: 'Мета', en: 'Meta' },
] as const;

export type SphereKey = (typeof SPHERES)[number]['key'];

/**
 * Slug → sphere. `commerce-growth` covers the sales/promo/ranking work whose
 * data belongs to a revenue funnel, `learning-content` the work whose subject
 * is the teaching material itself (coursework included), and `tooling` the
 * projects with no business domain — the method is the artifact.
 */
export const PROJECT_SPHERES: Record<string, SphereKey> = {
  volta: 'fintech',
  rfm: 'fintech',
  posthog: 'saas-product',
  streamlit: 'saas-product',
  supabase: 'saas-product',
  churn: 'saas-product',
  cohort: 'saas-product',
  bot: 'saas-product',
  'product-ab-funnel': 'saas-product',
  'marketplace-liquidity': 'commerce-growth',
  promo: 'commerce-growth',
  delivery: 'commerce-growth',
  'gmv-drop-rca': 'commerce-growth',
  causal: 'commerce-growth',
  'crm-experiment-lab': 'commerce-growth',
  'sales-calls': 'commerce-growth',
  'serp-rank': 'commerce-growth',
  airflow: 'commerce-growth',
  games: 'learning-content',
  scrolly: 'learning-content',
  sql: 'learning-content',
  ml: 'learning-content',
  garden: 'learning-content',
  linkedin: 'learning-content',
  ab: 'tooling',
  python: 'tooling',
  rag: 'tooling',
  clickhouse: 'tooling',
  'oss-catalog': 'tooling',
  'mm-program-page': 'tooling',
  site: 'meta',
};

/** Sphere of a project slug (extension tolerated); `undefined` when unmapped. */
export function projectSphere(slug: string): SphereKey | undefined {
  return PROJECT_SPHERES[stripExt(slug)];
}

export interface SphereFilter {
  key: string;
  label: string;
  count: number;
}

/** Sphere chips in taxonomy order; `all` is prepended and carries the total. */
export function projectSphereFilters(
  projects: readonly { id: string }[],
  lang: 'ru' | 'en' = 'ru',
): SphereFilter[] {
  return [
    {
      key: ALL_SPHERES,
      label: lang === 'en' ? 'All spheres' : 'Все сферы',
      count: projects.length,
    },
    ...SPHERES.map(({ key, ru, en }) => ({
      key,
      label: lang === 'en' ? en : ru,
      count: projects.filter((project) => projectSphere(project.id) === key).length,
    })),
  ];
}

/** `all` passes everything; an unmapped project matches only `all`. */
export function matchesSphere(sphere: string | undefined, sphereKey: string): boolean {
  if (sphereKey === ALL_SPHERES) return true;
  return sphere === sphereKey;
}

// ---------------------------------------------------------------------------
// Catalogue views — the four lenses a reader picks on `/projects/`: by track,
// real data only, newest first, and a dense table. Every helper here is pure
// and DOM-free, like the track helpers above: the route renders the active view
// on the server and the switch re-runs the same predicates in a client script,
// so a lens cannot mean one thing in the HTML and another in the browser.
//
// Ordering is always deterministic. Both date sorts end on `projectRank`, so two
// projects sharing a date keep their curated slot instead of reshuffling between
// builds — the same contract `groupByYear` and `sortSlugsByNewest` already keep.
//
// `fresh` mirrors the `.base` "Свежие" view, whose limit is 12. The number is
// declared once here so a board and a table cannot show different cut-offs.
// ---------------------------------------------------------------------------

export type ProjectViewKey = 'tracks' | 'real' | 'fresh' | 'table';

/** The four lenses, in display order, with both locales' labels. */
export const PROJECT_VIEWS: ReadonlyArray<{ key: ProjectViewKey; ru: string; en: string }> = [
  { key: 'tracks', ru: 'По трекам', en: 'By track' },
  { key: 'real', ru: 'Реальные данные', en: 'Real data' },
  { key: 'fresh', ru: 'Свежие', en: 'Fresh' },
  { key: 'table', ru: 'Таблица', en: 'Table' },
];

/** Landing lens: the board a visitor sees before choosing anything. */
export const DEFAULT_PROJECT_VIEW: ProjectViewKey = 'tracks';

/** `PROJECT_VIEWS` with the active locale's label — the shape the switch renders. */
export function projectViews(lang: 'ru' | 'en' = 'ru'): { key: ProjectViewKey; label: string }[] {
  return PROJECT_VIEWS.map((view) => ({ key: view.key, label: view[lang] }));
}

/** Narrows a raw `?view=` value (or storage entry) to a known lens. */
export function isProjectViewKey(value: string | null | undefined): value is ProjectViewKey {
  return PROJECT_VIEWS.some((view) => view.key === value);
}

/** How many projects the "Свежие" lens shows — the `.base` view's limit. */
export const FRESH_LIMIT = 12;

export type ProjectDataset = 'synthetic' | 'real' | 'mixed';

/** Datasets whose numbers come from real rows; `mixed` counts as real. */
export const REAL_DATASETS: readonly ProjectDataset[] = ['real', 'mixed'];

export function isRealDataset(dataset: ProjectDataset | undefined): dataset is 'real' | 'mixed' {
  return dataset === 'real' || dataset === 'mixed';
}

/**
 * Badge text for a project's provenance, or `null` when there is nothing to
 * say. Synthetic is the schema default and stays unlabelled: labelling the
 * default is noise, labelling the exception is information (the words are the
 * ones `ProjectCard.astro` already prints, and `tests/lib/project-views.test.ts`
 * reads that file to keep the two from drifting).
 */
const DATASET_LABELS: Record<'real' | 'mixed', Record<'ru' | 'en', string>> = {
  real: { ru: 'Реальные данные', en: 'Real data' },
  mixed: { ru: 'Реальные + синтетика', en: 'Real + synthetic' },
};

export function datasetLabel(
  dataset: ProjectDataset | undefined,
  lang: 'ru' | 'en' = 'ru',
): string | null {
  if (!isRealDataset(dataset)) return null;
  return DATASET_LABELS[dataset][lang];
}

/**
 * Newest first by `updated ?? date`, ties broken by `PROJECT_ORDER`. Undated
 * projects sink to the end: they have no position on a time axis, and a fake
 * one would put them somewhere false. `Array#sort` is stable, but the explicit
 * rank tie-break is what makes the order identical across builds.
 */
export function sortByFreshness<T extends { id: string; date?: Date; updated?: Date }>(
  projects: readonly T[],
): T[] {
  const when = (project: T): number => (project.updated ?? project.date)?.getTime() ?? 0;
  return [...projects].sort((a, b) => when(b) - when(a) || projectRank(a.id) - projectRank(b.id));
}

/** The freshest `limit` projects — the "Свежие" lens. */
export function freshProjects<T extends { id: string; date?: Date; updated?: Date }>(
  projects: readonly T[],
  limit: number = FRESH_LIMIT,
): T[] {
  return sortByFreshness(projects).slice(0, limit);
}

export interface ProjectTableRow {
  slug: string;
  title: string;
  /** Locale-relative case URL, e.g. `projects/ab/` or `en/projects/ab/` — no base prefix; the component applies withBase. */
  href: string;
  /** Localized track label, e.g. 'Эксперименты'. */
  track: string;
  /** Localized dataset label, or null for synthetic. */
  dataset: string | null;
  /** Display date, already formatted for the locale, or null when the file has none. */
  published: string | null;
  updated: string | null;
  github: string | null;
  isPrivate: boolean;
  tools: string[];
}

/**
 * Display date for a table cell. `formatDate` pins the calendar to UTC, so a
 * date-only frontmatter value cannot print as the previous day for a reader west
 * of UTC; using the same helper as the fresh lens also keeps one date style on
 * the page instead of an ISO string in a column beside a localized one.
 */
const displayDay = (value: Date | undefined, lang: 'ru' | 'en'): string | null =>
  value ? formatDate(value, lang) : null;

/**
 * One row per project for the table lens, in curated order so the table reads
 * in the same sequence as the board it replaces. Labels and dates arrive ready
 * to print: the component owns layout, and a second copy of the formatter is
 * how two views end up disagreeing about what "11 авг. 2026 г." means.
 */
export function projectTableRows<
  T extends {
    id: string;
    date?: Date;
    updated?: Date;
    track: string;
    dataset?: ProjectDataset;
    github?: string;
    private?: boolean;
    tools: string[];
    title: string;
  },
>(projects: readonly T[], opts: { lang?: 'ru' | 'en'; linkPrefix?: string }): ProjectTableRow[] {
  const lang = opts.lang ?? 'ru';
  const labels = projectTrackLabels(lang);
  // Strip trailing slashes before re-adding one: callers pass both `'en/'` and
  // `'en'`, and `'en//projects/…'` would be a broken URL on a static build.
  const prefix = (opts.linkPrefix ?? '').replace(/\/+$/, '');

  return sortByProjectOrder(projects).map((project) => ({
    slug: stripExt(project.id),
    title: project.title,
    href: `${prefix ? `${prefix}/` : ''}projects/${stripExt(project.id)}/`,
    track: labels[project.track] ?? project.track,
    dataset: datasetLabel(project.dataset, lang),
    published: displayDay(project.date, lang),
    updated: displayDay(project.updated, lang),
    github: project.github ?? null,
    isPrivate: Boolean(project.private),
    tools: [...project.tools],
  }));
}