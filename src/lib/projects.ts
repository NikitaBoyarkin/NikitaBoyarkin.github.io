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