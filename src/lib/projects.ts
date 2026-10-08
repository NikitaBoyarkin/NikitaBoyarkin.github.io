// Shared project-board configuration for RU/EN locales.
// Single source of truth for the display order and the track (category) taxonomy
// used by ProjectBoard and ProjectSpotlight.

export const PROJECT_ORDER = ['volta', 'ab', 'games', 'supabase', 'posthog', 'streamlit', 'sales-calls', 'sql', 'rfm', 'cohort', 'churn', 'causal', 'python', 'bot', 'scrolly', 'garden', 'site'];

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
 * Project subset per role (PRD §7). Slugs must exist in `PROJECT_ORDER`; the
 * order inside a subset is this array's order, which is what the role page
 * renders — a shorter board, not a re-sorted one. `colleague` is the whole
 * catalogue, so it never rots when a project is added.
 *
 * Validity is bound by `tests/lib/projects.test.ts`, not by the type system:
 * `PROJECT_ORDER` is a plain `string[]`, and `as const` would force casts at
 * four call sites (`sortByProjectOrder`, `HeadlineCases.astro`, both
 * `projects/[slug].astro`) for a check a test covers more cheaply.
 */
export const ROLE_CURATION: Record<Audience, readonly string[]> = {
  hr: ['volta', 'sql', 'cohort', 'ab', 'python', 'site'],
  manager: ['volta', 'cohort', 'sql', 'causal', 'churn', 'rfm', 'supabase', 'posthog', 'site'],
  colleague: PROJECT_ORDER,
};

/** Curated slugs for a role, in display order. */
export function curatedSlugs(role: Audience): readonly string[] {
  return ROLE_CURATION[role];
}

export interface RoleCopy {
  /** `<title>` — the visible page title. */
  title: string;
  /** `<meta name="description">`. */
  description: string;
  /** The hero `<h1>`. */
  h1: string;
  /** The role line under the name. */
  role: string;
  /** The one-line positioning statement. */
  phd: string;
}

// Per-role copy for the three landings (PRD §8: HR reads role/stack, a manager
// reads impact/decisions, a colleague reads how it is made). One record, read
// by both the route wrapper (for the `<Base>` head) and `RoleLanding` (for the
// hero) — the alternative duplicates every string across four files.
export const ROLE_COPY: Record<'ru' | 'en', Record<Audience, RoleCopy>> = {
  ru: {
    hr: {
      title: 'Никита Бояркин — продуктовый аналитик, найм',
      description:
        'Продуктовый аналитик: 5 лет в данных, SQL, Python, A/B-тесты. Стек, метрики и CV — для скрининга по вакансии.',
      h1: 'Продуктовый аналитик',
      role: 'SQL · Python · A/B-тесты · retention',
      phd: 'PhD по психологии труда. Ищу роль продуктового аналитика — данных и экспериментов.',
    },
    manager: {
      title: 'Никита Бояркин — продуктовый аналитик, результаты',
      description:
        'Кейсы продуктовой аналитики с результатом: +2,15 п.п. KYC-конверсии, retention, RFM-сегментация, CUPED, uplift.',
      h1: 'Продуктовый аналитик',
      role: 'Решения по данным с измеримым эффектом',
      phd: 'Считаю не отчёты, а решения: какой фикс включать, кого вернуть, где гипотеза не подтвердилась.',
    },
    colleague: {
      title: 'Никита Бояркин | Продуктовый аналитик',
      description:
        'Портфолио Никиты Бояркина — продуктовый аналитик. A/B-тесты и retention: SQL, Python, CUPED, воспроизводимая методология.',
      h1: 'Продуктовый аналитик',
      role: 'A/B-тесты и retention',
      phd: 'PhD по психологии труда — измеряю поведение и причинные эффекты, а не корреляции.',
    },
  },
  en: {
    hr: {
      title: 'Nikita Boyarkin — Product Analyst, hiring',
      description:
        'Product analyst: 5 years in data, SQL, Python, A/B testing. Stack, metrics and CV — for screening against a vacancy.',
      h1: 'Product Analyst',
      role: 'SQL · Python · A/B testing · retention',
      phd: 'PhD in work psychology. Looking for a product analyst role — data and experiments.',
    },
    manager: {
      title: 'Nikita Boyarkin — Product Analyst, impact',
      description:
        'Product analytics cases with a result: +2.15 pp KYC conversion, retention, RFM segmentation, CUPED, uplift.',
      h1: 'Product Analyst',
      role: 'Decisions from data, with a measurable effect',
      phd: 'I ship decisions, not dashboards: which fix to switch on, whom to win back, where the hypothesis failed.',
    },
    colleague: {
      title: 'Nikita Boyarkin | Product Analyst',
      description:
        'Portfolio of Nikita Boyarkin — product analyst. A/B testing and retention: SQL, Python, CUPED, reproducible methodology.',
      h1: 'Product Analyst',
      role: 'A/B Testing & Retention',
      phd: 'PhD in work psychology — I measure behaviour and causal effects, not correlations.',
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

/** Canonical board order (`PROJECT_ORDER`); unknown slugs sink to the end. */
export function sortByProjectOrder<T extends { id: string }>(projects: readonly T[]): T[] {
  const rank = (id: string): number => {
    const index = PROJECT_ORDER.indexOf(stripExt(id));
    return index === -1 ? PROJECT_ORDER.length : index;
  };
  return [...projects].sort((a, b) => rank(a.id) - rank(b.id));
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